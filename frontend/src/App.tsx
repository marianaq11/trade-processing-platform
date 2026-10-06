import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.tsx'
import TradesPage from './pages/TradesPage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/trades" replace />} />
        <Route path="trades" element={<TradesPage />} />
      </Route>
    </Routes>
  )
}
