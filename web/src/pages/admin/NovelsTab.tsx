/**
 * 小说管理 tab —— 小说列表 / 搜索 / 排序 / 分页 / 增删改 / 批量操作。
 * 由 Novel-KV js/admin-novels.js + admin.html #tab-novels 平移。
 */
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { novelsApi, url, authHeaders } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import { useConfirm, useToast } from '../../components/feedback'
import CustomSelect from '../../components/admin/CustomSelect'
import Pagination from '../../components/admin/Pagination'
import type { Novel } from '@shared/types'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: 'ongoing', label: '连载中' },
  { value: 'completed', label: '已完结' },
]

interface NovelDraft {
  title: string
  author: string
  status: string
  description: string
  coverUrl: string
  categories: string
  sourceUrl: string
}

const EMPTY_DRAFT: NovelDraft = {
  title: '',
  author: '',
  status: 'ongoing',
  description: '',
  coverUrl: '',
  categories: '',
  sourceUrl: '',
}

/** 归一化分类输入：支持中英文逗号/顿号，去重（忽略大小写）。 */
function parseCategories(input: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  String(input || '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      const key = s.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(s)
      }
    })
  return out
}

function getNewCount(n: Novel): number {
  return Math.max(0, (n.remoteChapterCount || 0) - (n.chapterCount || 0))
}

/** 增量更新：scrapeApi 未暴露原始 update action，用本地 fetch 包装。 */
async function scrapeUpdate(novelId: string): Promise<Record<string, unknown>> {
  const res = await fetch(url('/scrape'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action: 'update', novelId }),
  })
  return res.json().catch(() => ({})) as Promise<Record<string, unknown>>
}

