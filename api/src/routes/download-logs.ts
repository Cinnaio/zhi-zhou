/**
 * /api/download-logs —— 下载日志（管理员可见；由 Novel-KV download-logs.js 平移）。
 */
import { Hono } from 'hono'
import { getDb } from '../db/pool'
import { all, run } from '../db/query'
import { requireAdmin } from '../middlewares/auth'
import { newId } from '../services/auth'

const TYPES = new Set(['novel_txt', 'novel_txt_batch', 'scrape_configs'])

export const downloadLogsRoutes = new Hono()

downloadLogsRoutes.use('*', requireAdmin())

downloadLogsRoutes.get('/', async (c) => {
  const db = getDb()
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') || '50', 10) || 50, 1), 100)
  const rows = await all<Record<string, unknown>>(db, 'SELECT * FROM download_logs ORDER BY created_at DESC LIMIT $1', [limit])
  return c.json({
    logs: rows.map((row) => ({
      id: String(row.id),
      type: String(row.type || ''),
      targetId: String(row.target_id || ''),
      targetTitle: String(row.target_title || ''),
      itemCount: Number(row.item_count) || 0,
      createdAt: Number(row.created_at) || 0,
    })),
  })
})

downloadLogsRoutes.post('/', async (c) => {
  const db = getDb()
  const body = await c.req.json().catch(() => ({}))
  if (!TYPES.has(String(body.type))) return c.json({ error: 'Invalid log type' }, 400)
  const now = Date.now()
  const id = newId('dl')
  await run(db, 'INSERT INTO download_logs (id, type, target_id, target_title, item_count, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [
    id,
    body.type,
    String(body.targetId || ''),
    String(body.targetTitle || '').slice(0, 200),
    Math.max(Number.parseInt(body.itemCount, 10) || 0, 0),
    now,
  ])
  return c.json({ success: true, id }, 201)
})
