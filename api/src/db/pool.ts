import { Pool } from 'pg'
import { loadConfig } from '../config'

let pool: Pool | null = null

export class DbNotConfiguredError extends Error {
  constructor() {
    super('数据库未配置')
    this.name = 'DbNotConfiguredError'
  }
}

/** 未配置 DATABASE_URL 时返回 null（API 进入 needsSetup 模式）。 */
export function getPool(): Pool | null {
  const config = loadConfig()
  if (!config.configured) return null
  if (pool) return pool
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 15,
    idleTimeoutMillis: 60_000,
    connectionTimeoutMillis: 5_000,
  })
  // 池内空闲连接泄漏会阻塞退出；服务进程长驻，这里只做基础错误打点
  pool.on('error', (err) => {
    console.error('[db] idle client error:', (err as Error)?.message || err)
  })
  return pool
}

/** 获取池，未配置时抛错，便于 handler 捕获后返回 needsSetup。 */
export function getDb(): Pool {
  const p = getPool()
  if (!p) throw new DbNotConfiguredError()
  return p
}
