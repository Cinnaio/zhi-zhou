/**
 * 阅读设置 hook —— 由 read.js 的 reader-settings 逻辑 + 服务端 LWW 合并平移。
 * 每个设置项带 updatedAt 时间戳，本地与服务端按最后写入胜出合并。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { authApi, getToken } from '../lib/api'

export const FONT_SIZES = ['0.95rem', '1.1rem', '1.25rem', '1.45rem', '1.7rem', '2rem']
export const FONT_LABELS = ['15', '18', '20', '23', '27', '32']
export const LINE_HEIGHTS = ['1.75', '1.95', '2.15']
export const PARAGRAPH_SPACINGS = ['1.0', '1.4', '1.8']
export const PAGE_WIDTHS: Record<string, string> = { narrow: '620px', standard: '680px', wide: '780px' }
export const AUTO_SCROLL_SPEEDS: Record<string, number> = { off: 0, slow: 18, medium: 32, fast: 52 }

export const READER_SETTING_KEYS = [
  'fontSize',
  'fontFamily',
  'readerPageMode',
  'readerTheme',
  'readerLineHeight',
  'readerParagraphSpacing',
  'readerWakeLock',
  'readerPageWidth',
  'readerAutoScrollSpeed',
  'readerClickPaging',
] as const

export type ReaderSettingKey = (typeof READER_SETTING_KEYS)[number]
export type ReaderSettingsMap = Record<string, string>

const SETTING_META_KEY = 'readerSettingsUpdatedAt'

export function readLocalSettings(): ReaderSettingsMap {
  return {
    fontSize: localStorage.getItem('fontSize') ?? '2',
    fontFamily: localStorage.getItem('fontFamily') ?? 'serif',
    readerPageMode: localStorage.getItem('readerPageMode') ?? 'scroll',
    readerTheme: localStorage.getItem('readerTheme') ?? 'default',
    readerLineHeight: localStorage.getItem('readerLineHeight') ?? '1.95',
    readerParagraphSpacing: localStorage.getItem('readerParagraphSpacing') ?? '1.4',
    readerWakeLock: localStorage.getItem('readerWakeLock') ?? 'off',
    readerPageWidth: localStorage.getItem('readerPageWidth') ?? 'standard',
    readerAutoScrollSpeed: localStorage.getItem('readerAutoScrollSpeed') ?? 'off',
    readerClickPaging: localStorage.getItem('readerClickPaging') ?? 'on',
  }
}

function readLocalMeta(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SETTING_META_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeLocalMeta(meta: Record<string, number>): void {
  localStorage.setItem(SETTING_META_KEY, JSON.stringify(meta))
}

function mergeSettings(
  local: ReaderSettingsMap,
  localTimes: Record<string, number>,
  remote: ReaderSettingsMap,
  remoteTimes: Record<string, number>,
): { settings: ReaderSettingsMap; updatedAt: Record<string, number> } {
  const settings: ReaderSettingsMap = { ...remote }
  const updatedAt: Record<string, number> = { ...remoteTimes }
  for (const key of READER_SETTING_KEYS) {
    const lt = Number(localTimes[key]) || 0
    const rt = Number(remoteTimes[key]) || 0
    if (local[key] !== undefined && lt > rt) {
      settings[key] = local[key]
      updatedAt[key] = lt
    }
  }
  return { settings, updatedAt }
}

function newerThanRemote(merged: Record<string, number>, remote: Record<string, number>): boolean {
  return READER_SETTING_KEYS.some((key) => (Number(merged[key]) || 0) > (Number(remote[key]) || 0))
}

export interface ReaderSettingsController {
  settings: ReaderSettingsMap
  ready: boolean
  /** 更新某项设置并持久化 + 防抖同步服务端。 */
  set: (key: ReaderSettingKey, value: string) => void
  fontSize: number
  pageMode: boolean
}

export function useReaderSettings(): ReaderSettingsController {
  const [settings, setSettings] = useState<ReaderSettingsMap>(() => readLocalSettings())
  const [ready, setReady] = useState(false)
  const applyingRef = useRef(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  // 初始化：本地 + 服务端 LWW 合并
  useEffect(() => {
    if (!getToken()) {
      setReady(true)
      return
    }
    let cancelled = false
    void authApi
      .readerSettings()
      .then((data) => {
        if (cancelled) return
        const remote = data.settings || {}
        const remoteTimes = data.updatedAt || {}
        const local = readLocalSettings()
        const localTimes = readLocalMeta()
        const merged = mergeSettings(local, localTimes, remote, remoteTimes)
        writeLocalMeta(merged.updatedAt)
        // 应用合并结果到本地
        for (const key of READER_SETTING_KEYS) {
          if (merged.settings[key] !== undefined) localStorage.setItem(key, merged.settings[key])
        }
        setSettings((prev) => ({ ...prev, ...merged.settings }))
        if (newerThanRemote(merged.updatedAt, remoteTimes)) {
          void authApi
            .updateReaderSettings({ values: merged.settings, updatedAt: merged.updatedAt })
            .then((r) => {
              writeLocalMeta(r.updatedAt || merged.updatedAt)
              setSettings((prev) => ({ ...prev, ...(r.settings || {}) }))
            })
            .catch(() => {})
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback((next: ReaderSettingsMap) => {
    for (const key of READER_SETTING_KEYS) {
      if (next[key] !== undefined) localStorage.setItem(key, next[key])
    }
  }, [])

  const pushToServer = useCallback(() => {
    if (!getToken()) return
    const local = readLocalSettings()
    const meta = readLocalMeta()
    void authApi
      .updateReaderSettings({ values: local, updatedAt: meta })
      .then((r) => {
        writeLocalMeta(r.updatedAt || meta)
        setSettings((prev) => ({ ...prev, ...(r.settings || {}) }))
      })
      .catch(() => {})
  }, [])

  const set = useCallback(
    (key: ReaderSettingKey, value: string) => {
      if (applyingRef.current) return
      const next = { ...settingsRef.current, [key]: value }
      setSettings(next)
      persist(next)
      // touch meta（应用同步来的设置时不动本地时间戳，避免覆盖服务端）
      const meta = readLocalMeta()
      meta[key] = Date.now()
      writeLocalMeta(meta)
      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(pushToServer, 700)
    },
    [persist, pushToServer],
  )

  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current)
    }
  }, [])

  const fontSize = Math.min(Math.max(Number.parseInt(settings.fontSize ?? '2', 10) || 2, 0), FONT_SIZES.length - 1)
  const pageMode = settings.readerPageMode === 'page'

  return { settings, ready, set, fontSize, pageMode }
}
