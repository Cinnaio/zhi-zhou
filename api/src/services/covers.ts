/**
 * 封面图片入库与读取 —— 由 Novel-KV _covers.js 平移。
 * 所有封面数据存 novel_covers 表，前端一律走 /api/cover/:id。
 */
import type { Db } from '../db/pool'
import { first } from '../db/query'

export const DEFAULT_COVER_URL = 'https://wap.po18x.vip/17mb/style/noimg.jpg'
export const MAX_COVER_BYTES = 5 * 1024 * 1024

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
}

export interface ImageData {
  data: Uint8Array
  contentType: string
}

export async function fetchImage(url: string): Promise<ImageData | null> {
  if (process.env.COVER_FETCH_ENABLED === '0') return null
  if (!url || !/^https?:\/\//i.test(url)) return null
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS })
    if (!res.ok) return null
    let contentType = res.headers.get('Content-Type') || ''
    const buf = new Uint8Array(await res.arrayBuffer())
    if (!buf.byteLength || buf.byteLength > MAX_COVER_BYTES) return null
    if (!contentType) contentType = 'image/jpeg'
    if (!/^image\//i.test(contentType)) return null
    return { data: buf, contentType }
  } catch {
    return null
  }
}

export async function storeCover(
  db: Db,
  novelId: string,
  data: Uint8Array,
  contentType: string,
  source: string,
): Promise<void> {
  await db.query(
    `INSERT INTO novel_covers (novel_id, data, content_type, source, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (novel_id) DO UPDATE SET
       data = EXCLUDED.data,
       content_type = EXCLUDED.content_type,
       source = EXCLUDED.source,
       updated_at = EXCLUDED.updated_at`,
    [novelId, data, contentType || 'image/jpeg', source || '', Date.now()],
  )
}

export interface StoredCover {
  data: Uint8Array
  content_type: string
  source: string
  updated_at: number
}

export async function getStoredCover(db: Db, novelId: string): Promise<StoredCover | undefined> {
  return first<StoredCover>(db, 'SELECT data, content_type, source, updated_at FROM novel_covers WHERE novel_id = $1', [novelId])
}

/** pg 的 BYTEA 返回 Buffer（Uint8Array 视图），直接可用作 Response body。 */
export function coverDataToBody(data: unknown): Uint8Array | null {
  if (!data) return null
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
  if (Array.isArray(data)) return new Uint8Array(data)
  return null
}

/** 先试源图，失败/无封面则存缺省图。 */
export async function cacheCoverForNovel(
  db: Db,
  novelId: string,
  opts: { defaultImage?: ImageData } = {},
): Promise<{ ok: boolean; error?: string; status?: number; source?: string; contentType?: string; bytes?: number; isDefault?: boolean }> {
  const row = await first<{ cover_url: string }>(db, 'SELECT cover_url FROM novels WHERE id = $1', [novelId])
  if (!row) return { ok: false, error: 'novel not found', status: 404 }

  const coverUrl = (row.cover_url || '').trim()
  let img = await fetchImage(coverUrl)
  let source = coverUrl

  if (!img) {
    img = opts.defaultImage || (await fetchImage(DEFAULT_COVER_URL))
    source = 'default'
  }
  if (!img) return { ok: false, error: '源图与缺省图均下载失败', status: 502 }

  await storeCover(db, novelId, img.data, img.contentType, source)
  return { ok: true, source, contentType: img.contentType, bytes: img.data.byteLength, isDefault: source === 'default' }
}
