import { useSearchParams } from 'react-router'
import type { Account, Page, RiskLimitChange, RiskLimitField } from '../api/types.ts'
import { useApi } from '../api/useApi.ts'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/Feedback.tsx'
import PageHeader from '../components/PageHeader.tsx'
import Pagination from '../components/Pagination.tsx'
import { formatDateTime, formatMoney, formatPercent } from '../format.ts'
import { riskFieldLabels } from '../labels.ts'

const PAGE_SIZE = 25

const formatValue = (field: RiskLimitField, value: number) =>
  field === 'PRICE_TOLERANCE_PCT' ? formatPercent(value) : formatMoney(value)

export default function AuditLogPage() {
  const [params, setParams] = useSearchParams()
  const account = params.get('account') ?? ''
  const field = params.get('field') ?? ''
  const page = Number(params.get('page') ?? 0)

  const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (account) query.set('account', account)
  if (field) query.set('field', field)

  const changes = useApi<Page<RiskLimitChange>>(`/api/risk-limit-changes?${query}`)
  const accounts = useApi<Account[]>('/api/accounts')

  function update(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (name !== 'page') next.delete('page')
    setParams(next)
  }

  const result = changes.data
  const filtered = !!(account || field)

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change to an account's risk limits: what changed, who changed it and why. Entries can't be edited."
      />

      <div className="filter-bar">
        <label className="filter filter-wide">
          <span>Account</span>
          <select value={account} onChange={(e) => update('account', e.target.value)}>
            <option value="">All accounts</option>
            {accounts.data?.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Limit</span>
          <select value={field} onChange={(e) => update('field', e.target.value)}>
            <option value="">All limits</option>
            {Object.entries(riskFieldLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {filtered && (
          <div className="filter-actions">
            <button className="btn-link" onClick={() => setParams({})}>
              Clear filters
            </button>
          </div>
        )}
      </div>

      {changes.error && <ErrorBanner message={`Could not load the audit log. ${changes.error}`} onRetry={changes.reload} />}

      <div className={`table-panel ${changes.loading && result ? 'is-refreshing' : ''}`}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Changed (ET)</th>
                <th scope="col">Account</th>
                <th scope="col">Limit</th>
                <th scope="col" className="num">
                  Old value
                </th>
                <th scope="col" className="num">
                  New value
                </th>
                <th scope="col">Change</th>
                <th scope="col">Changed by</th>
                <th scope="col">Reason</th>
              </tr>
            </thead>
            <tbody>
              {!result && changes.loading && <LoadingRows columns={8} rows={6} />}
              {result?.content.map((c) => (
                <tr key={c.id}>
                  <td className="nowrap tabular">{formatDateTime(c.changedAt)}</td>
                  <td>{c.accountCode}</td>
                  <td className="nowrap">{riskFieldLabels[c.field]}</td>
                  <td className="num">
                    {c.oldValue === null ? <span className="muted">not set</span> : formatValue(c.field, c.oldValue)}
                  </td>
                  <td className="num strong">{formatValue(c.field, c.newValue)}</td>
                  <td className="nowrap">
                    <Direction from={c.oldValue} to={c.newValue} />
                  </td>
                  <td>{c.changedBy}</td>
                  <td className="wrap reason-cell">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result && result.content.length === 0 && (
          <EmptyState title={filtered ? 'No changes match these filters.' : 'No risk limits have been changed yet.'} />
        )}
      </div>

      {result && <Pagination result={result} onPageChange={(p) => update('page', String(p))} />}
    </>
  )
}

function Direction({ from, to }: { from: number | null; to: number }) {
  if (from === null) return <span className="tag tag-muted">Initial setup</span>
  return to > from ? (
    <span className="tag tag-up">
      <span aria-hidden="true">▲</span> Raised
    </span>
  ) : (
    <span className="tag tag-down">
      <span aria-hidden="true">▼</span> Lowered
    </span>
  )
}
