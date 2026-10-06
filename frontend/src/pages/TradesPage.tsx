const columns = ['ID', 'Account', 'Symbol', 'Side', 'Quantity', 'Price', 'Notional', 'Status', 'Submitted']

export default function TradesPage() {
  return (
    <>
      <h1>Trades</h1>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length} className="empty">
              No trades yet.
            </td>
          </tr>
        </tbody>
      </table>
    </>
  )
}
