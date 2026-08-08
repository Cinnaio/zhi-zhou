/** 开发编排：同时启动 api（8787）与 web（5173）。零依赖，纯 child_process。 */
import { spawn } from 'node:child_process'

const tasks = [
  { name: 'api', args: ['run', 'dev:api'], color: '\x1b[36m' },
  { name: 'web', args: ['run', 'dev:web'], color: '\x1b[35m' },
]

const children = tasks.map(({ name, args }) => {
  const child = spawn('npm', args, { shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout.on('data', (d) => process.stdout.write(`${d}`))
  child.stderr.on('data', (d) => process.stderr.write(`${d}`))
  child.on('exit', (code) => {
    console.log(`[dev] ${name} exited (${code})`)
    shutdown()
  })
  return child
})

function shutdown() {
  for (const c of children) {
    if (c.exitCode === null) c.kill()
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
