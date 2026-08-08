import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 应用配置：读取根目录 .env（真实环境变量优先）。 */
export interface AppConfig {
  port: number
  databaseUrl: string
  configured: boolean
  corsOrigins: string[]
}

const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENV_FILE = process.env.ENV_FILE || path.join(PROJECT_ROOT, '.env')

if (existsSync(ENV_FILE) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(ENV_FILE)
  } catch (err) {
    console.warn('[config] 无法读取 .env:', (err as Error)?.message || err)
  }
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim() || ''
  const corsOrigins = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return {
    port: Number.parseInt(process.env.PORT || '8787', 10),
    databaseUrl,
    configured: Boolean(databaseUrl),
    corsOrigins,
  }
}
