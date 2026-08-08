import { Hono } from 'hono'
import { escHtml } from '@shared/utils'
import { loadConfig } from './config'
import { cors } from './middlewares/cors'
import { authRoutes } from './routes/auth'

/** 全局应用：中间件装配 + 路由注册（阶段化增量挂载）。 */
export const app = new Hono()

app.use('/api/*', cors())

// 安装引导守卫：数据库未配置时仅放行健康检查（与原项目 needsSetup 流程一致）
app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') return next()
  if (!loadConfig().configured) {
    return c.json({ error: '数据库尚未初始化，请先配置 DATABASE_URL', needsSetup: true }, 503)
  }
  await next()
})

// 统一错误出口：细节只进服务端日志，客户端只拿通用信息
app.onError((err, c) => {
  console.error('[api]', err)
  return c.json({ error: '服务器内部错误' }, 500)
})

app.get('/api/health', (c) => {
  return c.json({ ok: true, name: '知舟', esc: escHtml('<b>&</b>') })
})

app.route('/api/auth', authRoutes)
