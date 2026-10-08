import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { RiskLimit } from '../api/types.ts'
import { json, mockFetch, renderAs, unexpected, userWithRole } from '../test/helpers.tsx'
import RiskLimitsPage from './RiskLimitsPage.tsx'

// jsdom has no showModal(), and the edit form isn't usable until the dialog is open.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true
}

function riskLimit(overrides: Partial<RiskLimit> = {}): RiskLimit {
  return {
    accountCode: 'ACC-1001',
    accountName: 'Harbor Growth Fund',
    accountStatus: 'ACTIVE',
    maxTradeNotional: '1000000.00',
    maxDailyNotional: '5000000.00',
    priceTolerancePct: '10.00',
    usedToday: '230000.0000',
    updatedAt: '2026-10-05T14:00:00Z',
    updatedBy: 'system',
    version: 0,
    ...overrides,
  }
}

// Serves one account's limits; every PUT body goes into `saved`.
function setUp(limit: RiskLimit) {
  const saved: Record<string, unknown>[] = []
  mockFetch((url, init) => {
    if (url === '/api/risk-limits') return json([limit])
    if (url === `/api/risk-limits/${limit.accountCode}` && init?.method === 'PUT') {
      saved.push(JSON.parse(String(init.body)))
      return json(limit)
    }
    return unexpected(url)
  })
  renderAs(userWithRole('RISK_MANAGER'), <RiskLimitsPage />, '/risk-limits')
  return { saved, user: userEvent.setup() }
}

type User = ReturnType<typeof userEvent.setup>

async function openEditor(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Edit' }))
}

async function replace(user: User, label: string, text: string) {
  await user.clear(screen.getByLabelText(label))
  await user.type(screen.getByLabelText(label), text)
}

const save = (user: User) => user.click(screen.getByRole('button', { name: 'Save changes' }))

describe('risk limits', () => {
  it('shows large limits to the cent', async () => {
    setUp(riskLimit({ maxTradeNotional: '99999999999999.99', maxDailyNotional: '999999999999999.99' }))

    expect(await screen.findByText('99,999,999,999,999.99')).toBeInTheDocument()
    expect(screen.getByText('999,999,999,999,999.99')).toBeInTheDocument()
  })

  it('sends unchanged large limits back exactly when another limit is edited', async () => {
    const { saved, user } = setUp(
      riskLimit({ maxTradeNotional: '99999999999999.99', maxDailyNotional: '999999999999999.99' }),
    )
    await openEditor(user)

    expect(screen.getByLabelText('Max notional per trade')).toHaveValue('99,999,999,999,999.99')
    await replace(user, 'Price tolerance vs reference price', '7.5')
    await user.type(screen.getByLabelText('Reason'), 'Tighter tolerance')

    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    await save(user)

    // As JS numbers these used to go back as 99999999999999.98 and 1000000000000000
    expect(saved).toEqual([
      {
        maxTradeNotional: '99999999999999.99',
        maxDailyNotional: '999999999999999.99',
        priceTolerancePct: '7.5',
        reason: 'Tighter tolerance',
        version: 0,
      },
    ])
  })

  it('notices a one-cent change at the top of the range', async () => {
    const { saved, user } = setUp(
      riskLimit({ maxTradeNotional: '99999999999999.98', maxDailyNotional: '999999999999999.99' }),
    )
    await openEditor(user)

    await replace(user, 'Max notional per trade', '99,999,999,999,999.99')
    await user.type(screen.getByLabelText('Reason'), 'One cent more')

    expect(screen.getByRole('listitem')).toHaveTextContent('99,999,999,999,999.98 → 99,999,999,999,999.99')
    await save(user)

    expect(saved[0]).toMatchObject({ maxTradeNotional: '99999999999999.99' })
  })

  it('rejects more than 2 decimal places instead of rounding', async () => {
    const { saved, user } = setUp(riskLimit())
    await openEditor(user)

    await replace(user, 'Max notional per trade', '1000.129')
    await replace(user, 'Price tolerance vs reference price', '7.555')
    await user.type(screen.getByLabelText('Reason'), 'Test')

    // leaving the field used to turn this into 1,000.13
    expect(screen.getByLabelText('Max notional per trade')).toHaveValue('1000.129')
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument()
    await save(user)

    expect(screen.getAllByText('Use at most 2 decimal places')).toHaveLength(2)
    expect(saved).toHaveLength(0)
  })

  it('rejects misplaced commas instead of dropping them', async () => {
    const { saved, user } = setUp(riskLimit())
    await openEditor(user)

    await replace(user, 'Max notional per trade', '1,5')
    await replace(user, 'Max notional per day', '23,00')
    await user.type(screen.getByLabelText('Reason'), 'Test')

    expect(screen.getByLabelText('Max notional per trade')).toHaveValue('1,5')
    await save(user)

    expect(screen.getAllByText('Enter a number')).toHaveLength(2)
    expect(saved).toHaveLength(0)

    // correctly grouped amounts are fine
    await replace(user, 'Max notional per trade', '1,500,000')
    await replace(user, 'Max notional per day', '2500000.5')
    await user.click(screen.getByLabelText('Reason'))
    expect(screen.getByLabelText('Max notional per trade')).toHaveValue('1,500,000.00')
    await save(user)

    expect(saved).toEqual([expect.objectContaining({ maxTradeNotional: '1500000.00', maxDailyNotional: '2500000.50' })])
  })
})
