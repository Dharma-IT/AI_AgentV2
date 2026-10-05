import { app } from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.PORT, () => {
  console.log(`Maria API listening on http://localhost:${env.PORT}`)
})

function shutdown(signal: string) {
  console.log(`${signal} received; shutting down Maria API`)
  server.close((error) => {
    if (error) {
      console.error('Failed to close the server cleanly', error)
      process.exit(1)
    }
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
