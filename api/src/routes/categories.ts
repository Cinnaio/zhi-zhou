/** /api/categories —— 全量分类集合（供筛选 UI，独立于小说列表避免每次全表 DISTINCT）。 */
import { Hono } from 'hono'
import { getDb } from '../db/pool'
import { all } from '../db/query'
import { safeJsonParse } from '../db/mappers'

export const categoriesRoutes = new Hono()

categoriesRoutes.get('/', async (c) => {
  const db = getDb()
  const rows = await all<{ categories: string }>(
    db,
    `SELECT DISTINCT categories FROM novels WHERE categories IS NOT NULL AND categories != '[]'`,
  )
  const set = new Set<string>()
  for (const row of rows) {
    try {
      const arr = safeJsonParse<string[]>(row.categories, [])
      arr.forEach((cat) => {
        if (cat) set.add(cat)
      })
    } catch {
      /* skip malformed rows */
    }
  }
  return c.json(
    { categories: [...set].sort((a, b) => a.length - b.length || a.localeCompare(b)) },
    200,
    { 'Cache-Control': 'public, max-age=120' },
  )
})
