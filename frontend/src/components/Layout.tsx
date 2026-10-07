import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth, useCurrentUser } from '../auth/AuthContext.tsx'
import { formatBusinessDate, todayInNewYork } from '../format.ts'
import { roleLabels } from '../labels.ts'
import { homePath, navigation } from '../navigation.ts'

export default function Layout() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const { pathname } = useLocation()

  // "Trades" should stay highlighted on a trade's detail page, but not on /trades/new,
  // which has its own nav item.
  function isActive(to: string): boolean {
    if (to === '/trades') return pathname === '/trades' || /^\/trades\/\d+/.test(pathname)
    return pathname === to
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to={homePath(user.role)} className="brand">
            Trade Platform
          </Link>
          <nav className="main-nav" aria-label="Main">
            {navigation[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={() => (isActive(item.to) ? 'active' : '')}
                aria-current={isActive(item.to) ? 'page' : undefined}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="topbar-meta">
            <span className="business-date" title="Business date in New York">
              {formatBusinessDate(todayInNewYork())}
            </span>
            <span className="user-chip">
              {user.username}
              <span className="role-tag">{roleLabels[user.role]}</span>
            </span>
            <button className="signout" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="page" id="main">
        <Outlet />
      </main>
    </>
  )
}
