import { useState } from 'react'
import { Link } from 'react-router'
import { apiPost, errorMessage } from '../api/client.ts'
import type { Page, SettlementRun, SettlementStatus, Trade } from '../api/types.ts'
import { useApi } from '../api/useApi.ts'
import { Banner, EmptyState, ErrorBanner, LoadingRows } from '../components/Feedback.tsx'
import PageHeader from '../components/PageHeader.tsx'
import { SideLabel } from '../components/StatusBadge.tsx'
import { formatMoney, formatQuantity, formatTradeId } from '../format.ts'

export default function SettlementPage() {
  const status = useApi<SettlementStatus>('/api/settlement')
  const awaiting = useApi<Page<Trade>>('/api/trades?status=ACCEPTED&sort=settlementDate&direction=asc&size=100')
  const settled = useApi<Page<Trade>>('/api/trades?status=SETTLED&sort=settlementDate&direction=desc&size=10')
  const [running, setRunning] = useState(false)
  const [lastRun, setLastRun] = useState<SettlementRun>()
  const [runError, setRunError] = useState<string>()

  async function runSettlement() {
    setRunning(true)
    setRunError(undefined)
    try {
      setLastRun(await apiPost<SettlementRun>('/api/settlement/run'))
      status.reload()
      awaiting.reload()
      settled.reload()
    } catch (err) {
      setRunError(errorMessage(err))
    } finally {
      setRunning(false)
    }
  }

  const businessDate = status.data?.businessDate
  const dueNow = status.data?.dueNow ?? 0

  return (
    <>
      <PageHeader
        title="Settlement"
        subtitle="Accepted trades settle on their settlement date. The job runs automatically on weekdays at 6:00 PM ET."
      />

      <div className="summary-bar">
        <dl>
          <div>
            <dt>Business date</dt>
            <dd className="tabular">{businessDate ?? '—'}</dd>
          </div>
          <div>
            <dt>Due now</dt>
            <dd className="tabular">{status.data ? dueNow : '—'}</dd>
          </div>
          <div>
            <dt>Settling later</dt>
            <dd className="tabular">{status.data?.awaitingLater ?? '—'}</dd>
          </div>
        </dl>
        <div className="summary-bar-action">
          <button className="btn btn-primary" onClick={runSettlement} disabled={running || !status.data}>
            {running ? 'Running...' : 'Run settlement now'}
          </button>
          <span className="field-hint">Settles everything due on or before {businessDate ?? 'today'}.</span>
        </div>
      </div>

      {lastRun && <RunResult run={lastRun} />}
      {runError && <ErrorBanner message={`Settlement run failed. ${runError}`} />}
      {status.error && <ErrorBanner message={status.error} onRetry={status.reload} />}

      <section className="section">
        <h2 className="section-title">Awaiting settlement</h2>
        <TradeTable
          trades={awaiting.data}
          loading={awaiting.loading}
          error={awaiting.error}
          showDue
          businessDate={businessDate}
          emptyText="Nothing is waiting to settle."
        />
      </section>

      <section className="section">
        <h2 className="section-title">Recently settled</h2>
        <TradeTable
          trades={settled.data}
          loading={settled.loading}
          error={settled.error}
          emptyText="No trades have settled yet."
        />
      </section>
    </>
  )
}

function RunResult({ run }: { run: SettlementRun }) {
  if (run.due === 0) {
    return <Banner tone="info">Nothing was due for settlement on {run.businessDate}.</Banner>
  }
  const extra = [
    run.skipped > 0 && `${run.skipped} skipped because they changed during the run`,
    run.failed > 0 && `${run.failed} failed (see server log)`,
  ].filter(Boolean)
  return (
    <Banner tone={run.failed > 0 ? 'warning' : 'success'}>
      Settled {run.settled} {run.settled === 1 ? 'trade' : 'trades'} for {run.businessDate}.
      {extra.length > 0 && ` ${extra.join(', ')}.`}
    </Banner>
  )
}

interface TableProps {
  trades: Page<Trade> | undefined
  loading: boolean
  error: string | undefined
  showDue?: boolean
  businessDate?: string
  emptyText: string
}

function TradeTable({ trades, loading, error, showDue = false, businessDate, emptyText }: TableProps) {
  const columns = showDue ? 9 : 8

  if (error) return <ErrorBanner message={error} />

  return (
    <div className="table-panel">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Trade</th>
              <th scope="col">Account</th>
              <th scope="col">Instrument</th>
              <th scope="col">Side</th>
              <th scope="col" className="num">
                Quantity
              </th>
              <th scope="col" className="num">
                Notional (USD)
              </th>
              <th scope="col">Trade date</th>
              <th scope="col">{showDue ? 'Settles' : 'Settled'}</th>
              {showDue && <th scope="col">State</th>}
            </tr>
          </thead>
          <tbody>
            {!trades && loading && <LoadingRows columns={columns} rows={3} />}
            {trades?.content.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link className="trade-id" to={`/trades/${t.id}`}>
                    {formatTradeId(t.id)}
                  </Link>
                </td>
                <td title={t.accountName}>{t.accountCode}</td>
                <td>
                  <span className="symbol">{t.symbol}</span>
                </td>
                <td>
                  <SideLabel side={t.side} />
                </td>
                <td className="num">{formatQuantity(t.quantity)}</td>
                <td className="num">{formatMoney(t.notional)}</td>
                <td className="tabular">{t.tradeDate}</td>
                <td className="tabular">{t.settlementDate}</td>
                {showDue && <td>{businessDate && <DueTag settlementDate={t.settlementDate} businessDate={businessDate} />}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {trades && trades.content.length === 0 && <EmptyState title={emptyText} />}
    </div>
  )
}

// ISO dates compare correctly as strings.
function DueTag({ settlementDate, businessDate }: { settlementDate: string; businessDate: string }) {
  if (settlementDate < businessDate) return <span className="tag tag-down">Overdue</span>
  if (settlementDate === businessDate) return <span className="tag tag-due">Due today</span>
  return <span className="tag tag-muted">Upcoming</span>
}
