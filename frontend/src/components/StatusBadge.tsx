import type { TradeStatus } from '../api/types.ts'

const statusClass: Record<TradeStatus, string> = {
  RECEIVED: 'pending',
  VALIDATED: 'pending',
  ACCEPTED: 'accepted',
  SETTLED: 'settled',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

export default function StatusBadge({ status }: { status: TradeStatus }) {
  return <span className={`status status-${statusClass[status]}`}>{status}</span>
}
