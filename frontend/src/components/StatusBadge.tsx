import type { Side, TradeStatus } from '../api/types.ts'
import { statusLabels } from '../labels.ts'

// Each status gets its own symbol as well as a colour, so they can be told apart without colour.
const glyphs: Record<TradeStatus, string> = {
  RECEIVED: '○',
  VALIDATED: '○',
  ACCEPTED: '●',
  SETTLED: '✓',
  REJECTED: '✕',
  CANCELLED: '–',
}

export default function StatusBadge({ status }: { status: TradeStatus }) {
  return (
    <span className={`status status-${status.toLowerCase()}`}>
      <span className="status-glyph" aria-hidden="true">
        {glyphs[status]}
      </span>
      {statusLabels[status]}
    </span>
  )
}

export function SideLabel({ side }: { side: Side }) {
  return <span className={`side side-${side.toLowerCase()}`}>{side}</span>
}
