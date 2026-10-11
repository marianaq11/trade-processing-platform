import { screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from '../App.tsx'
import { emptyPage, json, mockFetch, renderAs, trade, unexpected, userWithRole } from '../test/helpers.tsx'

// 9,999,999 shares at 9,999,999.99. Read as a JSON number, this notional shows as ...900,000.02.
const large = trade({ quantity: 9999999, price: 9999999.99, notional: '99999989900000.0100' })

it.each([
  ['trade list', '/trades'],
  ['trade detail', '/trades/42'],
  ['settlement', '/settlement'],
])('shows a large notional to the cent on the %s page', async (_page, path) => {
  mockFetch((url) => {
    if (url === '/api/trades/42') return json(large)
    if (url === '/api/trades/42/events') return json([])
    if (url.startsWith('/api/trades/status-counts')) return json({ ACCEPTED: 1, REJECTED: 0, SETTLED: 0, CANCELLED: 0 })
    if (url.startsWith('/api/trades')) return json({ ...emptyPage, content: [large], totalElements: 1, totalPages: 1 })
    if (url === '/api/settlement') return json({ businessDate: '2026-10-06', dueNow: 1, awaitingLater: 0 })
    if (url === '/api/accounts' || url === '/api/instruments') return json([])
    return unexpected(url)
  })
  renderAs(userWithRole('OPERATIONS'), <App />, path)

  expect((await screen.findAllByText('99,999,989,900,000.01')).length).toBeGreaterThan(0)
  expect(screen.queryByText(/900,000\.02/)).not.toBeInTheDocument()
})
