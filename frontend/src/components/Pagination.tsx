import type { Page } from '../api/types.ts'

interface Props {
  result: Page<unknown>
  onPageChange: (page: number) => void
}

export default function Pagination({ result, onPageChange }: Props) {
  if (result.totalElements === 0) return null

  const first = result.page * result.size + 1
  const last = first + result.content.length - 1

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        {first}–{last} of {result.totalElements}
      </span>
      <div className="pagination-buttons">
        <button className="btn btn-small" disabled={result.page === 0} onClick={() => onPageChange(result.page - 1)}>
          Previous
        </button>
        <span className="pagination-page">
          Page {result.page + 1} of {Math.max(result.totalPages, 1)}
        </span>
        <button
          className="btn btn-small"
          disabled={result.page + 1 >= result.totalPages}
          onClick={() => onPageChange(result.page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  )
}
