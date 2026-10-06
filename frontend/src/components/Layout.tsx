import { NavLink, Outlet } from 'react-router'

export default function Layout() {
  return (
    <>
      <header className="topbar">
        <span className="topbar-title">Trade Platform</span>
        <nav>
          <NavLink to="/trades" end>
            Trades
          </NavLink>
          <NavLink to="/trades/new">New trade</NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
