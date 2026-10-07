import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Trade } from '../api/types.ts'
import { json, mockFetch, renderAs, unexpected, userWithRole } from '../test/helpers.tsx'
import NewTradePage from './NewTradePage.tsx'

const accounts = [
  { code: 'ACC-1001', name: 'Harbor Growth Fund', status: 'ACTIVE' },
  { code: 'ACC-1004', name: 'Old Mill Capital', status: 'SUSPENDED' },
]
const instruments = [{ symbol: 'AAPL', name: 'Apple Inc.', referencePrice: 230, active: true }]

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 42,
    clientTradeId: 'x',
    accountCode: 'ACC-1001',
    accountName: 'Harbor Growth Fund',
    symbol: 'AAPL',
    instrumentName: 'Apple Inc.',
    side: 'BUY',
    quantity: 100,
    price: 230,
    notional: 23000,
    tradeDate: '2026-10-05',
    settlementDate: '2026-10-06',
    status: 'ACCEPTED',
    rejectionReason: null,
    rejectionDetail: null,
    submittedBy: 'trader',
    createdAt: '2026-10-05T14:00:00Z',
    updatedAt: '2026-10-05T14:00:00Z',
    ...overrides,
  }
}

// Answers the two lookups the form needs; every POST /api/trades goes to `onSubmit`.
function setUp(onSubmit: (body: Record<string, unknown>) => Response | Promise<Response>) {
  const submitted: Record<string, unknown>[] = []
  mockFetch((url, init) => {
    if (url === '/api/accounts') return json(accounts)
    if (url === '/api/instruments') return json(instruments)
    if (url === '/api/trades' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      submitted.push(body)
      return onSubmit(body)
    }
    return unexpected(url)
  })
  renderAs(userWithRole('TRADER'), <NewTradePage />, '/trades/new')
  return { submitted, user: userEvent.setup() }
}

async function fillIn(user: ReturnType<typeof userEvent.setup>, account = 'ACC-1001') {
  await screen.findByRole('option', { name: /ACC-1001/ })
  await user.selectOptions(screen.getByLabelText('Account'), account)
  await user.selectOptions(screen.getByLabelText('Instrument'), 'AAPL')
  await user.type(screen.getByLabelText('Quantity (shares)'), '100')
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Submit (buy|sell) trade/ }))

describe('new trade form', () => {
  it('checks required fields before sending anything', async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await screen.findByRole('option', { name: /ACC-1001/ })

    await submit(user)

    expect(screen.getByText('Choose an account')).toBeInTheDocument()
    expect(screen.getByText('Choose an instrument')).toBeInTheDocument()
    expect(screen.getByText('Enter a quantity')).toBeInTheDocument()
    expect(submitted).toHaveLength(0)
  })

  it('fills in the reference price and submits the trade', async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await fillIn(user)

    expect(screen.getByLabelText('Price (USD)')).toHaveValue('230.00')
    await submit(user)

    expect(await screen.findByRole('heading', { name: 'Trade accepted' })).toBeInTheDocument()
    expect(screen.getByText('T-000042')).toBeInTheDocument()
    expect(submitted[0]).toMatchObject({ accountCode: 'ACC-1001', symbol: 'AAPL', side: 'BUY', quantity: 100, price: 230 })
  })

  it('sends the same clientTradeId again when retrying after a failed request', async () => {
    let attempts = 0
    const { submitted, user } = setUp(() => {
      attempts++
      if (attempts === 1) throw new TypeError('Failed to fetch')
      return json(trade(), 201)
    })
    await fillIn(user)

    await submit(user)
    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument()
    await submit(user)

    expect(await screen.findByRole('heading', { name: 'Trade accepted' })).toBeInTheDocument()
    expect(submitted).toHaveLength(2)
    expect(submitted[1].clientTradeId).toBe(submitted[0].clientTradeId)
  })

  it('says so when the trade had already been submitted', async () => {
    const { user } = setUp(() => json(trade(), 200))
    await fillIn(user)

    await submit(user)

    expect(await screen.findByText(/already been submitted, so nothing new was booked/)).toBeInTheDocument()
  })

  it('shows why a trade was rejected, and treats the amended trade as a new one', async () => {
    const rejected = trade({
      status: 'REJECTED',
      rejectionReason: 'TRADE_NOTIONAL_LIMIT',
      rejectionDetail: 'Notional 23,000.00 is over the single-trade limit of 10,000.00',
    })
    const { submitted, user } = setUp(() => json(rejected, 201))
    await fillIn(user)

    await submit(user)
    expect(await screen.findByRole('heading', { name: 'Trade rejected' })).toBeInTheDocument()
    expect(screen.getByText('Over trade limit.')).toBeInTheDocument()
    expect(screen.getByText(/over the single-trade limit of 10,000.00/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Amend and resubmit' }))
    expect(screen.getByLabelText('Quantity (shares)')).toHaveValue('100')
    await submit(user)

    expect(submitted).toHaveLength(2)
    expect(submitted[1].clientTradeId).not.toBe(submitted[0].clientTradeId)
  })

  it('shows the server message and field errors when a request is refused', async () => {
    const { user } = setUp(() =>
      json({ detail: 'Request has invalid fields', errors: { quantity: 'must be less than or equal to 10000000' } }, 400),
    )
    await fillIn(user)

    await submit(user)

    expect(await screen.findByText('Request has invalid fields')).toBeInTheDocument()
    expect(screen.getByText('Must be less than or equal to 10000000')).toBeInTheDocument()
    expect(screen.getByLabelText('Quantity (shares)')).toHaveAttribute('aria-invalid', 'true')
  })

  it("tells a trader with no entitled accounts instead of showing an empty form", async () => {
    mockFetch((url) => {
      if (url === '/api/accounts') return json([])
      if (url === '/api/instruments') return json(instruments)
      return unexpected(url)
    })
    renderAs(userWithRole('TRADER'), <NewTradePage />, '/trades/new')

    expect(await screen.findByText("You aren't entitled to trade on any accounts yet.")).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit/ })).not.toBeInTheDocument()
  })

  it('warns before submitting for a suspended account', async () => {
    const { user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1004')

    expect(screen.getByText('ACC-1004 is suspended, so this trade will be rejected.')).toBeInTheDocument()
  })
})
