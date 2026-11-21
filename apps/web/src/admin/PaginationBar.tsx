export function PaginationBar({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  const safeTotal = Math.max(totalPages, 1)
  return (
    <div className="px-5 py-3 border-t border-[var(--admin-border-soft)] flex items-center justify-between gap-3">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        className="admin-btn text-xs disabled:opacity-40"
      >
        Назад
      </button>
      <span className="text-xs admin-muted">
        Стр. {page} из {safeTotal}
      </span>
      <button
        type="button"
        disabled={page >= safeTotal}
        onClick={() => onPage(page + 1)}
        className="admin-btn text-xs disabled:opacity-40"
      >
        Далее
      </button>
    </div>
  )
}