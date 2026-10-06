import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import NewTradePage from './pages/NewTradePage.tsx'
import TradeDetailPage from './pages/TradeDetailPage.tsx'
import TradesPage from './pages/TradesPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/trades" replace />} />
        <Route path="trades" element={<TradesPage />} />
        <Route path="trades/new" element={<NewTradePage />} />
        <Route path="trades/:id" element={<TradeDetailPage />} />
        <Route path="*" element={<p className="muted">Page not found.</p>} />
      </Route>
    </Routes>
  )
}
