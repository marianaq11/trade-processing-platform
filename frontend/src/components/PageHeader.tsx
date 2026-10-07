import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'

interface Props {
  title: ReactNode
  // Plain-text title for the browser tab, needed when `title` contains markup.
  documentTitle?: string
  subtitle?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
}

export default function PageHeader({ title, documentTitle, subtitle, actions, back }: Props) {
  const tabTitle = documentTitle ?? (typeof title === 'string' ? title : undefined)

  useEffect(() => {
    document.title = tabTitle ? `${tabTitle} · Trade Platform` : 'Trade Platform'
  }, [tabTitle])

  return (
    <div className="page-header">
      {back && (
        <Link className="back-link" to={back.to}>
          <span aria-hidden="true">&larr;</span> {back.label}
        </Link>
      )}
      <div className="page-header-row">
        <div>
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </div>
  )
}
