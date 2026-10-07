import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, apiPut, errorMessage } from '../api/client.ts'
import type { RiskLimit, RiskLimitField } from '../api/types.ts'
import { useApi } from '../api/useApi.ts'
import Dialog from '../components/Dialog.tsx'
import { Banner, ErrorBanner, LoadingRows } from '../components/Feedback.tsx'
import Field, { messageId } from '../components/Field.tsx'
import PageHeader from '../components/PageHeader.tsx'
import { formatDateTime, formatMoney, formatPercent, parseNumber } from '../format.ts'
import { riskFieldLabels } from '../labels.ts'

export default function RiskLimitsPage() {
  const limits = useApi<RiskLimit[]>('/api/risk-limits')
  const [editing, setEditing] = useState<RiskLimit | null>(null)
  const [savedMessage, setSavedMessage] = useState<string>()

  return (
    <>
      <PageHeader
        title="Risk limits"
        subtitle="Checked against every trade before it's accepted. Usage counts today's accepted and settled trades."
      />

      {savedMessage && (
        <Banner
          tone="success"
          action={
            <Link className="btn btn-small" to="/audit-log">
              View audit log
            </Link>
          }
        >
          {savedMessage}
        </Banner>
      )}
      {limits.error && <ErrorBanner message={`Could not load limits. ${limits.error}`} onRetry={limits.reload} />}

      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col" className="num">
                  Max per trade (USD)
                </th>
                <th scope="col" className="num">
                  Max per day (USD)
                </th>
                <th scope="col" className="num">
                  Price tolerance
                </th>
                <th scope="col" className="col-usage">
                  Used today
                </th>
                <th scope="col">Last changed (ET)</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {!limits.data && limits.loading && <LoadingRows columns={7} rows={4} />}
              {limits.data?.map((limit) => (
                <tr key={limit.accountCode}>
                  <td>
                    <span className="strong">{limit.accountCode}</span>
                    <span className="instrument-name">{limit.accountName}</span>
                    {limit.accountStatus === 'SUSPENDED' && <span className="tag tag-muted">Suspended</span>}
                  </td>
                  {limit.version === null ? (
                    <td colSpan={3} className="no-limits">
                      No limits set. Every trade for this account is rejected.
                    </td>
                  ) : (
                    <>
                      <td className="num">{formatMoney(limit.maxTradeNotional!)}</td>
                      <td className="num">{formatMoney(limit.maxDailyNotional!)}</td>
                      <td className="num">{formatPercent(limit.priceTolerancePct!)}</td>
                    </>
                  )}
                  <td className="col-usage">
                    <Usage used={limit.usedToday} limit={limit.maxDailyNotional} />
                  </td>
                  <td className="nowrap">
                    {limit.updatedAt ? (
                      <>
                        <span className="tabular">{formatDateTime(limit.updatedAt)}</span>
                        <span className="instrument-name">by {limit.updatedBy}</span>
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="col-action">
                    <button
                      className={limit.version === null ? 'btn btn-small btn-primary' : 'btn btn-small'}
                      onClick={() => {
                        setSavedMessage(undefined)
                        setEditing(limit)
                      }}
                    >
                      {limit.version === null ? 'Set up limits' : 'Edit'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditLimitsDialog
          limit={editing}
          onClose={() => setEditing(null)}
          onSaved={(changed) => {
            setEditing(null)
            setSavedMessage(
              changed
                ? `Limits for ${editing.accountCode} saved. The new values apply to the next trade.`
                : `No changes to save for ${editing.accountCode}.`,
            )
            limits.reload()
          }}
          onStale={() => {
            setEditing(null)
            limits.reload()
          }}
        />
      )}
    </>
  )
}

function Usage({ used, limit }: { used: number; limit: number | null }) {
  if (limit === null) {
    return <span className="tabular">{formatMoney(used)}</span>
  }
  const pct = (used / limit) * 100
  const level = pct >= 100 ? 'full' : pct >= 80 ? 'high' : 'normal'
  return (
    <div className="usage">
      <div className="usage-numbers">
        <span className="tabular">{formatMoney(used)}</span>
        <span className="usage-pct">{pct.toFixed(0)}%</span>
      </div>
      <div className={`usage-bar usage-${level}`} aria-hidden="true">
        <span style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  )
}

const FIELDS: { field: RiskLimitField; key: 'maxTradeNotional' | 'maxDailyNotional' | 'priceTolerancePct' }[] = [
  { field: 'MAX_TRADE_NOTIONAL', key: 'maxTradeNotional' },
  { field: 'MAX_DAILY_NOTIONAL', key: 'maxDailyNotional' },
  { field: 'PRICE_TOLERANCE_PCT', key: 'priceTolerancePct' },
]

const formatLimit = (field: RiskLimitField, value: number) =>
  field === 'PRICE_TOLERANCE_PCT' ? formatPercent(value) : formatMoney(value)

interface EditProps {
  limit: RiskLimit
  onClose: () => void
  onSaved: (changed: boolean) => void
  onStale: () => void
}

function EditLimitsDialog({ limit, onClose, onSaved, onStale }: EditProps) {
  const isNew = limit.version === null
  const [values, setValues] = useState<Record<string, string>>({
    maxTradeNotional: limit.maxTradeNotional === null ? '' : formatMoney(limit.maxTradeNotional),
    maxDailyNotional: limit.maxDailyNotional === null ? '' : formatMoney(limit.maxDailyNotional),
    priceTolerancePct: limit.priceTolerancePct === null ? '' : limit.priceTolerancePct.toFixed(2),
  })
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string>()
  const [stale, setStale] = useState(false)
  const [saving, setSaving] = useState(false)

  const changes = FIELDS.flatMap(({ field, key }) => {
    const next = parseNumber(values[key])
    const current = limit[key]
    return next !== undefined && next !== current ? [{ field, from: current, to: next }] : []
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    for (const { key } of FIELDS) {
      if (parseNumber(values[key]) === undefined) errors[key] = values[key].trim() ? 'Enter a number' : 'Required'
    }
    if (!reason.trim()) errors.reason = 'Give a reason for the change'
    setFieldErrors(errors)
    setError(undefined)
    if (Object.keys(errors).length > 0) return
    if (changes.length === 0) {
      onSaved(false)
      return
    }

    setSaving(true)
    try {
      await apiPut(`/api/risk-limits/${limit.accountCode}`, {
        maxTradeNotional: parseNumber(values.maxTradeNotional),
        maxDailyNotional: parseNumber(values.maxDailyNotional),
        priceTolerancePct: parseNumber(values.priceTolerancePct),
        reason: reason.trim(),
        version: limit.version,
      })
      onSaved(true)
    } catch (err) {
      setError(errorMessage(err))
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors)
        setStale(err.status === 409)
      }
    } finally {
      setSaving(false)
    }
  }

  function input(key: string, label: string, suffix: string) {
    return (
      <Field id={key} label={label} error={fieldErrors[key]}>
        <div className="input-with-suffix">
          <input
            id={key}
            className="input-number"
            inputMode="decimal"
            autoComplete="off"
            value={values[key]}
            onChange={(e) => {
              setValues({ ...values, [key]: e.target.value })
              setFieldErrors({ ...fieldErrors, [key]: '' })
            }}
            onBlur={() => {
              const n = parseNumber(values[key])
              if (n !== undefined && suffix === 'USD') setValues({ ...values, [key]: formatMoney(n) })
            }}
            aria-invalid={!!fieldErrors[key]}
            aria-describedby={messageId(key)}
          />
          <span className="input-suffix">{suffix}</span>
        </div>
      </Field>
    )
  }

  return (
    <Dialog
      open
      title={`${isNew ? 'Set up' : 'Edit'} limits · ${limit.accountCode} ${limit.accountName}`}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="dialog-body">
          {error && (
            <ErrorBanner message={error} onRetry={stale ? onStale : undefined} retryLabel="Reload limits" />
          )}
          {input('maxTradeNotional', 'Max notional per trade', 'USD')}
          {input('maxDailyNotional', 'Max notional per day', 'USD')}
          {input('priceTolerancePct', 'Price tolerance vs reference price', '%')}

          {changes.length > 0 && (
            <div className="change-preview">
              <p className="change-preview-title">Changes</p>
              <ul>
                {changes.map((c) => (
                  <li key={c.field}>
                    <span>{riskFieldLabels[c.field]}</span>
                    <span className="tabular">
                      {c.from === null ? <span className="muted">not set</span> : formatLimit(c.field, c.from)}
                      {' → '}
                      <strong>{formatLimit(c.field, c.to)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Field id="reason" label="Reason" error={fieldErrors.reason} hint="Saved with the change in the audit log.">
            <textarea
              id="reason"
              rows={2}
              maxLength={255}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setFieldErrors({ ...fieldErrors, reason: '' })
              }}
              aria-invalid={!!fieldErrors.reason}
              aria-describedby={messageId('reason')}
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isNew ? 'Set up limits' : 'Save changes'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
