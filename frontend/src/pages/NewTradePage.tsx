import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, errorMessage, request } from '../api/client.ts'
import { useApi } from '../api/useApi.ts'
import type { Account, Instrument, Side, SubmitTradeRequest, Trade } from '../api/types.ts'
import StatusBadge from '../components/StatusBadge.tsx'
import { formatMoney, formatPrice } from '../format.ts'

interface SubmitOutcome {
  trade: Trade
  duplicate: boolean
}

export default function NewTradePage() {
  const accounts = useApi<Account[]>('/api/accounts')
  const instruments = useApi<Instrument[]>('/api/instruments')

  // Generated once per trade, not per click. If the request fails or times out and the user
  // hits Submit again, the backend sees the same ID and won't book the trade twice.
  const [clientTradeId, setClientTradeId] = useState(() => crypto.randomUUID())
  const [accountCode, setAccountCode] = useState('')
  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState<Side>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [outcome, setOutcome] = useState<SubmitOutcome>()

  const instrument = instruments.data?.find((i) => i.symbol === symbol)
  const estimatedNotional = Number(quantity) * Number(price)

  function edit(field: string, setValue: (value: string) => void, value: string) {
    setValue(value)
    setFieldErrors((errors) => {
      const next = { ...errors }
      delete next[field]
      return next
    })
  }

  function selectSymbol(value: string) {
    setSymbol(value)
    const selected = instruments.data?.find((i) => i.symbol === value)
    if (selected && !price) setPrice(String(selected.referencePrice))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(undefined)
    setFieldErrors({})

    const body: SubmitTradeRequest = {
      clientTradeId,
      accountCode,
      symbol,
      side,
      quantity: Number(quantity),
      price: Number(price),
    }
    try {
      const { data, status } = await request<Trade>('/api/trades', { method: 'POST', body: JSON.stringify(body) })
      setOutcome({ trade: data, duplicate: status === 200 })
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError) setFieldErrors(err.fieldErrors)
    } finally {
      setSubmitting(false)
    }
  }

  function startNewTrade() {
    setClientTradeId(crypto.randomUUID())
    setSymbol('')
    setQuantity('')
    setPrice('')
    setOutcome(undefined)
  }

  if (outcome) {
    return <TradeOutcome outcome={outcome} onNewTrade={startNewTrade} />
  }

  return (
    <>
      <div className="page-header">
        <h1>New trade</h1>
      </div>

      <form className="trade-form" onSubmit={handleSubmit} noValidate>
        {error && <p className="error-banner">{error}</p>}

        <div className="field">
          <label htmlFor="account">Account</label>
          <select
            id="account"
            value={accountCode}
            onChange={(e) => edit('accountCode', setAccountCode, e.target.value)}
          >
            <option value="">Select account</option>
            {accounts.data?.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} – {a.name}
                {a.status === 'SUSPENDED' ? ' (suspended)' : ''}
              </option>
            ))}
          </select>
          <FieldError message={fieldErrors.accountCode} />
        </div>

        <div className="field">
          <label htmlFor="symbol">Symbol</label>
          <select id="symbol" value={symbol} onChange={(e) => edit('symbol', selectSymbol, e.target.value)}>
            <option value="">Select symbol</option>
            {instruments.data?.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol} – {i.name}
                {i.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          {instrument && <span className="hint">Reference price {formatPrice(instrument.referencePrice)}</span>}
          <FieldError message={fieldErrors.symbol} />
        </div>

        <div className="field">
          <span className="label">Side</span>
          <div className="side-toggle" role="radiogroup" aria-label="Side">
            {(['BUY', 'SELL'] as const).map((s) => (
              <label key={s} className={side === s ? `selected side-${s.toLowerCase()}` : ''}>
                <input type="radio" name="side" value={s} checked={side === s} onChange={() => setSide(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="quantity">Quantity</label>
            <input
              id="quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => edit('quantity', setQuantity, e.target.value)}
            />
            <FieldError message={fieldErrors.quantity} />
          </div>
          <div className="field">
            <label htmlFor="price">Price</label>
            <input
              id="price"
              type="number"
              min="0"
              step="0.0001"
              value={price}
              onChange={(e) => edit('price', setPrice, e.target.value)}
            />
            <FieldError message={fieldErrors.price} />
          </div>
        </div>

        <p className="hint">
          Notional: {estimatedNotional > 0 ? formatMoney(estimatedNotional) : '–'}
        </p>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit trade'}
          </button>
          <Link to="/trades" className="btn">
            Cancel
          </Link>
        </div>

        <p className="hint">Client trade ID {clientTradeId}</p>
      </form>
    </>
  )
}

function FieldError({ message }: { message?: string }) {
  return message ? <span className="field-error">{message}</span> : null
}

function TradeOutcome({ outcome, onNewTrade }: { outcome: SubmitOutcome; onNewTrade: () => void }) {
  const { trade, duplicate } = outcome
  return (
    <>
      <div className="page-header">
        <h1>
          Trade {trade.id} <StatusBadge status={trade.status} />
        </h1>
      </div>

      {duplicate && (
        <p className="notice">This trade was already submitted, so the original is shown instead of booking it again.</p>
      )}
      {trade.status === 'REJECTED' && (
        <p className="notice notice-rejected">
          <strong>{trade.rejectionReason}</strong>: {trade.rejectionDetail}
        </p>
      )}

      <p>
        {trade.side} {trade.quantity} {trade.symbol} @ {formatPrice(trade.price)} for {trade.accountCode}, notional{' '}
        {formatMoney(trade.notional)}
        {trade.status === 'ACCEPTED' && <>, settles {trade.settlementDate}</>}.
      </p>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={onNewTrade}>
          Enter another trade
        </button>
        <Link className="btn" to={`/trades/${trade.id}`}>
          View trade
        </Link>
      </div>
    </>
  )
}
