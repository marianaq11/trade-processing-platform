import { Link, useNavigate, useSearchParams } from 'react-router'
import { useApi } from '../api/useApi.ts'
import { useCurrentUser } from '../auth/AuthContext.tsx'
import { TRADE_STATUSES, type Account, type Instrument, type Page, type Trade } from '../api/types.ts'
import StatusBadge from '../components/StatusBadge.tsx'
import { formatDateTime, formatMoney, formatPrice, formatQuantity } from '../format.ts'

const PAGE_SIZE = 25

export default function TradesPage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  // Filters live in the URL so a filtered view can be bookmarked or shared.
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const account = params.get('account') ?? ''
  const symbol = params.get('symbol') ?? ''
  const page = Number(params.get('page') ?? 0)

  const query = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) })
  if (status) query.set('status', status)
  if (account) query.set('account', account)
  if (symbol) query.set('symbol', symbol)

  const trades = useApi<Page<Trade>>(`/api/trades?${query}`)
  const accounts = useApi<Account[]>('/api/accounts')
  const instruments = useApi<Instrument[]>('/api/instruments')

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) {
      next.set(name, value)
    } else {
      next.delete(name)
    }
    if (name !== 'page') next.delete('page')
    setParams(next)
  }

  const result = trades.data
  const hasFilters = status || account || symbol
  const firstRow = result ? result.page * result.size + 1 : 0
  const lastRow = result ? firstRow + result.content.length - 1 : 0

  return (
    <>
      <div className="page-header">
        <h1>Trades</h1>
        <div className="actions">
          <button className="btn" onClick={trades.reload} disabled={trades.loading}>
            Refresh
          </button>
          {user.role === 'TRADER' && (
            <Link className="btn btn-primary" to="/trades/new">
              New trade
            </Link>
          )}
        </div>
      </div>

      <div className="toolbar">
        <label>
          Status
          <select value={status} onChange={(e) => updateParam('status', e.target.value)}>
            <option value="">All</option>
            {TRADE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Account
          <select value={account} onChange={(e) => updateParam('account', e.target.value)}>
            <option value="">All</option>
            {accounts.data?.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          Symbol
          <select value={symbol} onChange={(e) => updateParam('symbol', e.target.value)}>
            <option value="">All</option>
            {instruments.data?.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button className="btn-link" onClick={() => setParams({})}>
            Clear filters
          </button>
        )}
      </div>

      {trades.error && <p className="error-banner">Could not load trades: {trades.error}</p>}

      <div className="table-scroll">
        <table className="data-table clickable-rows">
          <thead>
            <tr>
              <th className="num">ID</th>
              <th>Created</th>
              <th>Account</th>
              <th>Symbol</th>
              <th>Side</th>
              <th className="num">Quantity</th>
              <th className="num">Price</th>
              <th className="num">Notional</th>
              <th>Status</th>
              <th>Rejection reason</th>
              <th>Submitted by</th>
            </tr>
          </thead>
          <tbody>
            {result?.content.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/trades/${t.id}`)}>
                <td className="num">
                  <Link to={`/trades/${t.id}`} onClick={(e) => e.stopPropagation()}>
                    {t.id}
                  </Link>
                </td>
                <td>{formatDateTime(t.createdAt)}</td>
                <td>{t.accountCode}</td>
                <td>{t.symbol}</td>
                <td className={`side-${t.side.toLowerCase()}`}>{t.side}</td>
                <td className="num">{formatQuantity(t.quantity)}</td>
                <td className="num">{formatPrice(t.price)}</td>
                <td className="num">{formatMoney(t.notional)}</td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td className="muted">{t.rejectionReason}</td>
                <td>{t.submittedBy}</td>
              </tr>
            ))}
            {result && result.content.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  {hasFilters ? 'No trades match these filters.' : 'No trades yet.'}
                </td>
              </tr>
            )}
            {!result && trades.loading && (
              <tr>
                <td colSpan={11} className="empty">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result && result.totalElements > 0 && (
        <div className="pagination">
          <span>
            {firstRow}–{lastRow} of {result.totalElements}
          </span>
          <button className="btn" disabled={page === 0} onClick={() => updateParam('page', String(page - 1))}>
            Previous
          </button>
          <button
            className="btn"
            disabled={page + 1 >= result.totalPages}
            onClick={() => updateParam('page', String(page + 1))}
          >
            Next
          </button>
        </div>
      )}
    </>
  )
}
