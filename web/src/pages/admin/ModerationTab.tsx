/**
 * 内容审核 tab —— 想法 / 评论 / 举报（单一数据驱动组件）。
 * 由 Novel-KV js/admin-moderation.js + admin.html #tab-moderation 平移。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminApi, thoughtsApi, url } from '../../lib/api'
import { timeAgo } from '../../lib/format'
import { useConfirm, useToast } from '../../components/feedback'
import CustomSelect from '../../components/admin/CustomSelect'

type ModerationMode = 'thoughts' | 'comments' | 'reports'

interface ThoughtRow {
  id: string
  status?: string
  createdAt: number
  novelId: string
  chapterId: string
  novelTitle?: string
  chapterTitle?: string
  paragraphIndex?: number
  selectedText?: string
  thoughtText?: string
  displayName?: string
  avatarUrl?: string
}

interface CommentRow {
  id: string
  status?: string
  createdAt: number
  novelId: string
  novelTitle?: string
  parentId?: string
  userDisplayName?: string
  userUsername?: string
  displayName?: string
  userId?: string
  commentText?: string
  hasSpoiler?: boolean
  likeCount?: number
  reportCount?: number
}

interface ReportRow {
  id: string
  status?: string
  createdAt: number
  commentNovelId?: string
  novelTitle?: string
  commentText?: string
  reporterDisplayName?: string
  reporterUsername?: string
  reportedBy?: string
  reason?: string
  note?: string
}

const MODERATION_REASON_LABELS: Record<string, string> = { spam: '垃圾信息', offensive: '攻击辱骂', spoiler: '剧透', other: '其他' }

const REASON_OPTIONS: Array<[string, string]> = [
  ['all', '全部原因'],
  ['spam', '垃圾信息'],
  ['offensive', '攻击辱骂'],
  ['spoiler', '剧透'],
  ['other', '其他'],
]

interface ModeConfig {
  label: string
  head: string[]
  statusOptions: Array<[string, string]>
  defaultStatus: string
  showUser: boolean
  showReason: boolean
  searchPlaceholder: string
}

const MODERATION_TYPES: Record<ModerationMode, ModeConfig> = {
  thoughts: {
    label: '想法',
    head: ['时间', '小说 / 章节', '段落', '划选文字', '想法', '昵称', '状态', ''],
    statusOptions: [
      ['all', '全部'],
      ['visible', '可见'],
      ['hidden', '已隐藏'],
    ],
    defaultStatus: 'all',
    showUser: true,
    showReason: false,
    searchPlaceholder: '搜索小说/章节/想法…',
  },
  comments: {
    label: '评论',
    head: ['时间', '小说', '用户', '评论', '互动', '状态', ''],
    statusOptions: [
      ['all', '全部'],
      ['visible', '可见'],
      ['hidden', '已隐藏'],
    ],
    defaultStatus: 'all',
    showUser: true,
    showReason: false,
    searchPlaceholder: '搜索小说/用户/评论…',
  },
  reports: {
    label: '举报',
    head: ['时间', '小说', '评论', '举报人', '原因', '状态', ''],
    statusOptions: [
      ['open', '待处理'],
      ['resolved', '已解决'],
      ['dismissed', '已驳回'],
      ['all', '全部'],
    ],
    defaultStatus: 'open',
    showUser: false,
    showReason: true,
    searchPlaceholder: '搜索小说/评论…',
  },
}

type AnyRow = ThoughtRow | CommentRow | ReportRow

function ThoughtUser({ t }: { t: ThoughtRow }) {
  const name = t.displayName || '匿名读者'
  return (
    <span className="thought-admin-user">
      <span className="thought-admin-avatar">
        {t.avatarUrl ? <img src={url(t.avatarUrl)} alt="" onError={(e) => e.currentTarget.remove()} /> : null}
        <span>{name.slice(0, 1)}</span>
      </span>
      <span>{name}</span>
    </span>
  )
}

export default function ModerationTab(_props: { highlightNovelId?: string; onHighlightConsumed?: () => void }) {
  const { toast } = useToast()
  const { confirm } = useConfirm()

  const [mode, setMode] = useState<ModerationMode>('thoughts')
  const [status, setStatus] = useState<string>('all')
  const [reason, setReason] = useState<string>('all')
  const [userInput, setUserInput] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [rows, setRows] = useState<AnyRow[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadingRef = useRef(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cfg = MODERATION_TYPES[mode]

  const load = useCallback(async () => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setError('')
    setRows([])
    setTotal(null)
    try {
      if (mode === 'thoughts') {
        const d = await thoughtsApi.adminList({ status, userId: userQuery, search: searchQuery, limit: '80' })
        setRows((d.thoughts || []) as ThoughtRow[])
        setTotal(d.total || 0)
      } else if (mode === 'comments') {
        const d = await adminApi.comments.list({ status, userId: userQuery, search: searchQuery, limit: '80' })
        setRows((d.comments || []) as CommentRow[])
        setTotal(d.total || 0)
      } else {
        const d = await adminApi.commentReports.list({ status, reason, limit: '80' })
        setRows((d.reports || []) as ReportRow[])
        setTotal(d.total || 0)
      }
    } catch (err) {
      setError((err as Error).message || '未知错误')
      toast(`${MODERATION_TYPES[mode].label}列表加载失败`, 'error')
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [mode, status, reason, userQuery, searchQuery, toast])

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status, reason, userQuery, searchQuery])

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
      if (userTimer.current) clearTimeout(userTimer.current)
    }
  }, [])

  function switchMode(next: ModerationMode) {
    if (next === mode) return
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (userTimer.current) clearTimeout(userTimer.current)
    setMode(next)
    setStatus(MODERATION_TYPES[next].defaultStatus)
    setReason('all')
    setUserInput('')
    setUserQuery('')
    setSearchInput('')
    setSearchQuery('')
  }

  function handleStatusChange(value: string) {
    setStatus(value || 'all')
  }

  function handleReasonChange(value: string) {
    setReason(value || 'all')
  }

  function handleUserChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setUserInput(v)
    if (userTimer.current) clearTimeout(userTimer.current)
    userTimer.current = setTimeout(() => setUserQuery(v.trim()), 250)
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setSearchInput(v)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearchQuery(v.trim()), 250)
  }

  // --- Thoughts actions -------------------------------------------------

  async function updateThoughtStatus(id: string, status: 'visible' | 'hidden') {
    try {
      await thoughtsApi.update(id, { status })
      toast(status === 'visible' ? '已恢复想法' : '已隐藏想法', 'success')
      void load()
    } catch (err) {
      toast((err as Error).message || '操作失败', 'error')
    }
  }

  async function deleteThought(t: ThoughtRow) {
    const ok = await confirm({
      title: '永久删除想法',
      message: '确定永久删除这条想法？此操作不可恢复。',
      okText: '删除',
      danger: true,
      items: [t.thoughtText || t.selectedText || t.id],
    })
    if (!ok) return
    try {
      await thoughtsApi.hardDelete(t.id)
      toast('已删除想法', 'success')
      void load()
    } catch (err) {
      toast((err as Error).message || '删除失败', 'error')
    }
  }

  // --- Comments actions -------------------------------------------------

  async function updateCommentStatus(id: string, status: 'visible' | 'hidden') {
    try {
      await adminApi.comments.update(id, { status })
      toast(status === 'visible' ? '已恢复评论' : '已隐藏评论', 'success')
      void load()
    } catch (err) {
      toast((err as Error).message || '操作失败', 'error')
    }
  }

  async function deleteComment(c: CommentRow) {
    const ok = await confirm({
      title: '永久删除评论',
      message: '确定永久删除这条评论？',
      okText: '删除',
      danger: true,
      items: [c.id],
    })
    if (!ok) return
    try {
      await adminApi.comments.remove(c.id)
      toast('已删除评论', 'success')
      void load()
    } catch (err) {
      toast((err as Error).message || '删除失败', 'error')
    }
  }

  // --- Reports actions --------------------------------------------------

  async function resolveReport(id: string, status: 'resolved' | 'dismissed', action: 'hide' | 'none') {
    try {
      await adminApi.commentReports.update(id, { status, action })
      toast('举报已处理', 'success')
      void load()
    } catch (err) {
      toast((err as Error).message || '处理失败', 'error')
    }
  }

  // --- Row renderers -----------------------------------------------------

  function renderThoughtRow(t: ThoughtRow) {
    const visible = (t.status || 'visible') === 'visible'
    const readable = t.novelId && t.chapterId
    const link = readable ? (
      <Link to={`/read/${encodeURIComponent(t.novelId)}/${encodeURIComponent(t.chapterId)}`}>
        <strong>{t.novelTitle || t.novelId}</strong>
        <br />
        <span className="text-sm text-muted">{t.chapterTitle || t.chapterId}</span>
      </Link>
    ) : (
      <>
        <strong>{t.novelTitle || t.novelId}</strong>
        <br />
        <span className="text-sm text-muted">{t.chapterTitle || t.chapterId}</span>
      </>
    )
    return (
      <tr key={t.id}>
        <td className="text-sm text-muted">{timeAgo(t.createdAt)}</td>
        <td>{link}</td>
        <td>{String((t.paragraphIndex || 0) + 1)}</td>
        <td className="thought-admin-cell">{t.selectedText || '—'}</td>
        <td className="thought-admin-cell">
          <strong>{t.thoughtText || ''}</strong>
        </td>
        <td>
          <ThoughtUser t={t} />
        </td>
        <td>
          <span className={`badge badge--${visible ? 'ongoing' : 'completed'}`}>{visible ? '可见' : '已隐藏'}</span>
        </td>
        <td className="table-actions">
          {visible ? (
            <button className="btn-table btn-hide-thought" title="隐藏" onClick={() => void updateThoughtStatus(t.id, 'hidden')}>
              隐藏
            </button>
          ) : (
            <button className="btn-table btn-restore-thought" title="恢复" onClick={() => void updateThoughtStatus(t.id, 'visible')}>
              恢复
            </button>
          )}
          <button className="btn-table btn-table--delete btn-delete-thought" title="永久删除" onClick={() => void deleteThought(t)}>
            删除
          </button>
        </td>
      </tr>
    )
  }

  function renderCommentRow(c: CommentRow) {
    const visible = (c.status || 'visible') === 'visible'
    return (
      <tr key={c.id}>
        <td className="text-sm text-muted">{timeAgo(c.createdAt)}</td>
        <td>
          {c.novelId ? (
            <Link to={`/novel/${encodeURIComponent(c.novelId)}`}>
              <strong>{c.novelTitle || c.novelId}</strong>
            </Link>
          ) : (
            <strong>{c.novelTitle || c.novelId}</strong>
          )}
          {c.parentId ? (
            <>
              <br />
              <span className="text-sm text-muted">回复</span>
            </>
          ) : null}
        </td>
        <td>{c.userDisplayName || c.userUsername || c.displayName || c.userId}</td>
        <td className="thought-admin-cell">
          <strong>{c.commentText || ''}</strong>
          {c.hasSpoiler ? (
            <>
              <br />
              <span className="spoiler-badge">剧透</span>
            </>
          ) : null}
        </td>
        <td className="text-sm text-muted">
          赞 {c.likeCount || 0}
          <br />
          举报 {c.reportCount || 0}
        </td>
        <td>
          <span className={`badge badge--${visible ? 'ongoing' : 'completed'}`}>{visible ? '可见' : '已隐藏'}</span>
        </td>
        <td className="table-actions">
          {visible ? (
            <button className="btn-table btn-hide-comment" title="隐藏" onClick={() => void updateCommentStatus(c.id, 'hidden')}>
              隐藏
            </button>
          ) : (
            <button className="btn-table btn-restore-comment" title="恢复" onClick={() => void updateCommentStatus(c.id, 'visible')}>
              恢复
            </button>
          )}
          <button className="btn-table btn-table--delete btn-delete-comment" title="永久删除" onClick={() => void deleteComment(c)}>
            删除
          </button>
        </td>
      </tr>
    )
  }

  function renderReportRow(r: ReportRow) {
    const pending = (r.status || 'open') === 'open'
    return (
      <tr key={r.id}>
        <td className="text-sm text-muted">{timeAgo(r.createdAt)}</td>
        <td>
          {r.commentNovelId ? (
            <Link to={`/novel/${encodeURIComponent(r.commentNovelId)}`}>{r.novelTitle || r.commentNovelId || '—'}</Link>
          ) : (
            r.novelTitle || '—'
          )}
        </td>
        <td className="thought-admin-cell">{r.commentText || '评论已删除'}</td>
        <td>{r.reporterDisplayName || r.reporterUsername || r.reportedBy}</td>
        <td>
          {MODERATION_REASON_LABELS[r.reason || ''] || r.reason}
          {r.note ? (
            <>
              <br />
              <span className="text-sm text-muted">{r.note}</span>
            </>
          ) : null}
        </td>
        <td>
          <span className={`badge badge--${pending ? 'ongoing' : 'completed'}`}>{r.status}</span>
        </td>
        <td className="table-actions">
          {pending ? (
            <>
              <button className="btn-table btn-report-hide" title="隐藏并解决" onClick={() => void resolveReport(r.id, 'resolved', 'hide')}>
                隐藏并解决
              </button>
              <button className="btn-table btn-report-resolve" title="解决" onClick={() => void resolveReport(r.id, 'resolved', 'none')}>
                解决
              </button>
              <button className="btn-table btn-report-dismiss" title="驳回" onClick={() => void resolveReport(r.id, 'dismissed', 'none')}>
                驳回
              </button>
            </>
          ) : (
            '—'
          )}
        </td>
      </tr>
    )
  }

  function renderBody() {
    if (loading) {
      return (
        <tr>
          <td colSpan={cfg.head.length} className="table-empty">
            加载中…
          </td>
        </tr>
      )
    }
    if (error) {
      return (
        <tr>
          <td colSpan={cfg.head.length} className="table-empty">
            加载失败：{error}
          </td>
        </tr>
      )
    }
    if (rows.length === 0) {
      return (
        <tr>
          <td colSpan={cfg.head.length} className="table-empty">
            暂无{cfg.label}
          </td>
        </tr>
      )
    }
    return rows.map((r) => {
      if (mode === 'thoughts') return renderThoughtRow(r as ThoughtRow)
      if (mode === 'comments') return renderCommentRow(r as CommentRow)
      return renderReportRow(r as ReportRow)
    })
  }

  return (
    <section className="tab-content">
      <div className="section-header">
        <div className="section-header__titleblock">
          <h2 className="section-title">内容审核</h2>
          <span className="section-header__meta text-sm text-muted">{total !== null ? `共 ${total} 条` : ''}</span>
        </div>
        <div className="thoughts-toolbar">
          <div className="preset-group">
            {(Object.keys(MODERATION_TYPES) as ModerationMode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`preset-btn${mode === m ? ' preset-btn--active' : ''}`}
                onClick={() => switchMode(m)}
              >
                {MODERATION_TYPES[m].label}
              </button>
            ))}
          </div>
          <CustomSelect
            className="admin-input--select-sm"
            compact
            options={cfg.statusOptions.map(([value, label]) => ({ value, label }))}
            value={status}
            onChange={handleStatusChange}
          />
          {cfg.showUser && (
            <input
              type="text"
              className="form-input admin-input--compact admin-input--user"
              placeholder="用户ID"
              value={userInput}
              onChange={handleUserChange}
            />
          )}
          {cfg.showReason && (
            <CustomSelect
              className="admin-input--select-sm"
              compact
              options={REASON_OPTIONS.map(([value, label]) => ({ value, label }))}
              value={reason}
              onChange={handleReasonChange}
            />
          )}
          <input
            type="text"
            className="form-input admin-input--compact admin-input--search-wide"
            placeholder={cfg.searchPlaceholder}
            value={searchInput}
            onChange={handleSearchChange}
          />
          <button className="btn btn--secondary btn--sm" onClick={() => void load()}>
            刷新
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {cfg.head.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>{renderBody()}</tbody>
        </table>
      </div>
    </section>
  )
}
