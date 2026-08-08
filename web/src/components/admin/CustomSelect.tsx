/**
 * 管理后台自定义下拉（替换原生 select 的自定义组件，类名与 Novel-KV custom-select 一致）。
 * 支持搜索过滤、键盘导航（Arrow/Enter）、点击外部关闭。
 */
import { useEffect, useMemo, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
  /** 次行元信息（如「作者 · N章」），可选 */
  sub?: string
}

interface CustomSelectProps {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  compact?: boolean
  chip?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  /** 搜索过滤（title/author/拼音），默认大小写不敏感子串 */
  filter?: (option: SelectOption, q: string) => boolean
  /** 本地无命中时触发服务端补搜（如全库索引未覆盖） */
  onServerSearch?: (query: string) => void
  className?: string
  disabled?: boolean
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = '请选择',
  compact,
  chip,
  searchable,
  searchPlaceholder = '搜索…',
  filter,
  onServerSearch,
  className,
  disabled,
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const serverSearched = useRef(new Set<string>())

  const selected = options.find((o) => o.value === value)

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.trim().toLowerCase()
    const fn = filter || ((o: SelectOption, qq: string) => o.label.toLowerCase().includes(qq))
    return options.filter((o) => fn(o, q))
  }, [options, query, filter])

  // 本地无命中且未补搜过 → 触发服务端补搜
  useEffect(() => {
    const q = query.trim()
    if (q && filtered.length === 0 && onServerSearch && !serverSearched.current.has(q)) {
      serverSearched.current.add(q)
      onServerSearch(q)
    }
  }, [filtered.length, query, onServerSearch])

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  useEffect(() => {
    if (open && searchable) {
      setQuery('')
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open, searchable])

  useEffect(() => setHighlight(0), [query])

  function toggle() {
    if (disabled) return
    setOpen((o) => !o)
  }

  function pick(o: SelectOption) {
    onChange(o.value)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(filtered.length - 1, h + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(0, h - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = filtered[highlight]
      if (opt) pick(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={[
        'custom-select',
        'custom-select--native',
        compact ? 'custom-select--sm' : '',
        chip ? 'custom-select--chip' : '',
        open ? 'custom-select--open' : '',
        className || '',
      ].join(' ')}
    >
      <button
        type="button"
        className="custom-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={onKeyDown}
        disabled={disabled}
      >
        <span>{selected?.label || placeholder}</span>
        <svg className="custom-select__arrow" viewBox="0 0 10 10" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <polyline points="2 3 5 7 8 3" />
        </svg>
      </button>
      <div className="custom-select__dropdown" role="listbox">
        {searchable && (
          <div className="custom-select__search-wrap">
            <input
              ref={searchRef}
              className="form-input custom-select__search"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="custom-select__empty">没有匹配的选项</div>
        ) : (
          filtered.map((o, i) => (
            <div
              key={o.value}
              className={`custom-select__option${o.value === value ? ' custom-select__option--selected' : ''}${i === highlight ? ' custom-select__option--highlight' : ''}`}
              role="option"
              aria-selected={o.value === value}
              data-value={o.value}
              onClick={() => pick(o)}
              onMouseEnter={() => setHighlight(i)}
            >
              {o.label}
              {o.sub && <span className="custom-select__option-sub">{o.sub}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
