import { useState, type FormEvent, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { ApiError, apiPost, errorMessage } from '../api/client.ts'
import type { Trade, TradeEvent, TradeStatus } from '../api/types.ts'
import { useApi } from '../api/useApi.ts'
import { useCurrentUser } from '../auth/AuthContext.tsx'
import Dialog from '../components/Dialog.tsx'
import { Banner, ErrorBanner } from '../components/Feedback.tsx'
import Field, { messageId } from '../components/Field.tsx'
import PageHeader from '../components/PageHeader.tsx'
import StatusBadge, { SideLabel } from '../components/StatusBadge.tsx'
import { formatDateTime, formatMoney, formatPrice, formatQuantity, formatTradeId } from '../format.ts'
import { rejectionLabels, statusLabels } from '../labels.ts'

const BACK = { to: '/trades', label: 'Trades' }

export default function TradeDetailPage() {
  const { id } = useParams()
  const user = useCurrentUser()
  const trade = useApi<Trade>(`/api/trades/${id}`)
  const events = useApi<TradeEvent[]>(`/api/trades/${id}/events`)
  const [cancelOpen, setCancelOpen] = useState(false)

  function reloadAll() {
    trade.reload()
    events.reload()
  }

  if (trade.error) {
    return (
      <>
        <PageHeader title={`Trade ${id}`} back={BACK} />
        <ErrorBanner message={trade.error} />
      </>
    )
  }
  if (!trade.data) {
    return (
      <>
        <PageHeader title="Trade" back={BACK} />
        <div className="detail-layout" aria-busy="true">
          {[0, 1].map((panel) => (
            <section key={panel} className="panel skeleton-panel">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className="skeleton" />
              ))}
            </section>
          ))}
        </div>
      </>
    )
  }

  const t = trade.data
  const canCancel = t.status === 'ACCEPTED' && user.role === 'OPERATIONS'
  const cancelEvent = events.data?.find((e) => e.toStatus === 'CANCELLED')

  return (
    <>
      <PageHeader
        back={BACK}
        documentTitle={formatTradeId(t.id)}
        title={
          <>
            {formatTradeId(t.id)} <StatusBadge status={t.status} />
          </>
        }
        subtitle={
          <>
            <SideLabel side={t.side} /> {formatQuantity(t.quantity)} {t.symbol} @ {formatPrice(t.price)} for{' '}
            {t.accountCode} · {t.accountName}
          </>
        }
        actions={
          canCancel && (
            <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>
              Cancel trade
            </button>
          )
        }
      />

      {t.status === 'REJECTED' && t.rejectionReason && (
        <Banner tone="error">
          <strong>Rejected: {rejectionLabels[t.rejectionReason]}.</strong> {t.rejectionDetail}
        </Banner>
      )}
      {t.status === 'CANCELLED' && cancelEvent && (
        <Banner tone="info">
          <strong>
            Cancelled by {cancelEvent.performedBy} at {formatDateTime(cancelEvent.createdAt)} ET.
          </strong>{' '}
          {cancelEvent.detail}
        </Banner>
      )}

      <div className="detail-layout">
        <section className="panel" aria-labelledby="details-heading">
          <h2 className="panel-title" id="details-heading">
            Details
          </h2>
          <dl className="details">
            <Detail label="Account">
              {t.accountCode}
              <span className="detail-sub">{t.accountName}</span>
            </Detail>
            <Detail label="Instrument">
              {t.symbol}
              <span className="detail-sub">{t.instrumentName}</span>
            </Detail>
            <Detail label="Side">
              <SideLabel side={t.side} />
            </Detail>
            <Detail label="Quantity">{formatQuantity(t.quantity)}</Detail>
            <Detail label="Price">{formatPrice(t.price)}</Detail>
            <Detail label="Notional (USD)">
              <span className="strong">{formatMoney(t.notional)}</span>
            </Detail>
            <Detail label="Trade date">{t.tradeDate}</Detail>
            <Detail label="Settlement date">
              {t.status === 'REJECTED' || t.status === 'CANCELLED' ? (
                <span className="muted">Won't settle</span>
              ) : (
                t.settlementDate
              )}
            </Detail>
            <Detail label="Submitted by">{t.submittedBy}</Detail>
            <Detail label="Submitted at (ET)">{formatDateTime(t.createdAt)}</Detail>
            <Detail label="Last updated (ET)">{formatDateTime(t.updatedAt)}</Detail>
            <Detail label="Client trade ID">
              <code className="client-id">{t.clientTradeId}</code>
            </Detail>
          </dl>
        </section>

        <section className="panel" aria-labelledby="lifecycle-heading">
          <h2 className="panel-title" id="lifecycle-heading">
            Lifecycle
          </h2>
          {events.error && <ErrorBanner message={events.error} onRetry={events.reload} />}
          {events.data ? (
            <Timeline trade={t} events={events.data} />
          ) : (
            !events.error && (
              <div className="timeline-loading" aria-busy="true">
                <span className="skeleton" />
                <span className="skeleton" />
                <span className="skeleton" />
              </div>
            )
          )}
        </section>
      </div>

      <CancelDialog
        open={cancelOpen}
        trade={t}
        onClose={() => setCancelOpen(false)}
        onCancelled={() => {
          setCancelOpen(false)
          reloadAll()
        }}
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const stepTone: Record<TradeStatus, string> = {
  RECEIVED: 'done',
  VALIDATED: 'done',
  ACCEPTED: 'done',
  SETTLED: 'final',
  REJECTED: 'failed',
  CANCELLED: 'stopped',
}

const stepGlyph: Record<string, string> = {
  done: '✓',
  final: '✓',
  failed: '✕',
  stopped: '–',
  pending: '',
}

// The recorded history, plus the settlement step that's still to come for an accepted trade.
// Steps after a rejection or cancellation never happen, so they aren't drawn.
function Timeline({ trade, events }: { trade: Trade; events: TradeEvent[] }) {
  return (
    <ol className="timeline">
      {events.map((e) => {
        const tone = stepTone[e.toStatus]
        return (
          <li key={e.id} className={`timeline-step step-${tone}`}>
            <span className="timeline-marker" aria-hidden="true">
              {stepGlyph[tone]}
            </span>
            <div className="timeline-body">
              <div className="timeline-title">{statusLabels[e.toStatus]}</div>
              <div className="timeline-meta">
                <time dateTime={e.createdAt}>{formatDateTime(e.createdAt)} ET</time> · {e.performedBy}
              </div>
              {e.detail && e.toStatus !== 'RECEIVED' && e.detail !== statusLabels[e.toStatus] && (
                <div className="timeline-detail">{e.detail}</div>
              )}
            </div>
          </li>
        )
      })}
      {trade.status === 'ACCEPTED' && (
        <li className="timeline-step step-pending">
          <span className="timeline-marker" aria-hidden="true" />
          <div className="timeline-body">
            <div className="timeline-title">Settled</div>
            <div className="timeline-meta">Expected {trade.settlementDate}, end of day</div>
          </div>
        </li>
      )}
    </ol>
  )
}

interface CancelDialogProps {
  open: boolean
  trade: Trade
  onClose: () => void
  onCancelled: () => void
}

function CancelDialog({ open, trade, onClose, onCancelled }: CancelDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [fieldError, setFieldError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!reason.trim()) {
      setFieldError('Enter a reason so the history explains why it was cancelled')
      return
    }
    setSubmitting(true)
    setError(undefined)
    try {
      await apiPost(`/api/trades/${trade.id}/cancel`, { reason: reason.trim() })
      setReason('')
      onCancelled()
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError) setFieldError(err.fieldErrors.reason)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} title={`Cancel ${formatTradeId(trade.id)}`} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="dialog-body">
          <p className="dialog-intro">
            <SideLabel side={trade.side} /> {formatQuantity(trade.quantity)} {trade.symbol} @ {formatPrice(trade.price)},
            notional {formatMoney(trade.notional)}. It won't settle and stops counting toward{' '}
            {trade.accountCode}'s daily limit.
          </p>
          {error && <ErrorBanner message={error} />}
          <Field id="cancel-reason" label="Reason" error={fieldError} hint="Shown in the trade's history.">
            <textarea
              id="cancel-reason"
              rows={3}
              maxLength={255}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setFieldError(undefined)
              }}
              aria-invalid={!!fieldError}
              aria-describedby={messageId('cancel-reason')}
              autoFocus
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn" onClick={onClose}>
            Keep trade
          </button>
          <button type="submit" className="btn btn-danger-solid" disabled={submitting}>
            {submitting ? 'Cancelling...' : 'Cancel trade'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
