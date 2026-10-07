import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import type { Role } from './api/types.ts'
import { emptyPage, json, mockFetch, renderAs, unexpected, userWithRole } from './test/helpers.tsx'

// The backend enforces roles on every endpoint (see SecurityTest/RiskLimitApiTest). These
// tests check the UI doesn't offer pages a role can't use.
describe('navigation by role', () => {
  let fetchMock: ReturnType<typeof mockFetch>

  beforeEach(() => {
    fetchMock = mockFetch((url) => {
      if (url.startsWith('/api/trades/status-counts')) return json({ ACCEPTED: 0, REJECTED: 0, SETTLED: 0, CANCELLED: 0 })
      if (url.startsWith('/api/trades')) return json(emptyPage)
      if (url === '/api/accounts' || url === '/api/instruments' || url === '/api/risk-limits') return json([])
      return unexpected(url)
    })
  })

  it.each<[Role, string[]]>([
    ['TRADER', ['Trades', 'New trade']],
    ['OPERATIONS', ['Trades', 'Settlement']],
    ['RISK_MANAGER', ['Risk limits', 'Audit log', 'Trades']],
  ])('%s only sees their own pages', (role, expected) => {
    renderAs(userWithRole(role), <App />, '/trades')

    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(expected)
  })

  it('sends each role to its own home page', async () => {
    renderAs(userWithRole('RISK_MANAGER'), <App />, '/')

    expect(await screen.findByRole('heading', { name: 'Risk limits' })).toBeInTheDocument()
  })

  it("doesn't load a risk page for a trader who types the URL", async () => {
    renderAs(userWithRole('TRADER'), <App />, '/risk-limits')

    expect(await screen.findByText("Your role doesn't have access to this page.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/risk-limits', expect.anything())
  })

  it('only offers New trade to traders', async () => {
    renderAs(userWithRole('OPERATIONS'), <App />, '/trades')

    expect(await screen.findByText('No trades have been booked yet.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New trade' })).not.toBeInTheDocument()
  })
})
