import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '../api/types.ts'
import { json, mockFetch, renderAs, trade, unexpected } from '../test/helpers.tsx'
import NewTradePage from './NewTradePage.tsx'

const alice: CurrentUser = { username: 'alice', role: 'TRADER' }
const bob: CurrentUser = { username: 'bob', role: 'TRADER' }

type Body = Record<string, unknown>
type Book = () => Response

// Books trades the way the backend does: a repeat of the same clientTradeId with the same details
// returns the original with 200, with different details it's a 409. `onPost` decides what the
// browser actually gets back, e.g. booking the trade and then losing the response.
function backend(onPost: (book: Book, body: Body) => Response | Promise<Response> = (book) => book()) {
  const booked = new Map<string, Body>()
  const posts: Body[] = []
  mockFetch((url, init) => {
    if (url === '/api/accounts') return json([{ code: 'ACC-1001', name: 'Harbor Growth Fund', status: 'ACTIVE' }])
    if (url === '/api/instruments') return json([{ symbol: 'AAPL', name: 'Apple Inc.', referencePrice: 230, active: true }])
    if (url === '/api/trades' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Body
      posts.push(body)
      return onPost(() => {
        const id = body.clientTradeId as string
        const existing = booked.get(id)
        if (existing) {
          if (JSON.stringify(existing) !== JSON.stringify(body)) return json({ detail: 'Already used' }, 409)
          return json(trade({ clientTradeId: id }), 200)
        }
        booked.set(id, body)
        return json(trade({ id: booked.size, clientTradeId: id, quantity: body.quantity as number }), 201)
      }, body)
    }
    return unexpected(url)
  })
  return { booked, posts }
}

const lostResponse = (book: Book) => {
  book()
  throw new TypeError('Failed to fetch')
}

const open = (as = alice) => renderAs(as, <NewTradePage />, '/trades/new')

// Unmounting and rendering again is what a refresh or a trip to another page does to this page.
function reopen(view: ReturnType<typeof open>, as = alice) {
  view.unmount()
  return open(as)
}

async function submitTrade(user: ReturnType<typeof userEvent.setup>, quantity = '100') {
  await screen.findByRole('option', { name: /ACC-1001/ })
  await user.selectOptions(screen.getByLabelText('Account'), 'ACC-1001')
  await user.selectOptions(screen.getByLabelText('Instrument'), 'AAPL')
  await user.type(screen.getByLabelText('Quantity (shares)'), quantity)
  await user.click(screen.getByRole('button', { name: 'Submit buy trade' }))
}

const notConfirmed = () => screen.findByRole('heading', { name: 'Not confirmed yet' })
const retry = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Retry this trade' }))

