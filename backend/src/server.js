
import 'dotenv/config'
import app from './app.js'
import { pool } from './config/db.js'

const requiredEnv = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'JWT_ACCESS_SECRET',
]

for (const name of requiredEnv) {
  if (!process.env[name]?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
}

if (process.env.DB_PASSWORD === undefined) {
  throw new Error('Missing required environment variable: DB_PASSWORD. Set it to the MySQL account password, or an empty value only if that MySQL account has no password.')
}

if (Buffer.byteLength(process.env.JWT_ACCESS_SECRET, 'utf8') < 32) {
  throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes.')
}

const port = Number(process.env.PORT || 3000)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a valid TCP port.')
}

try {
  await pool.query('SELECT 1')

  const server = app.listen(port, () => {
    console.log(`DTS API listening on http://127.0.0.1:${port}`)
  })

  async function shutdown(signal) {
    console.log(`${signal} received. Shutting down DTS API...`)

    server.close(async () => {
      await pool.end()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
} catch (error) {
  console.error('Could not start DTS API:', error)
  await pool.end()
  process.exitCode = 1
}