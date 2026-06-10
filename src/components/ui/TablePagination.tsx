interface TablePaginationProps {
  page: number
  totalPages: number
  totalItems: number
  pageSize: number
  onPageChange: (page: number) => void
}

export function TablePagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: TablePaginationProps) {
  if (totalItems === 0) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className="table-pagination">
      <span className="table-pagination-info">
        {from}–{to} de {totalItems}
      </span>

      <div className="table-pagination-controls">
        <button
          type="button"
          className="table-pagination-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Página anterior"
        >
          ‹
        </button>

        <span className="table-pagination-page">
          Página {page} de {totalPages}
        </span>

        <button
          type="button"
          className="table-pagination-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Página siguiente"
        >
          ›
        </button>
      </div>
    </div>
  )
}
