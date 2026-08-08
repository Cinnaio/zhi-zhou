/** /api/bookmarks —— 用户书签同步（全量替换模式，由 Novel-KV bookmarks.js 平移）。 */
import { Hono } from 'hono'
import { getDb } from '../db/pool'
import { all, withTx } from '../db/query'
import { requireUser, type AuthEnv } from '../middlewares/auth'

export const bookmarksRoutes = new Hono<AuthEnv>()

bookmarksRoutes.get('/', requireUser(), async (c) => {
  const db = getDb()
  const userId = c.get('user').id
  const rows = await all<Record<string, unknown>>(db, 'SELECT * FROM user_bookmarks WHERE user_id = $1 ORDER BY updated_at DESC', [userId])
  return c.json({ bookmarks: rows.map(rowToBookmark).filter(Boolean) })
})

bookmarksRoutes.put('/', requireUser(), async (c) => {
  const db = getDb()
  const userId = c.get('user').id
  const body = await c.req.json().catch(() => ({}))
  const bookmarks: unknown[] = Array.isArray(body.bookmarks) ? body.bookmarks.slice(0, 500) : []
  const now = Date.now()

  const inserts: Array<[string, unknown[]]> = []
  bookmarks.forEach((raw, i) => {
    const b = raw as Record<string, unknown> | null
    if (!b || !b.novelId || !b.chapterId) return
    const ts = Number(b.timestamp) || now
    inserts.push([
      `INSERT INTO user_bookmarks (id, user_id, novel_id, novel_title, chapter_id, chapter_title, chapter_order, note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        userId + '_' + (cleanId(b.id) || 'bm_' + now + '_' + i),
        userId,
        clean(b.novelId, 80),
        clean(b.novelTitle, 200),
        clean(b.chapterId, 80),
        clean(b.chapterTitle, 200),
        Number(b.chapterOrder) || 0,
        clean(b.note, 300),
        ts,
        ts,
      ],
    ])
  })

  await withTx(db, async (q) => {
    await q('DELETE FROM user_bookmarks WHERE user_id = $1', [userId])
    for (const [sql, p] of inserts) await q(sql, p)
  })
  return c.json({ success: true, count: bookmarks.length })
})

function rowToBookmark(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    novelId: String(row.novel_id),
    novelTitle: String(row.novel_title || ''),
    chapterId: String(row.chapter_id),
    chapterTitle: String(row.chapter_title || ''),
    chapterOrder: Number(row.chapter_order) || 0,
    note: String(row.note || ''),
    timestamp: Number(row.updated_at),
  }
}

function clean(value: unknown, max: number): string {
  return String(value || '').replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, max)
}

function cleanId(value: unknown): string {
  return clean(value, 80).replace(/[^a-zA-Z0-9_-]/g, '')
}
