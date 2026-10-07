import type { ReactNode } from 'react'

type Tone = 'error' | 'success' | 'info' | 'warning'

export function Banner({ tone, children, action }: { tone: Tone; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={`banner banner-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="banner-text">{children}</div>
      {action && <div className="banner-action">{action}</div>}
    </div>
  )
}

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  message: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <Banner
      tone="error"
      action={
        onRetry && (
          <button type="button" className="btn btn-small" onClick={onRetry}>
            {retryLabel}
          </button>
        )
      }
    >
      {message}
    </Banner>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {children}
    </div>
  )
}

// Placeholder rows shown on first load so the table doesn't jump when data arrives.
export function LoadingRows({ columns, rows = 8 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="loading-row" aria-hidden="true">
          {Array.from({ length: columns }, (_, col) => (
            <td key={col}>
              <span className="skeleton" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
