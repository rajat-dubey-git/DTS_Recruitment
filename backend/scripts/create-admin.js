import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/config/db.js'

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_INITIAL_PASSWORD
  const fullName = process.env.ADMIN_NAME?.trim() || 'DTS Administrator'
  const mobile = process.env.ADMIN_MOBILE?.trim() || null
  const resetExistingPassword = process.argv.includes('--reset-password')

  if (email !== 'admin@dts.com') {
    throw new Error('ADMIN_EMAIL must be admin@dts.com for this local seed.')
  }
  if (!password || Buffer.byteLength(password, 'utf8') < 6) {
    throw new Error('ADMIN_INITIAL_PASSWORD must contain at least 6 characters.')
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_INITIAL_PASSWORD cannot exceed 72 UTF-8 bytes.')
  }
  if (process.env.NODE_ENV === 'production' && password.length < 12) {
    throw new Error('Production admin passwords must contain at least 12 characters.')
  }

  const [rows] = await pool.execute(
    `SELECT user_id, role, status, password_hash
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  )

  const existingUser = rows[0]
  if (existingUser) {
    if (existingUser.role !== 'ADMIN' || existingUser.status !== 'ACTIVE') {
      throw new Error('The configured admin account exists but is not an active ADMIN.')
    }
    if (existingUser.password_hash && !resetExistingPassword) {
      console.log('The configured admin already has a password hash; no changes made.')
      return
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ?',
      [passwordHash, existingUser.user_id],
    )
    console.log(
      existingUser.password_hash
        ? 'Reset the configured admin password hash.'
        : 'Added a bcrypt password hash to the existing admin account.',
    )
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await pool.execute(
    `INSERT INTO users (full_name, email, mobile, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE')`,
    [fullName, email, mobile, passwordHash],
  )
  console.log('Created the active admin account with a bcrypt password hash.')

  if (process.env.NODE_ENV !== 'production' && password.length < 12) {
    console.warn('Use a stronger password before deploying this application.')
  }
}

try {
  await createAdmin()
} catch (error) {
  console.error('Admin seed failed:', error instanceof Error ? error.message : 'Unknown error')
  process.exitCode = 1
} finally {
  await pool.end()
}
