import { NavLink, Outlet } from 'react-router'
import { useAuth, useCurrentUser } from '../auth/AuthContext.tsx'

const roleLabels = {
  TRADER: 'Trader',
  OPERATIONS: 'Operations',
  RISK_MANAGER: 'Risk',
}

export default function Layout() {
  const user = useCurrentUser()
  const { logout } = useAuth()

  return (
    <>
      <header className="topbar">
        <span className="topbar-title">Trade Platform</span>
        <nav>
          <NavLink to="/trades" end>
            Trades
          </NavLink>
          {user.role === 'TRADER' && <NavLink to="/trades/new">New trade</NavLink>}
        </nav>
        <div className="topbar-user">
          <span>
            {user.username} <span className="role">{roleLabels[user.role]}</span>
          </span>
          <button className="btn-link" onClick={logout}>
            Log out
          </button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
