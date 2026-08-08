/**
 * 认证中间件 —— requireUser / requireAdmin。
 * 挂到需要登录/管理员的子路由上；用户信息写入 context variable `user`。
 */
import type { MiddlewareHandler } from 'hono'
import { loadConfig } from '../config'
import { getDb } from '../db/pool'
import { bearerToken, type UserRow } from '../services/auth'
import { getUserByToken } from '../services/sessions'

export type AuthEnv = { Variables: { user: UserRow } }

export function requireUser(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    let db
    try {
      db = getDb()
    } catch {
      return c.json({ error: '数据库未配置', needsSetup: true }, 503)
    }
    const token = bearerToken(c.req.header('Authorization') || '')
    const user = await getUserByToken(db, token, loadConfig().sessionHashSalt)
    if (!user) return c.json({ error: '需要登录' }, 401)
    c.set('user', user)
    await next()
  }
}

export function requireAdmin(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    let db
    try {
      db = getDb()
    } catch {
      return c.json({ error: '数据库未配置', needsSetup: true }, 503)
    }
    const token = bearerToken(c.req.header('Authorization') || '')
    const user = await getUserByToken(db, token, loadConfig().sessionHashSalt)
    if (!user) return c.json({ error: '需要管理员登录' }, 401)
    if (user.role !== 'admin') return c.json({ error: '需要管理员权限' }, 403)
    c.set('user', user)
    await next()
  }
}

/** 有 token 就解析用户（读进度等匿名可用的用户增强路由），无 token 不拦截。 */
export function optionalUser(): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    try {
      const token = bearerToken(c.req.header('Authorization') || '')
      if (token) {
        const user = await getUserByToken(getDb(), token, loadConfig().sessionHashSalt)
        if (user) c.set('user', user)
      }
    } catch {
      // 未配置 DB 或解析失败：按匿名处理
    }
    await next()
  }
}
