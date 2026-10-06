import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { apiPost, errorMessage } from '../api/client.ts'
import { useApi } from '../api/useApi.ts'
import type { Trade, TradeEvent } from '../api/types.ts'
import StatusBadge from '../components/StatusBadge.tsx'
import { formatDateTime, formatMoney, formatPrice, formatQuantity } from '../format.ts'

export default function TradeDetailPage() {
  const { id } = useParams()
  const trade = useApi<Trade>(`/api/trades/${id}`)
  const events = useApi<TradeEvent[]>(`/api/trades/${id}/events`)

  function reloadAll() {
    trade.reload()
    events.reload()
  }

  if (trade.error) {
    return (
      <>
        <BackLink />
        <p className="error-banner">{trade.error}</p>
      </>
    )
  }
  if (!trade.data) {
    return <p className="muted">Loading...</p>
  }

  const t = trade.data
  return (
    <>
      <BackLink />
      <div className="page-header">
        <h1>
          Trade {t.id} <StatusBadge status={t.status} />
        </h1>
      </div>

      {t.status === 'REJECTED' && (
        <p className="notice notice-rejected">
          <strong>{t.rejectionReason}</strong>: {t.rejectionDetail}
        </p>
      )}

      <dl className="details">
        <Detail label="Account">{t.accountCode}</Detail>
        <Detail label="Symbol">{t.symbol}</Detail>
        <Detail label="Side">
          <span className={`side-${t.side.toLowerCase()}`}>{t.side}</span>
        </Detail>
        <Detail label="Quantity">{formatQuantity(t.quantity)}</Detail>
        <Detail label="Price">{formatPrice(t.price)}</Detail>
        <Detail label="Notional">{formatMoney(t.notional)}</Detail>
        <Detail label="Trade date">{t.tradeDate}</Detail>
        <Detail label="Settlement date">{t.settlementDate}</Detail>
        <Detail label="Submitted by">{t.submittedBy}</Detail>
        <Detail label="Submitted at">{formatDateTime(t.createdAt)}</Detail>
        <Detail label="Last updated">{formatDateTime(t.updatedAt)}</Detail>
        <Detail label="Client trade ID">
          <code>{t.clientTradeId}</code>
        </Detail>
      </dl>

      {t.status === 'ACCEPTED' && <CancelTrade tradeId={t.id} onCancelled={reloadAll} />}

      <h2>History</h2>
      {events.error && <p className="error-banner">{events.error}</p>}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>From</th>
              <th>To</th>
              <th>Detail</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {events.data?.map((e) => (
              <tr key={e.id}>
                <td>{formatDateTime(e.createdAt)}</td>
                <td className="muted">{e.fromStatus ?? '–'}</td>
                <td>
                  <StatusBadge status={e.toStatus} />
                </td>
                <td className="wrap">{e.detail}</td>
                <td>{e.performedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function BackLink() {
  return (
    <p className="back-link">
      <Link to="/trades">&larr; Trades</Link>
    </p>
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

function CancelTrade({ tradeId, onCancelled }: { tradeId: number; onCancelled: () => void }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(undefined)
    try {
      await apiPost(`/api/trades/${tradeId}/cancel`, { reason })
      onCancelled()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <div className="form-actions">
        <button className="btn btn-danger" onClick={() => setOpen(true)}>
          Cancel trade
        </button>
      </div>
    )
  }

  return (
    <form className="cancel-form" onSubmit={handleSubmit}>
      {error && <p className="error-banner">{error}</p>}
      <label htmlFor="cancel-reason">Reason for cancelling</label>
      <input id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} autoFocus />
      <div className="form-actions">
        <button type="submit" className="btn btn-danger" disabled={submitting || !reason.trim()}>
          Confirm cancel
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Keep trade
        </button>
      </div>
    </form>
  )
}
