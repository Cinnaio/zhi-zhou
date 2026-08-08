import { serve } from '@hono/node-server'
import { app } from './app'
import { loadConfig } from './config'

const config = loadConfig()

const server = serve({ fetch: app.fetch, port: config.port })
console.log(
  `[zhi-zhou api] listening on http://127.0.0.1:${config.port}  (db: ${config.configured ? 'configured' : 'needsSetup'})`,
)

function shutdown() {
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