describe('recovering a trade whose outcome is unknown', () => {
  it('gets the original back when the server booked the trade but the response was lost', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const { booked, posts } = backend((book) => (++attempts === 1 ? lostResponse(book) : book()))
    open()

    await submitTrade(user)
    expect(await notConfirmed()).toBeInTheDocument()
    expect(screen.getByText('Last attempt: Failed to fetch')).toBeInTheDocument()

    await retry(user)

    expect(await screen.findByText(/already been submitted, so nothing new was booked/)).toBeInTheDocument()
    expect(posts).toHaveLength(2)
    expect(booked.size).toBe(1)
  })

  it('still offers the retry after a refresh, without sending anything by itself', async () => {
    const user = userEvent.setup()
    const { posts } = backend(lostResponse)
    const view = open()
    await submitTrade(user)
    await notConfirmed()

    reopen(view)

    expect(await notConfirmed()).toBeInTheDocument()
    expect(screen.getByText(/Client trade ID/)).toHaveTextContent(String(posts[0].clientTradeId).slice(0, 8))
    expect(screen.queryByLabelText('Quantity (shares)')).not.toBeInTheDocument()
    expect(posts).toHaveLength(1)
  })

  it('keeps the trade if the page is left while the request is still in flight', async () => {
    const user = userEvent.setup()
    backend(() => new Promise<Response>(() => {}))
    const view = open()
    await submitTrade(user)
    expect(screen.getByRole('button', { name: 'Submitting...' })).toBeDisabled()

    reopen(view)

    expect(await notConfirmed()).toBeInTheDocument()
  })

  it('retries with exactly the original clientTradeId and details', async () => {
    const user = userEvent.setup()
    let attempts = 0
    const { posts } = backend((book) => (++attempts === 1 ? lostResponse(book) : book()))
    const view = open()
    await submitTrade(user, '250')
    await notConfirmed()
    reopen(view)

    await notConfirmed()
    await retry(user)

    await screen.findByRole('heading', { name: 'Trade accepted' })
    expect(posts[1]).toEqual(posts[0])
    expect(posts[1]).toMatchObject({ accountCode: 'ACC-1001', symbol: 'AAPL', side: 'BUY', quantity: 250, price: 230 })
  })

  it('clears the unconfirmed trade once a retry is confirmed', async () => {
    const user = userEvent.setup()
    let attempts = 0
    backend((book) => (++attempts === 1 ? lostResponse(book) : book()))
    const view = open()
    await submitTrade(user)
    await notConfirmed()

    await retry(user)
    await screen.findByRole('heading', { name: 'Trade accepted' })
    reopen(view)

    expect(await screen.findByLabelText('Quantity (shares)')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Not confirmed yet' })).not.toBeInTheDocument()
  })

  it('stays unconfirmed when the server fails or a retry is refused', async () => {
    const user = userEvent.setup()
    let attempts = 0
    backend(() => (++attempts === 1 ? json({ detail: 'Bad gateway' }, 502) : json({ detail: 'Not allowed' }, 403)))
    open()

    await submitTrade(user)
    expect(await notConfirmed()).toBeInTheDocument()
    await retry(user)

    // the first attempt could still have been booked, so a refused retry doesn't settle it
    expect(await screen.findByText('Last attempt: Not allowed')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Not confirmed yet' })).toBeInTheDocument()
  })

  it('treats a refused first attempt as a known error, with nothing to recover', async () => {
    const user = userEvent.setup()
    backend(() => json({ detail: 'Request has invalid fields', errors: { quantity: 'too big' } }, 400))
    const view = open()

    await submitTrade(user)

    expect(await screen.findByText('Request has invalid fields')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Not confirmed yet' })).not.toBeInTheDocument()
    reopen(view)
    expect(await screen.findByLabelText('Quantity (shares)')).toHaveValue('')
  })

  it("doesn't let the details be edited under the original clientTradeId", async () => {
    const user = userEvent.setup()
    let attempts = 0
    const { booked, posts } = backend((book) => (++attempts === 1 ? lostResponse(book) : book()))
    open()
    await submitTrade(user)
    await notConfirmed()
    expect(screen.queryByLabelText('Quantity (shares)')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start a new trade instead' }))
    expect(screen.getByText(/anything you submit next is booked as a separate trade/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Discard and start a new trade' }))

    expect(screen.getByLabelText('Quantity (shares)')).toHaveValue('100')
    await user.clear(screen.getByLabelText('Quantity (shares)'))
    await user.type(screen.getByLabelText('Quantity (shares)'), '120')
    await user.click(screen.getByRole('button', { name: 'Submit buy trade' }))

    await screen.findByRole('heading', { name: 'Trade accepted' })
    expect(posts[1].clientTradeId).not.toBe(posts[0].clientTradeId)
    expect(posts[1]).toMatchObject({ quantity: 120 })
    expect(booked.size).toBe(2)
  })

  it('only discards after the warning is confirmed', async () => {
    const user = userEvent.setup()
    backend(lostResponse)
    const view = open()
    await submitTrade(user)
    await notConfirmed()

    await user.click(screen.getByRole('button', { name: 'Start a new trade instead' }))
    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    reopen(view)

    expect(await notConfirmed()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry this trade' })).toBeInTheDocument()
  })

  it('starts a clean new trade once discarded, even after a refresh', async () => {
    const user = userEvent.setup()
    const { posts } = backend((book) => (posts.length === 1 ? lostResponse(book) : book()))
    const view = open()
    await submitTrade(user)
    await notConfirmed()

    await user.click(screen.getByRole('button', { name: 'Start a new trade instead' }))
    await user.click(screen.getByRole('button', { name: 'Discard and start a new trade' }))
    reopen(view)

    expect(await screen.findByLabelText('Quantity (shares)')).toHaveValue('')
    await submitTrade(user, '5')
    await screen.findByRole('heading', { name: 'Trade accepted' })
    expect(posts[1].clientTradeId).not.toBe(posts[0].clientTradeId)
  })

  it("keeps one trader's unconfirmed trade away from another trader in the same tab", async () => {
    const user = userEvent.setup()
    const { posts } = backend(lostResponse)
    let view = open(alice)
    await submitTrade(user)
    await notConfirmed()

    // alice signs out and bob signs in
    view = reopen(view, bob)
    expect(await screen.findByLabelText('Quantity (shares)')).toHaveValue('')
    expect(screen.queryByRole('heading', { name: 'Not confirmed yet' })).not.toBeInTheDocument()
    await submitTrade(user)
    expect(posts[1].clientTradeId).not.toBe(posts[0].clientTradeId)
    await notConfirmed()

    // and alice still has hers when she's back
    reopen(view, alice)
    expect(await notConfirmed()).toBeInTheDocument()
    expect(screen.getByText(/Client trade ID/)).toHaveTextContent(String(posts[0].clientTradeId).slice(0, 8))
  })
})
