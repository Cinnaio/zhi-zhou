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

describe('社交 API 端到端（pglite）', () => {
  let adminToken = ''
  let readerToken = ''
  let novelId = ''
  let chapterId = ''
  let commentId = ''

  it('准备数据：管理员、读者、小说、章节', async () => {
    const boot = await req('/api/auth/bootstrap-admin', json('POST', { username: 'admin', password: 'adminpass123' }))
    adminToken = (await jsonOf<{ token: string }>(boot)).token

    await t.db.query('INSERT INTO invites (code, created_at) VALUES ($1, $2)', ['SOCIAL-INVITE', Date.now()])
    const reg = await req('/api/auth/register', json('POST', { username: 'reader', password: 'readerpass1', invite: 'SOCIAL-INVITE' }))
    readerToken = (await jsonOf<{ token: string }>(reg)).token

    const created = await req('/api/novels', json('POST', { title: '社交测试书', author: '某作者', categories: ['现言'] }, adminToken))
    novelId = (await jsonOf<{ novel: { id: string } }>(created)).novel.id
    const chapter = await req('/api/chapters', json('POST', { novelId, title: '第一章', content: '正文内容' }, adminToken))
    chapterId = (await jsonOf<{ chapter: { id: string } }>(chapter)).chapter.id
  })

  it('评论：创建（含回复）、列表、点赞/取消、举报', async () => {
    const created = await req('/api/comments', json('POST', { novelId, text: '这本书很好看' }, readerToken))
    expect(created.status).toBe(201)
    const { comment } = await jsonOf<{ comment: { id: string; commentText: string; canEdit: boolean } }>(created)
    commentId = comment.id
    expect(comment.commentText).toBe('这本书很好看')
    expect(comment.canEdit).toBe(true)

    // 回复
    const reply = await req('/api/comments', json('POST', { novelId, parentId: commentId, text: '同感' }, readerToken))
    expect(reply.status).toBe(201)

    // 列表含 replies
    const list = await req(`/api/comments?novelId=${novelId}`)
    const listData = await jsonOf<{ comments: Array<{ id: string; replies: unknown[]; userLiked: boolean }> }>(list)
    expect(listData.comments.length).toBe(1)
    expect(listData.comments[0]!.replies.length).toBe(1)

    // 点赞 / 取消
    const like = await req(`/api/comments/${commentId}/like`, json('POST', undefined, readerToken))
    const likeData = await jsonOf<{ likeCount: number; userLiked: boolean }>(like)
    expect(likeData.likeCount).toBe(1)
    expect(likeData.userLiked).toBe(true)
    const unlike = await req(`/api/comments/${commentId}/like`, json('DELETE', undefined, readerToken))
    const unlikeData = await jsonOf<{ likeCount: number; userLiked: boolean }>(unlike)
    expect(unlikeData.likeCount).toBe(0)
    expect(unlikeData.userLiked).toBe(false)

    // 举报：重复举报 409
    const report = await req(`/api/comments/${commentId}/report`, json('POST', { reason: 'spam' }, readerToken))
    expect(report.status).toBe(201)
    const again = await req(`/api/comments/${commentId}/report`, json('POST', { reason: 'spam' }, readerToken))
    expect(again.status).toBe(409)
  })

  it('评论：本人编辑、软删除；匿名无法创建', async () => {
    const edit = await req('/api/comments', json('PUT', { id: commentId, text: '这本书真的很好看' }, readerToken))
    expect(edit.status).toBe(200)

    const anon = await req('/api/comments', json('POST', { novelId, text: '游客评论' }))
    expect(anon.status).toBe(401)

    const del = await req(`/api/comments?id=${commentId}`, json('DELETE', undefined, readerToken))
    expect(del.status).toBe(200)
    const list = await req(`/api/comments?novelId=${novelId}`)
    const listData = await jsonOf<{ comments: unknown[] }>(list)
    expect(listData.comments.length).toBe(0) // 软删除后不可见
  })

  it('评分：汇总、提交、更新、删除', async () => {
    const summary = await req(`/api/ratings?novelId=${novelId}`, json('GET', undefined, readerToken))
    const s0 = await jsonOf<{ count: number; average: number; myRating: unknown }>(summary)
    expect(s0.count).toBe(0)

    const post = await req('/api/ratings', json('POST', { novelId, rating: 5 }, readerToken))
    const s1 = await jsonOf<{ count: number; average: number; myRating: number }>(post)
    expect(s1.count).toBe(1)
    expect(s1.average).toBe(5)
    expect(s1.myRating).toBe(5)

    const update = await req('/api/ratings', json('POST', { novelId, rating: 3 }, readerToken))
    const s2 = await jsonOf<{ average: number; myRating: number }>(update)
    expect(s2.average).toBe(3)
    expect(s2.myRating).toBe(3)

    const del = await req(`/api/ratings?novelId=${novelId}`, json('DELETE', undefined, readerToken))
    const s3 = await jsonOf<{ count: number; myRating: unknown }>(del)
    expect(s3.count).toBe(0)
    expect(s3.myRating).toBeNull()
  })

  it('段评：公开列表、我的、本人隐藏', async () => {
    const created = await req('/api/thoughts', json('POST', { novelId, chapterId, paragraphIndex: 2, thoughtText: '这里写得不错' }, readerToken))
    expect(created.status).toBe(201)
    const { thought } = await jsonOf<{ thought: { id: string; userId: string } }>(created)
    expect(thought.userId).toBeTruthy()

    const list = await req(`/api/thoughts?chapterId=${chapterId}`)
    const listData = await jsonOf<{ thoughts: Array<{ id: string }>; counts: Record<string, number> }>(list)
    expect(listData.thoughts.length).toBe(1)
    expect(listData.counts['2']).toBe(1)

    // 章节不属于该小说 → 400
    const wrongNovel = await req('/api/thoughts', json('POST', { novelId: 'novel_x', chapterId, thoughtText: '错书' }, readerToken))
    expect(wrongNovel.status).toBe(400)

    // 本人隐藏
    const hide = await req(`/api/thoughts?id=${thought.id}`, json('DELETE', undefined, readerToken))
    expect(hide.status).toBe(200)
    const after = await req(`/api/thoughts?chapterId=${chapterId}`)
    const afterData = await jsonOf<{ thoughts: unknown[] }>(after)
    expect(afterData.thoughts.length).toBe(0)

    // 我的段评（含已隐藏）
    const mine = await req('/api/thoughts?mine=1', json('GET', undefined, readerToken))
    const mineData = await jsonOf<{ thoughts: unknown[] }>(mine)
    expect(mineData.thoughts.length).toBe(1)
  })

  it('书架：加入、汇总、移除', async () => {
    const add = await req('/api/bookshelf', json('POST', { novelId }, readerToken))
    expect(add.status).toBe(200)

    const list = await req('/api/bookshelf', json('GET', undefined, readerToken))
    const listData = await jsonOf<{ favorites: Array<{ novelId: string; title: string }>; recent: unknown[]; thoughts: unknown[] }>(list)
    expect(listData.favorites.length).toBe(1)
    expect(listData.favorites[0]!.novelId).toBe(novelId)
    expect(listData.favorites[0]!.title).toBe('社交测试书')

    const remove = await req(`/api/bookshelf?novelId=${novelId}`, json('DELETE', undefined, readerToken))
    expect(remove.status).toBe(200)
    const after = await req('/api/bookshelf', json('GET', undefined, readerToken))
    const afterData = await jsonOf<{ favorites: unknown[] }>(after)
    expect(afterData.favorites.length).toBe(0)
  })

  it('书签：全量替换与读取', async () => {
    const put = await req(
      '/api/bookmarks',
      json('PUT', { bookmarks: [{ novelId, chapterId, chapterTitle: '第一章', timestamp: Date.now() }] }, readerToken),
    )
    expect(put.status).toBe(200)

    const get = await req('/api/bookmarks', json('GET', undefined, readerToken))
    const { bookmarks } = await jsonOf<{ bookmarks: Array<{ novelId: string; chapterTitle: string }> }>(get)
    expect(bookmarks.length).toBe(1)
    expect(bookmarks[0]!.chapterTitle).toBe('第一章')

    // 覆盖替换
    const put2 = await req('/api/bookmarks', json('PUT', { bookmarks: [] }, readerToken))
    expect(put2.status).toBe(200)
    const get2 = await req('/api/bookmarks', json('GET', undefined, readerToken))
    const { bookmarks: b2 } = await jsonOf<{ bookmarks: unknown[] }>(get2)
    expect(b2.length).toBe(0)
  })
})
