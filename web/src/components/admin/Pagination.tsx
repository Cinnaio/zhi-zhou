/**
 * 管理后台分页 —— 上一页 / 「第 X / Y 页」/ 跳转输入 / 下一页。
 * 对应 Novel-KV updatePaginationUi 的语义（totalPages<=1 时隐藏）。
 */
import { useState } from 'react'

interface PaginationProps {
  page: number
  totalPages: number
  onPage: (page: number) => void
  className?: string
}

export default function Pagination({ page, totalPages, onPage, className }: PaginationProps) {
  const [jump, setJump] = useState(String(page))

  if (totalPages <= 1) return null

  function goTo(value: number) {
    onPage(Math.min(Math.max(value, 1), totalPages))
  }

  return (
    <div className={`home-pagination admin-pagination ${className || ''}`}>
      <button className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => goTo(page - 1)}>
        上一页
      </button>
      <span className="home-pagination__info">
        第 {page} / {totalPages} 页
      </span>
      <span className="home-pagination__jump">
        跳转{' '}
        <input
          type="number"
          className="form-input"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => {
            setJump(e.target.value)
            const n = Number.parseInt(e.target.value, 10)
            if (Number.isFinite(n) && n >= 1 && n <= totalPages) goTo(n)
          }}
          onBlur={() => setJump(String(page))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const n = Number.parseInt((e.target as HTMLInputElement).value, 10)
              if (Number.isFinite(n)) goTo(n)
            }
          }}
        />{' '}
        页
      </span>
      <button className="btn btn--secondary btn--sm" disabled={page >= totalPages} onClick={() => goTo(page + 1)}>
        下一页
      </button>
    </div>
  )
}
