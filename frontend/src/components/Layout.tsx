import { NavLink, Outlet } from 'react-router'

export default function Layout() {
  return (
    <>
      <header className="topbar">
        <span className="topbar-title">Trade Platform</span>
        <nav>
          <NavLink to="/trades">Trades</NavLink>
        </nav>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
