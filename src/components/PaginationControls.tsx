import { useEffect, useState } from 'react'

export const LIST_PAGE_SIZE = 10

export function useListPagination<T>(items: readonly T[], resetKey?: string | number) {
  const [requestedPage, setRequestedPage] = useState(1)

  useEffect(() => {
    setRequestedPage(1)
  }, [items.length, resetKey])

  const pageCount = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE))
  const page = Math.min(requestedPage, pageCount)
  const start = (page - 1) * LIST_PAGE_SIZE

  return {
    items: items.slice(start, start + LIST_PAGE_SIZE),
    page,
    pageCount,
    total: items.length,
    setPage: setRequestedPage,
  }
}

type PaginationControlsProps = {
  page: number
  pageCount: number
  total: number
  onPageChange: (page: number) => void
}

export default function PaginationControls({
  page,
  pageCount,
  total,
  onPageChange,
}: PaginationControlsProps) {
  if (total <= LIST_PAGE_SIZE) return null

  const firstItem = (page - 1) * LIST_PAGE_SIZE + 1
  const lastItem = Math.min(page * LIST_PAGE_SIZE, total)

  return (
    <div className="database-pagination" role="navigation" aria-label="List pages">
      <span>{firstItem}–{lastItem} of {total}</span>
      <div>
        <button
          type="button"
          className="btn btn-outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <span aria-live="polite">Page {page} of {pageCount}</span>
        <button
          type="button"
          className="btn btn-outline"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
