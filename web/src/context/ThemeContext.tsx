/**
 * 主题上下文 —— 明暗双主题（由 Novel-KV js/theme.js 的 resolve/apply 逻辑平移）。
 * 首次绘制防 FOUC：index.html 内联脚本先行设置 data-theme，此处负责状态同步与切换。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'theme'
const MEDIA = '(prefers-color-scheme: dark)'

function safeGet(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function safeSet(theme: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* ignore unavailable storage */
  }
}

export function getSystemTheme(): ThemeMode {
  return typeof window.matchMedia === 'function' && window.matchMedia(MEDIA).matches ? 'dark' : 'light'
}

export function resolveTheme(): ThemeMode {
  const saved = safeGet()
  return saved === 'dark' || saved === 'light' ? saved : getSystemTheme()
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
}

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (mode: ThemeMode) => void
  toggleTheme: (event?: { clientX?: number; clientY?: number }) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => resolveTheme())

  // 首帧同步（内联脚本已设置，这里确保与 React 状态一致）
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // 未手动保存时跟随系统
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(MEDIA)
    const onChange = (e: MediaQueryListEvent) => {
      if (!safeGet()) {
        const next: ThemeMode = e.matches ? 'dark' : 'light'
        setThemeState(next)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const setTheme = useCallback((mode: ThemeMode) => {
    safeSet(mode)
    setThemeState(mode)
  }, [])

  const toggleTheme = useCallback(
    (event?: { clientX?: number; clientY?: number }) => {
      const next: ThemeMode = theme === 'dark' ? 'light' : 'dark'
      const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (!document.startViewTransition || reduceMotion) {
        setTheme(next)
        return
      }
      const x = event?.clientX ?? window.innerWidth - 24
      const y = event?.clientY ?? 24
      const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ]
      document.documentElement.classList.add('theme-switching')
      const transition = document.startViewTransition(() => setTheme(next))
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath },
          {
            duration: 360,
            easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
            pseudoElement: '::view-transition-new(root)',
          },
        )
      })
      transition.finished.finally(() => {
        document.documentElement.classList.remove('theme-switching')
      })
    },
    [theme, setTheme],
  )

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
