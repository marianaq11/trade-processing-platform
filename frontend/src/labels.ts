import type { RejectionReason, RiskLimitField, Role, TradeStatus } from './api/types.ts'

export const statusLabels: Record<TradeStatus, string> = {
  RECEIVED: 'Received',
  VALIDATED: 'Validated',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  SETTLED: 'Settled',
}

export const rejectionLabels: Record<RejectionReason, string> = {
  ACCOUNT_SUSPENDED: 'Account suspended',
  INSTRUMENT_INACTIVE: 'Instrument not tradable',
  NO_RISK_LIMITS: 'No risk limits set',
  PRICE_OUT_OF_TOLERANCE: 'Price out of tolerance',
  TRADE_NOTIONAL_LIMIT: 'Over trade limit',
  DAILY_NOTIONAL_LIMIT: 'Over daily limit',
}

export const riskFieldLabels: Record<RiskLimitField, string> = {
  MAX_TRADE_NOTIONAL: 'Max per trade',
  MAX_DAILY_NOTIONAL: 'Max per day',
  PRICE_TOLERANCE_PCT: 'Price tolerance',
}

export const roleLabels: Record<Role, string> = {
  TRADER: 'Trader',
  OPERATIONS: 'Operations',
  RISK_MANAGER: 'Risk manager',
}
