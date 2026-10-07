import type { Role } from './api/types.ts'

export interface NavItem {
  to: string
  label: string
}

// What each role sees in the top bar. The first item is where they land after signing in.
// This only decides what to show; the backend enforces the same rules on every request.
export const navigation: Record<Role, NavItem[]> = {
  TRADER: [
    { to: '/trades', label: 'Trades' },
    { to: '/trades/new', label: 'New trade' },
  ],
  OPERATIONS: [
    { to: '/trades', label: 'Trades' },
    { to: '/settlement', label: 'Settlement' },
  ],
  RISK_MANAGER: [
    { to: '/risk-limits', label: 'Risk limits' },
    { to: '/audit-log', label: 'Audit log' },
    { to: '/trades', label: 'Trades' },
  ],
}

export const homePath = (role: Role) => navigation[role][0].to
