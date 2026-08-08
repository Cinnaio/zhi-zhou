/** /api/avatar/:id —— 用户头像二进制响应。 */
import { Hono } from 'hono'
import { getDb } from '../db/pool'
import { first } from '../db/query'
import { coverDataToBody } from '../services/covers'

export const avatarRoutes = new Hono()

avatarRoutes.get('/:id', async (c) => {
  const db = getDb()
  const id = c.req.param('id')
  if (!id || id.includes('/')) return c.json({ error: 'Invalid user ID' }, 400)

  const row = await first<{ data: Uint8Array; content_type: string }>(
    db,
    'SELECT data, content_type, updated_at FROM user_avatars WHERE user_id = $1',
    [id],
  )
  const body = coverDataToBody(row?.data)
  if (!body) return c.json({ error: 'Avatar not found' }, 404)

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': row?.content_type || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
})
