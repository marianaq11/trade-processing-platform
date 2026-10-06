export type TradeStatus = 'RECEIVED' | 'VALIDATED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'SETTLED'

export const TRADE_STATUSES: TradeStatus[] = ['RECEIVED', 'VALIDATED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'SETTLED']

export type Side = 'BUY' | 'SELL'

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
  symbol: string
  side: Side
  quantity: number
  price: number
  notional: number
  tradeDate: string
  settlementDate: string
  status: TradeStatus
  rejectionReason: string | null
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
