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
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
}

const port = Number(process.env.PORT || 3000)

try {
  await pool.query('SELECT 1')
  app.listen(port, () => {
    console.log(`DTS API listening on http://127.0.0.1:${port}`)
  })
} catch (error) {
  console.error('Could not connect to MySQL:', error)
  process.exitCode = 1
}