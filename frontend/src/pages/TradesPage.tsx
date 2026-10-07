import { Link, useNavigate, useSearchParams } from 'react-router'
import type { Account, Instrument, Page, StatusCounts, Trade, TradeStatus } from '../api/types.ts'
import { useApi } from '../api/useApi.ts'
import { useCurrentUser } from '../auth/AuthContext.tsx'
import { EmptyState, ErrorBanner, LoadingRows } from '../components/Feedback.tsx'
import PageHeader from '../components/PageHeader.tsx'
import Pagination from '../components/Pagination.tsx'
import StatusBadge, { SideLabel } from '../components/StatusBadge.tsx'
import {
  formatDateTime,
  formatMoney,
  formatPrice,
  formatQuantity,
  formatTime,
  formatTradeId,
  todayInNewYork,
} from '../format.ts'
import { rejectionLabels, statusLabels } from '../labels.ts'

const PAGE_SIZE = 25

// RECEIVED and VALIDATED only exist for a moment while a trade is being processed, so they
// don't get tabs.
const STATUS_TABS: TradeStatus[] = ['ACCEPTED', 'SETTLED', 'REJECTED', 'CANCELLED']

type SortColumn = 'time' | 'notional' | 'settlementDate'

const FILTER_KEYS = ['account', 'symbol', 'side', 'tradeDate'] as const

