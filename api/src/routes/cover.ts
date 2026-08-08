/** /api/cover/:id —— 封面二进制响应（首次读取时懒缓存源图/缺省图）。 */
import { Hono } from 'hono'
import { getDb } from '../db/pool'
import { cacheCoverForNovel, coverDataToBody, getStoredCover } from '../services/covers'

export const coverRoutes = new Hono()

coverRoutes.get('/:id', async (c) => {
  const db = getDb()
  const id = c.req.param('id')
  if (!id || id.includes('/')) return c.json({ error: 'Invalid novel ID' }, 400)

  let cover = await getStoredCover(db, id)
  // 懒迁移：首次读取时下载源封面（或缺省图）入库
  if (!cover) {
    const cached = await cacheCoverForNovel(db, id)
    if (!cached.ok) return c.json({ error: cached.error || 'Cover not found' }, (cached.status || 404) as 404)
    cover = await getStoredCover(db, id)
  }

  const body = coverDataToBody(cover?.data)
  if (!body) return c.json({ error: 'Cover not found' }, 404)

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': cover?.content_type || 'image/jpeg',
      'Cache-Control': cover?.source === 'default' ? 'public, max-age=86400' : 'public, max-age=31536000, immutable',
    },
  })
})
