import type { ReactNode } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router'
import type { Role } from './api/types.ts'
import { useAuth, useCurrentUser } from './auth/AuthContext.tsx'
import { EmptyState } from './components/Feedback.tsx'
import Layout from './components/Layout.tsx'
import PageHeader from './components/PageHeader.tsx'
import { homePath } from './navigation.ts'
import AuditLogPage from './pages/AuditLogPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NewTradePage from './pages/NewTradePage.tsx'
import RiskLimitsPage from './pages/RiskLimitsPage.tsx'
import SettlementPage from './pages/SettlementPage.tsx'
import TradeDetailPage from './pages/TradeDetailPage.tsx'
import TradesPage from './pages/TradesPage.tsx'

export default function App() {
  const { user } = useAuth()

  if (!user) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to={homePath(user.role)} replace />} />
        <Route path="login" element={<Navigate to={homePath(user.role)} replace />} />
        <Route path="trades" element={<TradesPage />} />
        <Route path="trades/new" element={<RequireRole role="TRADER" page={<NewTradePage />} />} />
        <Route path="trades/:id" element={<TradeDetailPage />} />
        <Route path="settlement" element={<RequireRole role="OPERATIONS" page={<SettlementPage />} />} />
        <Route path="risk-limits" element={<RequireRole role="RISK_MANAGER" page={<RiskLimitsPage />} />} />
        <Route path="audit-log" element={<RequireRole role="RISK_MANAGER" page={<AuditLogPage />} />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

// Just avoids showing a page that would only produce 403s. The API checks roles itself.
function RequireRole({ role, page }: { role: Role; page: ReactNode }) {
  const user = useCurrentUser()
  if (user.role !== role) {
    return (
      <>
        <PageHeader title="Not available" />
        <EmptyState title="Your role doesn't have access to this page.">
          <Link to={homePath(user.role)}>Go to your home page</Link>
        </EmptyState>
      </>
    )
  }
  return page
}

function NotFound() {
  const user = useCurrentUser()
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState title="There's nothing at this address.">
        <Link to={homePath(user.role)}>Go to your home page</Link>
      </EmptyState>
    </>
  )
}
