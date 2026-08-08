import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../app'
import { setDbForTests } from '../db/pool'
import { createTestDb, type TestDb } from '../test/db'

let t: TestDb

beforeAll(async () => {
  t = await createTestDb()
  await t.applyMigrations()
  setDbForTests(t.db)
  process.env.DATABASE_URL = 'postgres://test/test'
  process.env.COVER_FETCH_ENABLED = '0'
})

afterAll(async () => {
  setDbForTests(null)
  delete process.env.DATABASE_URL
  delete process.env.COVER_FETCH_ENABLED
  await t.close()
})

async function req(path: string, init?: RequestInit) {
  return app.request(path, init)
}
async function jsonOf<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}
function json(method: string, body?: unknown, token?: string): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

describe('scrape 路由（免网络动作）', () => {
  let adminToken = ''

  it('bootstrap 管理员（爬虫动作均为 admin-only）', async () => {
    const boot = await req('/api/auth/bootstrap-admin', json('POST', { username: 'admin', password: 'adminpass123' }))
    adminToken = (await jsonOf<{ token: string }>(boot)).token
  })

  it('detect：静态预设命中 czbooks，未命中返回 false', async () => {
    const hit = await req('/api/scrape', json('POST', { action: 'detect', sourceUrl: 'https://www.czbooks.net/n/123/' }, adminToken))
    expect(hit.status).toBe(200)
    const hitData = await jsonOf<{ detected: boolean; source: string; preset: { name: string } }>(hit)
    expect(hitData.detected).toBe(true)
    expect(hitData.source).toBe('preset')
    expect(hitData.preset.name).toBe('小說狂人')

    const miss = await req('/api/scrape', json('POST', { action: 'detect', sourceUrl: 'https://unknown-site.example.com/book/1' }, adminToken))
    const missData = await jsonOf<{ detected: boolean }>(miss)
    expect(missData.detected).toBe(false)
  })

  it('import-legado：解析文本导入书源，list-sources 可查，toggle/delete 生效', async () => {
    const legadoText = JSON.stringify([
      {
        bookSourceUrl: 'https://legado.example.com',
        bookSourceName: '测试源',
        encoding: 1,
        ruleToc: { chapterList: '@css:.list a' },
        ruleContent: { content: '@css:#content' },
      },
    ])
    const imp = await req('/api/scrape', json('POST', { action: 'import-legado', text: legadoText }, adminToken))
    expect(imp.status).toBe(200)
    const impData = await jsonOf<{ success: boolean; imported: number; bySupport: Record<string, number> }>(imp)
    expect(impData.success).toBe(true)
    expect(impData.imported).toBe(1)
    expect(impData.bySupport.full).toBe(1)

    const list = await req('/api/scrape', json('POST', { action: 'list-sources' }, adminToken))
    const listData = await jsonOf<{ sources: Array<{ host: string; chapterList: string; chapterContent: string; enabled: boolean }>; total: number }>(list)
    expect(listData.total).toBe(1)
    const src = listData.sources[0]!
    expect(src.host).toBe('legado.example.com')
    expect(src.chapterList).toBe('.list a')
    expect(src.chapterContent).toBe('#content')
    expect(src.enabled).toBe(true)

    const toggle = await req('/api/scrape', json('POST', { action: 'toggle-source', host: 'legado.example.com', enabled: false }, adminToken))
    expect(toggle.status).toBe(200)
    const del = await req('/api/scrape', json('POST', { action: 'delete-source', host: 'legado.example.com' }, adminToken))
    expect(del.status).toBe(200)
    const after = await req('/api/scrape', json('POST', { action: 'list-sources' }, adminToken))
    const afterData = await jsonOf<{ total: number }>(after)
    expect(afterData.total).toBe(0)
  })

  it('未登录访问 scrape 返回 401', async () => {
    const res = await req('/api/scrape', json('POST', { action: 'detect', sourceUrl: 'https://www.czbooks.net/n/1/' }))
    expect(res.status).toBe(401)
  })
})
