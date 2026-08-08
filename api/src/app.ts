import { Hono } from 'hono'
import { escHtml } from '@shared/utils'

/** 全局应用：中间件装配 + 路由注册（阶段化增量挂载）。 */
export const app = new Hono()

app.get('/api/health', (c) => {
  return c.json({
    ok: true,
    name: '知舟',
    esc: escHtml('<b>&</b>'), // 验证 @shared 别名链路
  })
})
