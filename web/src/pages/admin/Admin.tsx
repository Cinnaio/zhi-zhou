/**
 * 管理后台外壳 —— 侧边栏导航 + 8 个 tab + 管理员鉴权门。
 * 由 Novel-KV admin.html + admin-core.js 平移；不套用前台 Layout（无 SiteHeader）。
 */
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useSession } from '../../context/SessionContext'
import { useTheme } from '../../context/ThemeContext'
import DashboardTab from './DashboardTab'
import NovelsTab from './NovelsTab'
import ChaptersTab from './ChaptersTab'
import ScrapeTab from './ScrapeTab'
import JobsTab from './JobsTab'
import ModerationTab from './ModerationTab'
import SettingsTab from './SettingsTab'
import RulesTab from './RulesTab'

const TABS: Array<{ id: string; label: string; icon: React.ReactNode }> = [
  {
    id: 'dashboard',
    label: '总览',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="3" width="5" height="5" rx="1" />
        <rect x="10.5" y="3" width="5" height="5" rx="1" />
        <rect x="2.5" y="10" width="5" height="5" rx="1" />
        <path d="M11 14.5h4M13 10.5v4" />
      </svg>
    ),
  },
  {
    id: 'novels',
    label: '小说管理',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="14" height="14" rx="2" />
        <line x1="9" y1="2" x2="9" y2="16" />
      </svg>
    ),
  },
  {
    id: 'chapters',
    label: '章节管理',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="5" x2="14" y2="5" />
        <line x1="4" y1="9" x2="14" y2="9" />
        <line x1="4" y1="13" x2="10" y2="13" />
      </svg>
    ),
  },
  {
    id: 'scrape',
    label: '爬虫抓取',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10v3a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" />
        <polyline points="5 6 9 2 13 6" />
        <line x1="9" y1="2" x2="9" y2="12" />
      </svg>
    ),
  },
  {
    id: 'jobs',
    label: '任务管理',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="10" r="6" />
        <polyline points="9 7 9 10 11 12" />
        <path d="M5 3l1-1 2 2M13 3l-1-1-2 2" />
      </svg>
    ),
  },
  {
    id: 'moderation',
    label: '内容审核',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2a7 7 0 0 1 7 7 7 7 0 0 1-7 7c-1 0-2-.2-2.9-.6L2 17l1.6-3.1C2.6 12.8 2 11.5 2 10a7 7 0 0 1 7-7z" />
        <line x1="6.5" y1="9" x2="11.5" y2="9" />
        <line x1="6.5" y1="12" x2="9.5" y2="12" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: '账户与注册',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3.5" y="7.5" width="11" height="8" rx="1.5" />
        <path d="M6 7.5V5a3 3 0 0 1 6 0v2.5" />
        <circle cx="9" cy="11" r="1" />
      </svg>
    ),
  },
  {
    id: 'rules',
    label: '解析规则',
    icon: (
      <svg className="admin__nav-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="6" r="2.5" />
        <path d="M4 14a4 4 0 0 1 10 0" />
        <line x1="9" y1="9" x2="9" y2="12" />
      </svg>
    ),
  },
]

export interface AdminTabProps {
  highlightNovelId?: string
  onHighlightConsumed?: () => void
}

const TAB_COMPONENTS: Record<string, React.ComponentType<AdminTabProps>> = {
  dashboard: DashboardTab,
  novels: NovelsTab,
  chapters: ChaptersTab,
  scrape: ScrapeTab,
  jobs: JobsTab,
  moderation: ModerationTab,
  settings: SettingsTab,
  rules: RulesTab,
}

const TAB_KEY = 'admin_active_tab'

export default function Admin() {
  const { user, loading } = useSession()
  const { toggleTheme } = useTheme()
  const [active, setActive] = useState<string>(() => localStorage.getItem(TAB_KEY) || 'dashboard')

  // 激活 tab 持久化（与原版 admin_active_tab 一致）
  useEffect(() => {
    localStorage.setItem(TAB_KEY, active)
  }, [active])

  // 从小说详情页「管理」跳转：聚焦 novels tab 并高亮目标行
  const [highlightNovelId, setHighlightNovelId] = useState<string>(() => {
    try {
      return sessionStorage.getItem('adminEditNovel') ? (JSON.parse(sessionStorage.getItem('adminEditNovel')!) as { id?: string }).id || '' : ''
    } catch {
      return ''
    }
  })
  useEffect(() => {
    if (highlightNovelId) {
      sessionStorage.removeItem('adminEditNovel')
      setActive('novels')
    }
  }, [highlightNovelId])

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner--lg"></div>
      </div>
    )
  }

  // 未登录或非管理员 → 鉴权门
  if (!user || user.role !== 'admin') {
    return (
      <main className="admin-auth-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-secondary)' }}>
        <div className="auth-overlay" style={{ position: 'static', display: 'grid', placeItems: 'center' }}>
          <div className="auth-overlay__card">
            <div className="auth-overlay__icon">
              <span className="auth-overlay__emoji">舟</span>
            </div>
            <h1 className="auth-overlay__title">知舟</h1>
            <p className="auth-overlay__desc">{user ? '当前账号没有管理权限' : '请先登录管理员账号'}</p>
            <Link to="/auth" className="btn btn--primary" style={{ marginTop: 16 }}>
              {user ? '切换账号' : '前往登录'}
            </Link>
            <Link to="/" className="auth-overlay__back">
              ← 返回首页
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const TabComponent = TAB_COMPONENTS[active] || DashboardTab

  return (
    <main className="page-admin" style={{ minHeight: '100vh' }}>
      <div className="admin">
        <nav className="admin__sidebar">
          <div className="admin__sidebar-head">
            <span className="admin__sidebar-head-emoji">舟</span>
            管理面板
          </div>
          <div className="admin__nav-group">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`admin__nav-item${active === tab.id ? ' admin__nav-item--active' : ''}`}
                onClick={() => setActive(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="admin__sidebar-bottom">
            <div className="admin__sidebar-row">
              <Link to="/" className="admin__sidebar-home">
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 9l7-7 7 7" />
                  <path d="M4 7v7a1 1 0 0 0 1 1h2v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4h2a1 1 0 0 0 1-1V7" />
                </svg>
                回主页
              </Link>
              <button className="admin__theme-btn" aria-label="切换主题" onClick={toggleTheme}>
                <svg className="theme-icon theme-icon--sun" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="9" r="3.5" />
                  <line x1="9" y1="1" x2="9" y2="3" />
                  <line x1="9" y1="15" x2="9" y2="17" />
                  <line x1="1" y1="9" x2="3" y2="9" />
                  <line x1="15" y1="9" x2="17" y2="9" />
                  <line x1="3.4" y1="3.4" x2="4.8" y2="4.8" />
                  <line x1="13.2" y1="13.2" x2="14.6" y2="14.6" />
                  <line x1="3.4" y1="14.6" x2="4.8" y2="13.2" />
                  <line x1="13.2" y1="4.8" x2="14.6" y2="3.4" />
                </svg>
                <svg className="theme-icon theme-icon--moon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 10.5A6 6 0 0 1 7.5 3.5 6 6 0 1 0 14.5 10.5z" />
                </svg>
              </button>
            </div>
          </div>
        </nav>
        <main className="admin__main">
          <TabComponent highlightNovelId={highlightNovelId} onHighlightConsumed={() => setHighlightNovelId('')} />
        </main>
      </div>
    </main>
  )
}

export { TAB_KEY }
