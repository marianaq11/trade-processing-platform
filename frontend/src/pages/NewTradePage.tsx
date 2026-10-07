import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, errorMessage, request } from '../api/client.ts'
import type { Account, Instrument, Side, SubmitTradeRequest, Trade } from '../api/types.ts'
import { useApi } from '../api/useApi.ts'
import { Banner, EmptyState, ErrorBanner } from '../components/Feedback.tsx'
import Field, { messageId } from '../components/Field.tsx'
import PageHeader from '../components/PageHeader.tsx'
import StatusBadge, { SideLabel } from '../components/StatusBadge.tsx'
import {
  formatMoney,
  formatPrice,
  formatQuantity,
  formatTradeId,
  nextBusinessDay,
  parseNumber,
  todayInNewYork,
} from '../format.ts'
import { rejectionLabels, statusLabels } from '../labels.ts'

const MAX_QUANTITY = 10_000_000
const MAX_PRICE = 9_999_999.9999

interface Outcome {
  trade: Trade
  duplicate: boolean
}

type Errors = Partial<Record<'accountCode' | 'symbol' | 'quantity' | 'price', string>>

export default function NewTradePage() {
  const accounts = useApi<Account[]>('/api/accounts')
  const instruments = useApi<Instrument[]>('/api/instruments')

  // Generated once per trade, not per click. If the request fails or times out and the user
  // hits Submit again, the backend sees the same ID and won't book the trade twice.
  const [clientTradeId, setClientTradeId] = useState(() => crypto.randomUUID())
  const [side, setSide] = useState<Side>('BUY')
  const [accountCode, setAccountCode] = useState('')
  const [symbol, setSymbol] = useState('')
  const [quantityText, setQuantityText] = useState('')
  const [priceText, setPriceText] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<Errors>({})
  const [outcome, setOutcome] = useState<Outcome>()

  const account = accounts.data?.find((a) => a.code === accountCode)
  const instrument = instruments.data?.find((i) => i.symbol === symbol)
  const quantity = parseNumber(quantityText)
  const price = parseNumber(priceText)
  const notional = quantity && price ? quantity * price : undefined
  const deviationPct =
    instrument && price ? ((price - instrument.referencePrice) / instrument.referencePrice) * 100 : undefined
  const today = todayInNewYork()

  function clearError(field: keyof Errors) {
    setFieldErrors((errors) => ({ ...errors, [field]: undefined }))
  }

  function selectSymbol(value: string) {
    setSymbol(value)
    clearError('symbol')
    const selected = instruments.data?.find((i) => i.symbol === value)
    if (selected && !priceText) setPriceText(formatPrice(selected.referencePrice))
  }

  function validate(): Errors {
    const errors: Errors = {}
    if (!accountCode) errors.accountCode = 'Choose an account'
    if (!symbol) errors.symbol = 'Choose an instrument'
    if (quantity === undefined) errors.quantity = 'Enter a quantity'
    else if (!Number.isInteger(quantity) || quantity <= 0) errors.quantity = 'Must be a whole number of shares'
    else if (quantity > MAX_QUANTITY) errors.quantity = `Can't be more than ${formatQuantity(MAX_QUANTITY)}`
    if (price === undefined) errors.price = 'Enter a price'
    else if (price <= 0) errors.price = 'Must be greater than 0'
    else if (price > MAX_PRICE) errors.price = `Can't be more than ${formatPrice(MAX_PRICE)}`
    else if (!/^\d+(\.\d{1,4})?$/.test(priceText.replace(/,/g, '').trim())) errors.price = 'Use at most 4 decimal places'
    return errors
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    const errors = validate()
    setFieldErrors(errors)
    if (Object.values(errors).some(Boolean)) return

    const body: SubmitTradeRequest = { clientTradeId, accountCode, symbol, side, quantity: quantity!, price: price! }
    setSubmitting(true)
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

  // A new clientTradeId either way: this is a new trade, not a retry of the last one.
  function startNewTrade(keepDetails: boolean) {
    setClientTradeId(crypto.randomUUID())
    if (!keepDetails) {
      setSymbol('')
      setQuantityText('')
      setPriceText('')
    }
    setOutcome(undefined)
    setError(undefined)
    setFieldErrors({})
  }

  const header = (
    <PageHeader
      title="New trade"
      subtitle="US equities, settled T+1. Trades are validated and risk-checked as soon as you submit."
    />
  )

  if (outcome) {
    return (
      <>
        {header}
        <TradeOutcome outcome={outcome} onNewTrade={() => startNewTrade(false)} onAmend={() => startNewTrade(true)} />
      </>
    )
  }

  if (accounts.data?.length === 0) {
    return (
      <>
        {header}
        <EmptyState title="You aren't entitled to trade on any accounts yet.">
          <p className="muted">Entitlements are set up per trader. Ask operations to add the accounts you cover.</p>
        </EmptyState>
      </>
    )
  }

  return (
    <>
      {header}
      <form className="ticket" onSubmit={handleSubmit} noValidate>
        <section className="panel ticket-form" aria-label="Trade details">
          {error && <ErrorBanner message={error} />}

          <fieldset className="side-toggle">
            <legend>Side</legend>
            {(['BUY', 'SELL'] as const).map((s) => (
              <label key={s} className={side === s ? `side-option is-selected side-${s.toLowerCase()}` : 'side-option'}>
                <input type="radio" name="side" value={s} checked={side === s} onChange={() => setSide(s)} />
                {s === 'BUY' ? 'Buy' : 'Sell'}
              </label>
            ))}
          </fieldset>

          <Field
            id="account"
            label="Account"
            error={fieldErrors.accountCode}
            hint={account?.status === 'SUSPENDED' ? 'This account is suspended.' : 'Only accounts you are entitled to trade on.'}
          >
            <select
              id="account"
              value={accountCode}
              onChange={(e) => {
                setAccountCode(e.target.value)
                clearError('accountCode')
              }}
              aria-invalid={!!fieldErrors.accountCode}
              aria-describedby={messageId('account')}
            >
              <option value="">Select an account</option>
              {accounts.data?.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                  {a.status === 'SUSPENDED' ? ' (suspended)' : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field
            id="symbol"
            label="Instrument"
            error={fieldErrors.symbol}
            hint={instrument && `Reference price ${formatPrice(instrument.referencePrice)}`}
          >
            <select
              id="symbol"
              value={symbol}
              onChange={(e) => selectSymbol(e.target.value)}
              aria-invalid={!!fieldErrors.symbol}
              aria-describedby={messageId('symbol')}
            >
              <option value="">Select an instrument</option>
              {instruments.data?.map((i) => (
                <option key={i.symbol} value={i.symbol}>
                  {i.symbol} · {i.name}
                  {i.active ? '' : ' (not tradable)'}
                </option>
              ))}
            </select>
          </Field>

          <div className="field-row">
            <Field id="quantity" label="Quantity (shares)" error={fieldErrors.quantity}>
              <input
                id="quantity"
                className="input-number"
                inputMode="numeric"
                autoComplete="off"
                placeholder="0"
                value={quantityText}
                onChange={(e) => {
                  setQuantityText(e.target.value)
                  clearError('quantity')
                }}
                onBlur={() => quantity !== undefined && Number.isInteger(quantity) && setQuantityText(formatQuantity(quantity))}
                aria-invalid={!!fieldErrors.quantity}
                aria-describedby={messageId('quantity')}
              />
            </Field>
            <Field
              id="price"
              label="Price (USD)"
              error={fieldErrors.price}
              hint={deviationPct !== undefined && <PriceDeviation pct={deviationPct} />}
            >
              <input
                id="price"
                className="input-number"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={priceText}
                onChange={(e) => {
                  setPriceText(e.target.value)
                  clearError('price')
                }}
                aria-invalid={!!fieldErrors.price}
                aria-describedby={messageId('price')}
              />
            </Field>
          </div>
        </section>

        <aside className="panel ticket-summary" aria-label="Summary">
          <h2 className="panel-title">Summary</h2>
          <p className="summary-headline">
            {symbol && quantity ? (
              <>
                <SideLabel side={side} /> {formatQuantity(quantity)} {symbol}
                {price ? ` @ ${formatPrice(price)}` : ''}
              </>
            ) : (
              <span className="muted">Fill in the trade details</span>
            )}
          </p>
          <dl className="summary-list">
            <div>
              <dt>Notional (USD)</dt>
              <dd className="summary-notional">{notional ? formatMoney(notional) : '—'}</dd>
            </div>
            <div>
              <dt>Account</dt>
              <dd>{account ? `${account.code} · ${account.name}` : '—'}</dd>
            </div>
            <div>
              <dt>Trade date</dt>
              <dd>{today}</dd>
            </div>
            <div>
              <dt>Settlement</dt>
              <dd>{nextBusinessDay(today)} (T+1)</dd>
            </div>
          </dl>

          {account?.status === 'SUSPENDED' && (
            <Banner tone="warning">{account.code} is suspended, so this trade will be rejected.</Banner>
          )}
          {instrument && !instrument.active && (
            <Banner tone="warning">{instrument.symbol} is not tradable, so this trade will be rejected.</Banner>
          )}

          <button
            type="submit"
            className={`btn btn-block btn-submit btn-submit-${side.toLowerCase()}`}
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : `Submit ${side === 'BUY' ? 'buy' : 'sell'} trade`}
          </button>
          <p className="client-id-note">
            Client trade ID <code>{clientTradeId.slice(0, 8)}</code>. It's sent with the trade, so retrying after
            an error can't book it twice.
          </p>
        </aside>
      </form>
    </>
  )
}

function PriceDeviation({ pct }: { pct: number }) {
  const rounded = Math.abs(pct) < 0.005 ? 0 : pct
  const text = rounded === 0 ? 'At the reference price' : `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(2)}% vs reference`
  // Tolerance is set per account (5-10% for the demo accounts), so this is only a heads-up.
  return <span className={Math.abs(pct) > 5 ? 'deviation is-far' : 'deviation'}>{text}</span>
}

interface OutcomeProps {
  outcome: Outcome
  onNewTrade: () => void
  onAmend: () => void
}

function TradeOutcome({ outcome, onNewTrade, onAmend }: OutcomeProps) {
  const { trade, duplicate } = outcome
  const rejected = trade.status === 'REJECTED'
  const title = rejected ? 'Trade rejected' : `Trade ${statusLabels[trade.status].toLowerCase()}`

  return (
    <section className={`panel outcome ${rejected ? 'outcome-rejected' : 'outcome-ok'}`} aria-live="polite">
      <div className="outcome-header">
        <h2>{title}</h2>
        <StatusBadge status={trade.status} />
        <Link className="trade-id" to={`/trades/${trade.id}`}>
          {formatTradeId(trade.id)}
        </Link>
      </div>

      {duplicate && (
        <Banner tone="info">
          This trade had already been submitted, so nothing new was booked. Showing the original.
        </Banner>
      )}

      {rejected && trade.rejectionReason && (
        <p className="outcome-reason">
          <strong>{rejectionLabels[trade.rejectionReason]}.</strong> {trade.rejectionDetail}
        </p>
      )}

      <p className="outcome-summary">
        <SideLabel side={trade.side} /> {formatQuantity(trade.quantity)} {trade.symbol} @ {formatPrice(trade.price)} for{' '}
        {trade.accountCode}, notional {formatMoney(trade.notional)} USD.
        {trade.status === 'ACCEPTED' && <> Settles {trade.settlementDate}.</>}
      </p>

      <div className="form-actions">
        {rejected && (
          <button className="btn btn-primary" onClick={onAmend}>
            Amend and resubmit
          </button>
        )}
        <button className={rejected ? 'btn' : 'btn btn-primary'} onClick={onNewTrade}>
          New trade
        </button>
        <Link className="btn" to={`/trades/${trade.id}`}>
          View trade
        </Link>
      </div>
    </section>
  )
}
