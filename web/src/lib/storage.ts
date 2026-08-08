/**
 * 本地存储 —— 阅读历史 / 书签 / 书架（由 Novel-KV js/storage.js 平移，类型化）。
 */
import type { LocalBookmark, ReadingHistoryEntry } from '@shared/types'

const HISTORY_KEY = 'novel_reading_history'
const BOOKMARK_KEY = 'novel_bookmarks'
const BOOKSHELF_KEY = 'novel_bookshelf'

function readJSON<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T
  } catch {
    return fallback
  }
}

// ------------------------------------------------------------------
//  阅读历史
// ------------------------------------------------------------------

export function getHistory(): Record<string, ReadingHistoryEntry> {
  return readJSON<Record<string, ReadingHistoryEntry>>(HISTORY_KEY, {})
}

export function saveHistory(novelId: string, data: Partial<ReadingHistoryEntry>): void {
  if (!novelId) return
  const history = getHistory()
  history[novelId] = {
    novelId,
    novelTitle: data.novelTitle || '',
    chapterId: data.chapterId || '',
    chapterTitle: data.chapterTitle || '',
    chapterOrder: data.chapterOrder || 0,
    scrollPercent: data.scrollPercent || 0,
    pageMode: data.pageMode || '',
    pageIndex: data.pageIndex || 0,
    pagePercent: data.pagePercent || 0,
    timestamp: data.timestamp || Date.now(),
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function getNovelHistory(novelId: string): ReadingHistoryEntry | null {
  if (!novelId) return null
  return getHistory()[novelId] || null
}

export function getRecentHistory(limit = 5): ReadingHistoryEntry[] {
  const entries = Object.values(getHistory())
    .filter((h) => h.chapterId)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  const seen = new Set<string>()
  const deduped: ReadingHistoryEntry[] = []
  for (const entry of entries) {
    if (!seen.has(entry.novelId)) {
      seen.add(entry.novelId)
      deduped.push(entry)
    }
  }
  return deduped.slice(0, limit)
}

export function clearHistory(novelId?: string): void {
  if (!novelId) {
    localStorage.setItem(HISTORY_KEY, '{}')
    return
  }
  const history = getHistory()
  if (history[novelId]) {
    delete history[novelId]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  }
}

// ------------------------------------------------------------------
//  书签
// ------------------------------------------------------------------

export function getBookmarks(): LocalBookmark[] {
  return readJSON<LocalBookmark[]>(BOOKMARK_KEY, [])
}

function newBookmarkId(): string {
  return 'bm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
}

export function addBookmark(
  novelId: string,
  novelTitle: string,
  chapterId: string,
  chapterTitle: string,
  chapterOrder: number,
  note?: string,
): LocalBookmark | null {
  if (!novelId || !chapterId) return null
  const bookmarks = getBookmarks()
  const existing = bookmarks.find((b) => b.novelId === novelId && b.chapterId === chapterId)
  if (existing) {
    existing.timestamp = Date.now()
    if (note) existing.note = note
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks))
    return existing
  }
  const bm: LocalBookmark = {
    id: newBookmarkId(),
    novelId,
    novelTitle: novelTitle || '',
    chapterId,
    chapterTitle: chapterTitle || '',
    chapterOrder: chapterOrder || 0,
    note: note || '',
    timestamp: Date.now(),
  }
  bookmarks.push(bm)
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks))
  return bm
}

export function toggleBookmark(
  novelId: string,
  novelTitle: string,
  chapterId: string,
  chapterTitle: string,
  chapterOrder: number,
  note?: string,
): LocalBookmark | null {
  if (!novelId || !chapterId) return null
  const bookmarks = getBookmarks()
  const idx = bookmarks.findIndex((b) => b.novelId === novelId && b.chapterId === chapterId)
  if (idx !== -1) {
    bookmarks.splice(idx, 1)
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks))
    return null // null = 已移除
  }
  const bm: LocalBookmark = {
    id: newBookmarkId(),
    novelId,
    novelTitle: novelTitle || '',
    chapterId,
    chapterTitle: chapterTitle || '',
    chapterOrder: chapterOrder || 0,
    note: note || '',
    timestamp: Date.now(),
  }
  bookmarks.push(bm)
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks))
  return bm
}

export function removeBookmark(bookmarkId: string): boolean {
  if (!bookmarkId) return false
  const bookmarks = getBookmarks()
  const filtered = bookmarks.filter((b) => b.id !== bookmarkId)
  if (filtered.length === bookmarks.length) return false
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(filtered))
  return true
}

export function isBookmarked(novelId: string, chapterId: string): boolean {
  if (!novelId || !chapterId) return false
  return getBookmarks().some((b) => b.novelId === novelId && b.chapterId === chapterId)
}

export function getNovelBookmarks(novelId: string): LocalBookmark[] {
  if (!novelId) return []
  return getBookmarks()
    .filter((b) => b.novelId === novelId)
    .sort((a, b) => b.timestamp - a.timestamp)
}

export function getAllBookmarks(): LocalBookmark[] {
  return getBookmarks().slice().sort((a, b) => b.timestamp - a.timestamp)
}

export function replaceAllBookmarks(bookmarks: LocalBookmark[]): void {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(Array.isArray(bookmarks) ? bookmarks : []))
}

// ------------------------------------------------------------------
//  书架（本地缓存；后端 user_bookshelf 为权威）
// ------------------------------------------------------------------

export interface LocalShelfItem {
  novelId: string
  title: string
  author: string
  chapterCount: number
  updatedAt: number
}

export function getBookshelf(): LocalShelfItem[] {
  return readJSON<LocalShelfItem[]>(BOOKSHELF_KEY, [])
}

export function addToBookshelf(novel: { id: string; title: string; author: string; chapterCount: number }): LocalShelfItem | null {
  if (!novel || !novel.id) return null
  const items = getBookshelf().filter((item) => item.novelId !== novel.id)
  const item: LocalShelfItem = {
    novelId: novel.id,
    title: novel.title || '',
    author: novel.author || '',
    chapterCount: novel.chapterCount || 0,
    updatedAt: Date.now(),
  }
  items.unshift(item)
  localStorage.setItem(BOOKSHELF_KEY, JSON.stringify(items))
  return item
}

export function removeFromBookshelf(novelId: string): void {
  localStorage.setItem(
    BOOKSHELF_KEY,
    JSON.stringify(getBookshelf().filter((item) => item.novelId !== novelId)),
  )
}

export function isInBookshelf(novelId: string): boolean {
  return getBookshelf().some((item) => item.novelId === novelId)
}

export function replaceBookshelf(items: Array<Partial<LocalShelfItem> & { novelTitle?: string }>): void {
  const mapped = (items || [])
    .map((item) => ({
      novelId: item.novelId || '',
      title: item.title || item.novelTitle || '',
      author: item.author || '',
      chapterCount: item.chapterCount || 0,
      updatedAt: item.updatedAt || Date.now(),
    }))
    .filter((item) => item.novelId)
  localStorage.setItem(BOOKSHELF_KEY, JSON.stringify(mapped))
}
