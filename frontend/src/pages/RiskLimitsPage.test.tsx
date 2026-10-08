import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { RiskLimit } from '../api/types.ts'
import { json, mockFetch, renderAs, unexpected, userWithRole } from '../test/helpers.tsx'
import RiskLimitsPage from './RiskLimitsPage.tsx'

const limit: RiskLimit = {
  accountCode: 'ACC-1001',
  accountName: 'Harbor Growth Fund',
  accountStatus: 'ACTIVE',
  maxTradeNotional: 1_000_000,
  maxDailyNotional: 9_999_999_999_999.99, // the largest limit the API accepts
  priceTolerancePct: 10,
  usedToday: 0,
  updatedAt: null,
  updatedBy: null,
  version: 0,
}

// Opens the edit dialog. PUT bodies are kept as the raw JSON text that was sent.
async function openEditor() {
  const sent: string[] = []
  mockFetch((url, init) => {
    if (url === '/api/risk-limits' && !init?.method) return json([limit])
    if (url === '/api/risk-limits/ACC-1001' && init?.method === 'PUT') {
      sent.push(String(init.body))
      return json(limit)
    }
    return unexpected(url)
  })
  renderAs(userWithRole('RISK_MANAGER'), <RiskLimitsPage />, '/risk-limits')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
  await user.type(screen.getByLabelText('Reason'), 'Test')
  return { sent, user }
}

const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Save changes' }))

describe('risk limit editor', () => {
  it('shows and sends the largest limit without losing a cent', async () => {
    const { sent, user } = await openEditor()
    expect(screen.getByText('9,999,999,999,999.99')).toBeInTheDocument()
    expect(screen.getByLabelText('Max notional per day')).toHaveValue('9,999,999,999,999.99')

    const perTrade = screen.getByLabelText('Max notional per trade')
    await user.clear(perTrade)
    await user.type(perTrade, '2000000')
    await user.tab()
    expect(perTrade).toHaveValue('2,000,000.00')
    await save(user)

    expect(sent).toHaveLength(1)
    expect(sent[0]).toContain('"maxTradeNotional":2000000,')
    expect(sent[0]).toContain('"maxDailyNotional":9999999999999.99,')
  })

  it('rejects a limit too large to keep exactly instead of rounding it', async () => {
    const { sent, user } = await openEditor()
    const daily = screen.getByLabelText('Max notional per day')
    await user.clear(daily)
    await user.type(daily, '99,999,999,999,999.99')
    await user.tab()

    expect(daily).toHaveValue('99,999,999,999,999.99')
    await save(user)

    expect(screen.getByText("Can't be more than 9,999,999,999,999.99")).toBeInTheDocument()
    expect(sent).toHaveLength(0)
  })

  it('rejects extra decimals and misplaced commas instead of fixing them up', async () => {
    const { sent, user } = await openEditor()
    const perTrade = screen.getByLabelText('Max notional per trade')
    const tolerance = screen.getByLabelText('Price tolerance vs reference price')
    await user.clear(perTrade)
    await user.type(perTrade, '1,000.555')
    await user.tab()
    await user.clear(tolerance)
    await user.type(tolerance, '1,5')

    // used to become 1,000.56 when the field lost focus
    expect(perTrade).toHaveValue('1,000.555')
    expect(screen.queryByText('Changes')).not.toBeInTheDocument()
    await save(user)

    expect(screen.getByText('Use at most 2 decimal places')).toBeInTheDocument()
    expect(screen.getByText('Use commas only between thousands')).toBeInTheDocument()
    expect(sent).toHaveLength(0)
  })
})