export default function NovelsTab({ highlightNovelId, onHighlightConsumed }: { highlightNovelId?: string; onHighlightConsumed?: () => void }) {
  const { toast } = useToast()
  const { confirm } = useConfirm()

  // --- List state ---
  const [novels, setNovels] = useState<Novel[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sortField, setSortField] = useState('updated_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // --- Edit modal state ---
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Novel | null>(null)
  const [draft, setDraft] = useState<NovelDraft>(EMPTY_DRAFT)

  // --- Highlight (jump from detail page "管理") ---
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const consumeRef = useRef(onHighlightConsumed)
  useEffect(() => {
    consumeRef.current = onHighlightConsumed
  }, [onHighlightConsumed])

  // 忽略过期响应（快速切换搜索/排序/翻页时）
  const seqRef = useRef(0)

  // 搜索防抖 250ms → 重置到第 1 页
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, 250)
    return () => clearTimeout(t)
  }, [searchInput])

  const load = useCallback(async () => {
    const seq = ++seqRef.current
    setLoading(true)
    setLoadError('')
    try {
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE, sort: sortField, order: sortOrder }
      if (query) params.search = query
      const data = await novelsApi.list(params)
      if (seq !== seqRef.current) return
      const rows = Array.isArray(data.novels) ? data.novels : []
      const tp = data.totalPages || 1
      setNovels(rows)
      setTotalPages(tp)
      setTotal(data.total || 0)
      // 结果收缩导致越界 → 钳回末页重试
      if (page > tp && tp >= 1 && rows.length === 0) {
        setPage(tp)
        return
      }
    } catch (err) {
      if (seq !== seqRef.current) return
      const msg = (err as Error).message || '请检查网络'
      setLoadError(msg)
      toast('小说列表加载失败：' + msg, 'error')
    } finally {
      if (seq === seqRef.current) setLoading(false)
    }
  }, [page, sortField, sortOrder, query, toast])

  useEffect(() => {
    void load()
  }, [load])

  // 详情页「管理」跳转：按标题搜索使其落在第 1 页
  useEffect(() => {
    if (!highlightNovelId || highlightId === highlightNovelId) return
    setHighlightId(highlightNovelId)
    novelsApi
      .get(highlightNovelId)
      .then((res) => {
        const novel = res && res.novel
        if (novel && novel.title) {
          setSearchInput(novel.title)
          setQuery(novel.title)
          setPage(1)
        }
      })
      .catch(() => {
        /* 目标不存在 → 走下方 fallback 消耗 */
      })
  }, [highlightNovelId, highlightId])

  // 高亮行出现后短暂停留再消耗；目标不在当前页时兜底消耗，避免状态卡死
  useEffect(() => {
    if (!highlightId) return
    if (novels.some((n) => n.id === highlightId)) {
      const t = setTimeout(() => {
        consumeRef.current?.()
        setHighlightId(null)
      }, 1500)
      return () => clearTimeout(t)
    }
    if (!loading && query) {
      const t = setTimeout(() => {
        consumeRef.current?.()
        setHighlightId(null)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [novels, loading, query, highlightId])

  // 高亮行滚动到可视区
  useEffect(() => {
    if (highlightId) {
      document.querySelector('.novel-row--highlight')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, novels])

  // --- Sort ---
  function toggleSort(field: string) {
    if (field === sortField) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortOrder(field === 'title' || field === 'author' ? 'asc' : 'desc')
    }
    setPage(1)
  }

  function thClass(field: string): string {
    const active = sortField === field
    return ['th-sortable', active ? 'th-sortable--active' : '', active && sortOrder === 'asc' ? 'th-sortable--asc' : ''].filter(Boolean).join(' ')
  }

  // --- Selection ---
  const allChecked = novels.length > 0 && novels.every((n) => selected.has(n.id))

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSelectAll(e: ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked
    setSelected((prev) => {
      const next = new Set(prev)
      novels.forEach((n) => {
        if (checked) next.add(n.id)
        else next.delete(n.id)
      })
      return next
    })
  }

  function invertSelection() {
    setSelected((prev) => {
      const next = new Set(prev)
      novels.forEach((n) => {
        if (next.has(n.id)) next.delete(n.id)
        else next.add(n.id)
      })
      return next
    })
  }

  function titleFor(id: string): string {
    const n = novels.find((x) => x.id === id)
    return n ? n.title : id.slice(0, 8)
  }

  // --- Modal ---
  function openModal(novel: Novel | null) {
    setEditing(novel)
    setDraft(
      novel
        ? {
            title: novel.title || '',
            author: novel.author || '',
            status: novel.status || 'ongoing',
            description: novel.description || '',
            coverUrl: novel.coverUrl || '',
            categories: (novel.categories || []).join(', '),
            sourceUrl: novel.sourceUrl || '',
          }
        : EMPTY_DRAFT,
    )
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
  }

  async function handleSave() {
    const title = draft.title.trim()
    const author = draft.author.trim()
    const sourceUrl = draft.sourceUrl.trim()
    if (!title || !author) {
      toast('标题和作者为必填项', 'error')
      return
    }
    const dup = novels.find((n) => n.id !== (editing ? editing.id : null) && (n.title === title || (sourceUrl && n.sourceUrl === sourceUrl)))
    if (dup) {
      const ok = await confirm({
        title: '发现重复小说',
        message: '已存在同名小说，仍要继续保存吗？',
        okText: '继续保存',
        danger: false,
        items: [dup.title],
      })
      if (!ok) return
    }
    const data = {
      title,
      author,
      description: draft.description.trim(),
      coverUrl: draft.coverUrl.trim(),
      categories: parseCategories(draft.categories),
      status: draft.status,
      sourceUrl,
    }
    try {
      if (editing) {
        await novelsApi.update(editing.id, data)
        toast('小说已更新', 'success')
      } else {
        await novelsApi.create(data)
        toast('小说已创建', 'success')
      }
      closeModal()
      void load()
    } catch (err) {
      toast('保存失败: ' + ((err as Error).message || '请检查网络和认证令牌'), 'error')
    }
  }

  // --- Delete ---
  async function handleDelete(novel: Novel) {
    const ok = await confirm({
      title: '删除小说',
      message: '确定删除该小说及其所有章节？此操作不可恢复。',
      okText: '删除',
      danger: true,
      items: [`${novel.title || novel.id} — ${novel.chapterCount || 0} 章`],
    })
    if (!ok) return
    try {
      await novelsApi.remove(novel.id)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(novel.id)
        return next
      })
      toast('小说已删除', 'success')
    } catch (err) {
      toast('删除失败: ' + ((err as Error).message || '请检查网络和认证令牌'), 'error')
    }
    void load()
  }

  async function handleBatchDelete() {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      toast('请先选择小说', 'error')
      return
    }
    const ok = await confirm({
      title: '批量删除小说',
      message: `确定删除以下 ${ids.length} 本小说及其所有章节？此操作不可恢复。`,
      okText: '确认删除',
      danger: true,
      items: ids.map((id) => {
        const n = novels.find((x) => x.id === id)
        return (n ? n.title : id.slice(0, 8)) + (n ? ` — ${n.chapterCount || 0} 章` : '')
      }),
    })
    if (!ok) return
    try {
      const data = await novelsApi.batchDelete(ids)
      toast(`已删除 ${(data as { deleted?: number }).deleted || ids.length} 本小说`, 'success')
    } catch (err) {
      toast('批量删除失败: ' + ((err as Error).message || '请检查网络和认证令牌'), 'error')
    }
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
    void load()
  }

  // --- Batch update (incremental scrape) ---
  async function handleBatchUpdate() {
    const ids = Array.from(selected)
    if (ids.length === 0) {
      toast('请先选择小说', 'error')
      return
    }
    const ok = await confirm({
      title: '批量更新',
      message: `将依次检查以下 ${ids.length} 本小说是否有新章节：`,
      okText: '开始更新',
      danger: false,
      items: ids.map((id) => titleFor(id)),
    })
    if (!ok) return

    toast(`开始批量更新 ${ids.length} 本小说…`)
    let success = 0
    let fail = 0
    for (const id of ids) {
      const label = titleFor(id)
      try {
        const data = await scrapeUpdate(id)
        if (data && (data as { jobId?: string }).jobId) {
          success++
          toast(`✓ ${label} — 更新任务已启动`, 'success')
        } else {
          fail++
          toast(`✕ ${label} — ${(data as { error?: string }).error || '启动失败'}`, 'error')
        }
      } catch (err) {
        fail++
        toast(`✕ ${label} — ${(err as Error).message}`, 'error')
      }
      await new Promise((r) => setTimeout(r, 400))
    }
    toast(`批量更新完成：${success} 个成功, ${fail} 个失败`, fail === 0 ? 'success' : 'error')
    void load()
  }

  const countLabel = query ? `匹配 ${total} 本 · 第${page}/${totalPages}页` : `共 ${total} 本 · 第${page}/${totalPages}页`

  const emptyMessage = query ? `没有匹配「${query}」的小说` : '暂无小说，点击「+ 添加小说」开始'

  return (
    <section className="tab-content">
      <div className="section-header section-header--novels">
        <div className="section-header__titleblock">
          <h2 className="section-title">小说管理</h2>
          <span className="section-header__meta text-sm text-muted">{countLabel}</span>
        </div>
        <div className="novel-toolbar">
          <div className="novel-toolbar__main">
            <input
              type="text"
              className="form-input"
              placeholder="搜索标题/作者…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button className="btn btn--primary btn--sm" onClick={() => openModal(null)}>
              添加小说
            </button>
          </div>
          {selected.size > 0 && (
            <div className="novel-toolbar__batch">
              <span className="novel-toolbar__batch-count text-sm text-muted">已选 {selected.size} 本</span>
              <div className="batch-actions-group">
                <button className="btn btn--secondary btn--sm" onClick={() => void handleBatchUpdate()}>
                  批量更新
                </button>
                <button className="btn btn--secondary btn--sm" onClick={invertSelection}>
                  反选
                </button>
                <button className="btn btn--danger btn--sm" onClick={() => void handleBatchDelete()}>
                  批量删除
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="admin-table__check">
                <input type="checkbox" title="全选" checked={allChecked} onChange={handleSelectAll} />
              </th>
              <th className={thClass('title')} onClick={() => toggleSort('title')}>
                标题<span className="th-sort-caret" aria-hidden="true"></span>
              </th>
              <th className={thClass('author')} onClick={() => toggleSort('author')}>
                作者<span className="th-sort-caret" aria-hidden="true"></span>
              </th>
              <th>分类</th>
              <th>状态</th>
              <th className={thClass('chapter_count')} onClick={() => toggleSort('chapter_count')}>
                章节<span className="th-sort-caret" aria-hidden="true"></span>
              </th>
              <th className={thClass('updated_at')} onClick={() => toggleSort('updated_at')}>
                更新<span className="th-sort-caret" aria-hidden="true"></span>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  加载中…
                </td>
              </tr>
            ) : novels.length === 0 ? (
              <tr>
                <td colSpan={8} className="table-empty">
                  {loadError ? `加载失败：${loadError}` : emptyMessage}
                </td>
              </tr>
            ) : (
              novels.map((n) => (
                <tr key={n.id} className={n.id === highlightId ? 'novel-row--highlight' : undefined}>
                  <td>
                    <input type="checkbox" className="novel-checkbox" checked={selected.has(n.id)} onChange={() => toggleRow(n.id)} />
                  </td>
                  <td>
                    <strong>{n.title}</strong>
                  </td>
                  <td>{n.author}</td>
                  <td className="admin-category-cell">
                    {n.categories && n.categories.length > 0 ? n.categories.map((c) => <span className="tag" key={c}>{c}</span>) : '—'}
                  </td>
                  <td>
                    <span className={`badge badge--${n.status === 'completed' ? 'completed' : 'ongoing'}`}>
                      {n.status === 'completed' ? '已完结' : '连载中'}
                    </span>
                  </td>
                  <td>
                    {n.chapterCount || 0}
                    {getNewCount(n) > 0 && (
                      <span
                        className="badge-update"
                        title={`源站 ${n.remoteChapterCount || 0} 章 / 本地 ${n.chapterCount || 0} 章${n.updateCheckedAt ? `，检查于 ${timeAgo(n.updateCheckedAt)}` : ''}`}
                      >
                        +{getNewCount(n)}
                      </span>
                    )}
                  </td>
                  <td className="text-sm text-muted">{timeAgo(n.updatedAt)}</td>
                  <td className="table-actions">
                    <Link className="btn-table btn-table--read" title="阅读" to={`/novel/${encodeURIComponent(n.id)}`}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 2h12v12H2z" />
                        <line x1="2" y1="6" x2="14" y2="6" />
                        <line x1="6" y1="2" x2="6" y2="14" />
                      </svg>
                    </Link>
                    <button className="btn-table btn-table--edit" title="编辑" onClick={() => openModal(n)}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11.5 2.5a1.5 1.5 0 0 1 2 2l-8 8-3 .5.5-3 8.5-7.5z" />
                      </svg>
                    </button>
                    <button className="btn-table btn-table--delete" title="删除" onClick={() => void handleDelete(n)}>
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2 4 14 4" />
                        <path d="M5 4V2.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5V4" />
                        <path d="M3 4l1 9.5a1 1 0 0 0 1 .5h6a1 1 0 0 0 1-.5L13 4" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={setPage} />

      {modalOpen && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal modal--editor modal--novel-editor">
            <div className="modal__header editor-modal__header novel-editor__header">
              <div className="editor-modal__mark" aria-hidden="true">
                书
              </div>
              <div>
                <div className="editor-modal__eyebrow">小说资料</div>
                <h3 className="modal__title editor-modal__title">{editing ? '编辑小说' : '添加小说'}</h3>
              </div>
              <button className="btn btn--icon btn--ghost editor-modal__close novel-editor__close" aria-label="关闭" onClick={closeModal}>
                &times;
              </button>
            </div>
            <div className="modal__body editor-modal__body novel-editor__body">
              <div className="novel-editor__grid">
                <div className="form-group novel-editor__field novel-editor__field--wide">
                  <label className="form-label">标题</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="小说标题"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </div>
                <div className="form-group novel-editor__field">
                  <label className="form-label">作者</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="作者名"
                    value={draft.author}
                    onChange={(e) => setDraft({ ...draft, author: e.target.value })}
                  />
                </div>
                <div className="form-group novel-editor__field">
                  <label className="form-label">状态</label>
                  <CustomSelect options={STATUS_OPTIONS} value={draft.status} onChange={(v) => setDraft({ ...draft, status: v })} />
                </div>
                <div className="form-group novel-editor__field novel-editor__field--wide">
                  <label className="form-label">简介</label>
                  <textarea
                    className="form-input"
                    rows={5}
                    placeholder="小说简介…"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
                <div className="form-group novel-editor__field novel-editor__field--wide">
                  <label className="form-label">封面 URL</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://..."
                    value={draft.coverUrl}
                    onChange={(e) => setDraft({ ...draft, coverUrl: e.target.value })}
                  />
                  <p className="form-hint">保存时由服务器在后台缓存封面图</p>
                </div>
                <div className="form-group novel-editor__field">
                  <label className="form-label">分类</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="玄幻, 修真, 仙侠"
                    value={draft.categories}
                    onChange={(e) => setDraft({ ...draft, categories: e.target.value })}
                  />
                  <p className="form-hint">多个分类用逗号分隔</p>
                </div>
                <div className="form-group novel-editor__field">
                  <label className="form-label">源网址</label>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="https://..."
                    value={draft.sourceUrl}
                    onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <div className="modal__footer editor-modal__footer novel-editor__footer">
              <button className="btn btn--secondary" onClick={closeModal}>
                取消
              </button>
              <button className="btn btn--primary" onClick={() => void handleSave()}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