export default function TradesPage() {
  const user = useCurrentUser()
  const isTrader = user.role === 'TRADER'
  const navigate = useNavigate()

  // Filters, sort and page all live in the URL, so a view can be bookmarked or shared and
  // the back button works as expected.
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const sort = (params.get('sort') ?? 'time') as SortColumn
  const direction = params.get('direction') ?? 'desc'
  const page = Number(params.get('page') ?? 0)

  const filterQuery = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = params.get(key)
    if (value) filterQuery.set(key, value)
  }
  const listQuery = new URLSearchParams(filterQuery)
  if (status) listQuery.set('status', status)
  listQuery.set('sort', sort)
  listQuery.set('direction', direction)
  listQuery.set('page', String(page))
  listQuery.set('size', String(PAGE_SIZE))

  const trades = useApi<Page<Trade>>(`/api/trades?${listQuery}`)
  const counts = useApi<StatusCounts>(`/api/trades/status-counts?${filterQuery}`)
  const accounts = useApi<Account[]>('/api/accounts')
  const instruments = useApi<Instrument[]>('/api/instruments')

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    if (!('page' in changes)) next.delete('page')
    setParams(next)
  }

  function sortBy(column: SortColumn) {
    if (column === sort) {
      update({ direction: direction === 'asc' ? 'desc' : 'asc' })
    } else {
      // Settlement date reads most naturally oldest-first; the others biggest/newest first.
      update({ sort: column, direction: column === 'settlementDate' ? 'asc' : 'desc' })
    }
  }

  function refresh() {
    trades.reload()
    counts.reload()
  }

  const hasFilters = FILTER_KEYS.some((key) => params.get(key))
  const today = todayInNewYork()
  const total = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : undefined
  const columnCount = isTrader ? 10 : 11
  const result = trades.data

  return (
    <>
      <PageHeader
        title="Trades"
        subtitle={isTrader ? 'Trades you have submitted.' : 'All trades across accounts and traders.'}
        actions={
          <>
            {trades.loadedAt && (
              <span className="last-updated" aria-live="polite">
                Updated {formatTime(trades.loadedAt.toISOString())} ET
              </span>
            )}
            <button className="btn" onClick={refresh} disabled={trades.loading}>
              Refresh
            </button>
            {isTrader && (
              <Link className="btn btn-primary" to="/trades/new">
                New trade
              </Link>
            )}
          </>
        }
      />

      <div className="status-tabs" role="group" aria-label="Filter by status">
        <StatusTab label="All" count={total} active={!status} onClick={() => update({ status: null })} />
        {STATUS_TABS.map((s) => (
          <StatusTab
            key={s}
            label={statusLabels[s]}
            count={counts.data?.[s]}
            active={status === s}
            onClick={() => update({ status: s })}
          />
        ))}
      </div>

      <div className="filter-bar">
        <label className="filter filter-wide">
          <span>Account</span>
          <select value={params.get('account') ?? ''} onChange={(e) => update({ account: e.target.value })}>
            <option value="">All accounts</option>
            {accounts.data?.map((a) => (
              <option key={a.code} value={a.code}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="filter">
          <span>Instrument</span>
          <select value={params.get('symbol') ?? ''} onChange={(e) => update({ symbol: e.target.value })}>
            <option value="">All instruments</option>
            {instruments.data?.map((i) => (
              <option key={i.symbol} value={i.symbol}>
                {i.symbol}
              </option>
            ))}
          </select>
        </label>
        <label className="filter filter-narrow">
          <span>Side</span>
          <select value={params.get('side') ?? ''} onChange={(e) => update({ side: e.target.value })}>
            <option value="">Both</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </label>
        <label className="filter">
          <span>Trade date</span>
          <input
            type="date"
            value={params.get('tradeDate') ?? ''}
            max={today}
            onChange={(e) => update({ tradeDate: e.target.value })}
          />
        </label>
        <div className="filter-actions">
          {params.get('tradeDate') !== today && (
            <button className="btn btn-small" onClick={() => update({ tradeDate: today })}>
              Today
            </button>
          )}
          {hasFilters && (
            <button
              className="btn-link"
              onClick={() => update({ account: null, symbol: null, side: null, tradeDate: null })}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {trades.error && <ErrorBanner message={`Could not load trades. ${trades.error}`} onRetry={refresh} />}

      <div className={`table-panel ${trades.loading && result ? 'is-refreshing' : ''}`}>
        <div className="table-scroll">
          <table className="data-table clickable-rows">
            <thead>
              <tr>
                <SortHeader column="time" label="Trade" sort={sort} direction={direction} onSort={sortBy} />
                <th scope="col">Created (ET)</th>
                <th scope="col">Account</th>
                <th scope="col">Instrument</th>
                <th scope="col">Side</th>
                <th scope="col" className="num">
                  Quantity
                </th>
                <th scope="col" className="num">
                  Price
                </th>
                <SortHeader
                  column="notional"
                  label="Notional (USD)"
                  numeric
                  sort={sort}
                  direction={direction}
                  onSort={sortBy}
                />
                <th scope="col">Status</th>
                <SortHeader column="settlementDate" label="Settles" sort={sort} direction={direction} onSort={sortBy} />
                {!isTrader && <th scope="col">Trader</th>}
              </tr>
            </thead>
            <tbody>
              {!result && trades.loading && <LoadingRows columns={columnCount} />}
              {result?.content.map((t) => (
                <tr key={t.id} onClick={() => navigate(`/trades/${t.id}`)}>
                  <td>
                    <Link className="trade-id" to={`/trades/${t.id}`} onClick={(e) => e.stopPropagation()}>
                      {formatTradeId(t.id)}
                    </Link>
                  </td>
                  <td className="nowrap tabular">{formatDateTime(t.createdAt)}</td>
                  <td title={t.accountName}>{t.accountCode}</td>
                  <td>
                    <span className="symbol">{t.symbol}</span>
                    <span className="instrument-name">{t.instrumentName}</span>
                  </td>
                  <td>
                    <SideLabel side={t.side} />
                  </td>
                  <td className="num">{formatQuantity(t.quantity)}</td>
                  <td className="num">{formatPrice(t.price)}</td>
                  <td className="num strong">{formatMoney(t.notional)}</td>
                  <td className="nowrap">
                    <StatusBadge status={t.status} />
                    {t.rejectionReason && (
                      <span className="status-reason" title={t.rejectionDetail ?? undefined}>
                        {rejectionLabels[t.rejectionReason]}
                      </span>
                    )}
                  </td>
                  <td className="nowrap tabular">
                    {t.status === 'ACCEPTED' || t.status === 'SETTLED' ? t.settlementDate : <span className="muted">—</span>}
                  </td>
                  {!isTrader && <td>{t.submittedBy}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {result && result.content.length === 0 && (
          <EmptyState title={emptyTitle(isTrader, hasFilters || !!status)}>
            {hasFilters || status ? (
              <button className="btn btn-small" onClick={() => setParams({})}>
                Show all trades
              </button>
            ) : (
              isTrader && (
                <Link className="btn btn-primary btn-small" to="/trades/new">
                  Enter your first trade
                </Link>
              )
            )}
          </EmptyState>
        )}
      </div>

      {result && <Pagination result={result} onPageChange={(p) => update({ page: String(p) })} />}
    </>
  )
}

function emptyTitle(isTrader: boolean, filtered: boolean): string {
  if (filtered) return 'No trades match these filters.'
  return isTrader ? "You haven't submitted any trades yet." : 'No trades have been booked yet.'
}

function StatusTab(props: { label: string; count: number | undefined; active: boolean; onClick: () => void }) {
  return (
    <button className={props.active ? 'status-tab is-active' : 'status-tab'} aria-pressed={props.active} onClick={props.onClick}>
      {props.label}
      <span className="tab-count">{props.count ?? '–'}</span>
    </button>
  )
}

interface SortHeaderProps {
  column: SortColumn
  label: string
  numeric?: boolean
  sort: SortColumn
  direction: string
  onSort: (column: SortColumn) => void
}

function SortHeader({ column, label, numeric, sort, direction, onSort }: SortHeaderProps) {
  const active = sort === column
  const ariaSort = active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th scope="col" className={numeric ? 'num' : undefined} aria-sort={ariaSort}>
      <button className={active ? 'sort-button is-sorted' : 'sort-button'} onClick={() => onSort(column)}>
        {label}
        <span className="sort-indicator" aria-hidden="true">
          {active ? (direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  )
}
