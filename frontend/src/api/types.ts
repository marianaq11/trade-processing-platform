export type TradeStatus = 'RECEIVED' | 'VALIDATED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'SETTLED'

export type Side = 'BUY' | 'SELL'

export type Role = 'TRADER' | 'OPERATIONS' | 'RISK_MANAGER'

export type RejectionReason =
  | 'ACCOUNT_SUSPENDED'
  | 'INSTRUMENT_INACTIVE'
  | 'NO_RISK_LIMITS'
  | 'PRICE_OUT_OF_TOLERANCE'
  | 'TRADE_NOTIONAL_LIMIT'
  | 'DAILY_NOTIONAL_LIMIT'

export type RiskLimitField = 'MAX_TRADE_NOTIONAL' | 'MAX_DAILY_NOTIONAL' | 'PRICE_TOLERANCE_PCT'

export interface CurrentUser {
  username: string
  role: Role
}

export interface Account {
  code: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED'
}

export interface Instrument {
  symbol: string
  name: string
  referencePrice: number
  active: boolean
}

export interface Trade {
  id: number
  clientTradeId: string
  accountCode: string
  accountName: string
  symbol: string
  instrumentName: string
  side: Side
  quantity: number
  price: number
  notional: Decimal
  tradeDate: string
  settlementDate: string
  status: TradeStatus
  rejectionReason: RejectionReason | null
  rejectionDetail: string | null
  submittedBy: string
  createdAt: string
  updatedAt: string
}

export interface TradeEvent {
  id: number
  fromStatus: TradeStatus | null
  toStatus: TradeStatus
  detail: string | null
  performedBy: string
  createdAt: string
}

export type StatusCounts = Record<TradeStatus, number>

export interface Page<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface SubmitTradeRequest {
  clientTradeId: string
  accountCode: string
  symbol: string
  side: Side
  quantity: number
  price: number
}

// Exact decimal text such as "1000000.00". Trade notionals and risk limit amounts use this instead
// of number because they have more digits than a JS number keeps (up to 999,999,999,999,999.99).
export type Decimal = `${number}`

// Limit fields are null for an account that has no limits set up yet.
export interface RiskLimit {
  accountCode: string
  accountName: string
  accountStatus: 'ACTIVE' | 'SUSPENDED'
  maxTradeNotional: Decimal | null
  maxDailyNotional: Decimal | null
  priceTolerancePct: Decimal | null
  usedToday: Decimal
  updatedAt: string | null
  updatedBy: string | null
  version: number | null
}

export interface RiskLimitChange {
  id: number
  accountCode: string
  field: RiskLimitField
  oldValue: Decimal | null
  newValue: Decimal
  reason: string
  changedBy: string
  changedAt: string
}

export interface SettlementStatus {
  businessDate: string
  dueNow: number
  awaitingLater: number
}

export interface SettlementRun {
  businessDate: string
  due: number
  settled: number
  skipped: number
  failed: number
}
