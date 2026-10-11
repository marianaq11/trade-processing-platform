import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { json, mockFetch, renderAs, trade, unexpected, userWithRole } from '../test/helpers.tsx'
import NewTradePage from './NewTradePage.tsx'

const accounts = [
  { code: 'ACC-1001', name: 'Harbor Growth Fund', status: 'ACTIVE' },
  { code: 'ACC-1004', name: 'Old Mill Capital', status: 'SUSPENDED' },
]
const instruments = [{ symbol: 'AAPL', name: 'Apple Inc.', referencePrice: 230, active: true }]

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

async function fillIn(user: ReturnType<typeof userEvent.setup>, account = 'ACC-1001', quantity = '100') {
  await screen.findByRole('option', { name: /ACC-1001/ })
  await user.selectOptions(screen.getByLabelText('Account'), account)
  await user.selectOptions(screen.getByLabelText('Instrument'), 'AAPL')
  await user.type(screen.getByLabelText('Quantity (shares)'), quantity)
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: /Submit (buy|sell) trade/ }))

async function typePrice(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.clear(screen.getByLabelText('Price (USD)'))
  await user.type(screen.getByLabelText('Price (USD)'), text)
}

const notionalPreview = () => screen.getByText('Notional (USD)').nextElementSibling

describe('new trade form', () => {
  it('checks required fields before sending anything', async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await screen.findByRole('option', { name: /ACC-1001/ })

    await submit(user)

    expect(screen.getByText('Choose an account')).toBeInTheDocument()
    expect(screen.getByText('Choose an instrument')).toBeInTheDocument()
    expect(screen.getByText('Enter a quantity')).toBeInTheDocument()
    expect(submitted).toHaveLength(0)

    // picking an instrument fills in its price, so the price error shouldn't hang around
    await user.selectOptions(screen.getByLabelText('Instrument'), 'AAPL')
    expect(screen.getByLabelText('Price (USD)')).toHaveValue('230.00')
    expect(screen.queryByText('Enter a price')).not.toBeInTheDocument()
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
    expect(await screen.findByText('Last attempt: Failed to fetch')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry this trade' }))

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

  it('rejects misplaced commas instead of dropping them', async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1001', '1,5')
    await user.clear(screen.getByLabelText('Price (USD)'))
    await user.type(screen.getByLabelText('Price (USD)'), '23,00')

    // these used to go through as 15 shares at 2,300.00
    expect(screen.getByLabelText('Quantity (shares)')).toHaveValue('1,5')
    await submit(user)

    expect(screen.getAllByText('Enter a number')).toHaveLength(2)
    expect(submitted).toHaveLength(0)

    await user.clear(screen.getByLabelText('Quantity (shares)'))
    await user.type(screen.getByLabelText('Quantity (shares)'), '1,500')
    await user.clear(screen.getByLabelText('Price (USD)'))
    await user.type(screen.getByLabelText('Price (USD)'), '1,230.50')
    await submit(user)

    expect(submitted[0]).toMatchObject({ quantity: 1500, price: 1230.5 })
  })

  it("doesn't round a long fractional quantity to a whole number", async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1001', '1.0000000000000001')

    await submit(user)

    expect(screen.getByLabelText('Quantity (shares)')).toHaveValue('1.0000000000000001')
    expect(screen.getByText('Must be a whole number of shares')).toBeInTheDocument()
    expect(submitted).toHaveLength(0)
  })

  it('works out the notional preview exactly', async () => {
    const { user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1001', '9,999,999')
    await typePrice(user, '9,999,999.99')

    // multiplying JS numbers gave 99,999,989,900,000.02
    expect(notionalPreview()).toHaveTextContent('99,999,989,900,000.01')
  })

  it("doesn't preview a notional for a quantity or price that won't pass validation", async () => {
    const { user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1001', '1.5')
    expect(notionalPreview()).toHaveTextContent('—')

    await user.clear(screen.getByLabelText('Quantity (shares)'))
    await user.type(screen.getByLabelText('Quantity (shares)'), '100')
    expect(notionalPreview()).toHaveTextContent('23,000.00')
    await typePrice(user, '230.00001')
    expect(notionalPreview()).toHaveTextContent('—')
  })

  it('accepts a shorthand price like .5', async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1001', '1,000')
    await typePrice(user, '.5')

    expect(notionalPreview()).toHaveTextContent('500.00')
    await submit(user)

    expect(await screen.findByRole('heading', { name: 'Trade accepted' })).toBeInTheDocument()
    expect(submitted[0]).toMatchObject({ quantity: 1000, price: 0.5 })
  })

  it('still rejects malformed prices and more than 4 decimal places', async () => {
    const { submitted, user } = setUp(() => json(trade(), 201))
    await fillIn(user)

    const cases = [
      ['1.2.3', 'Enter a number'],
      ['.', 'Enter a number'],
      ['5.', 'Enter a number'],
      ['1,5', 'Enter a number'],
      ['.12345', 'Use at most 4 decimal places'],
      ['230.00001', 'Use at most 4 decimal places'],
      ['0', 'Must be greater than 0'],
      ['-.5', 'Must be greater than 0'],
      ['10000000', "Can't be more than 9,999,999.9999"],
    ]
    for (const [text, message] of cases) {
      await typePrice(user, text)
      await submit(user)
      expect(screen.getByText(message), text).toBeInTheDocument()
    }
    expect(submitted).toHaveLength(0)
  })

  it('shows a large notional to the cent once the trade is booked', async () => {
    const booked = trade({ quantity: 9999999, price: 9999999.99, notional: '99999989900000.0100' })
    const { user } = setUp(() => json(booked, 201))
    await fillIn(user)

    await submit(user)

    expect(await screen.findByText(/notional 99,999,989,900,000\.01 USD/)).toBeInTheDocument()
  })

  it('warns before submitting for a suspended account', async () => {
    const { user } = setUp(() => json(trade(), 201))
    await fillIn(user, 'ACC-1004')

    expect(screen.getByText('ACC-1004 is suspended, so this trade will be rejected.')).toBeInTheDocument()
  })
})
