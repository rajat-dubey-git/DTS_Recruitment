
import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { pool } from '../src/config/db.js'

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_INITIAL_PASSWORD
  const fullName = process.env.ADMIN_NAME?.trim() || 'DTS Administrator'
  const mobile = process.env.ADMIN_MOBILE?.trim() || null
  const resetExistingPassword = process.argv.includes('--reset-password')

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set a valid ADMIN_EMAIL in backend/.env.')
  }

  if (process.env.DB_PASSWORD === undefined) {
    throw new Error('Set DB_PASSWORD in backend/.env (use an empty value only if the MySQL account has no password).')
  }

  if (!password || Buffer.byteLength(password, 'utf8') < 12) {
    throw new Error('ADMIN_INITIAL_PASSWORD must contain at least 12 characters.')
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Password cannot exceed 72 UTF-8 bytes for bcrypt.')
  }

  if (!process.env.JWT_ACCESS_SECRET ||
      Buffer.byteLength(process.env.JWT_ACCESS_SECRET, 'utf8') < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 bytes.')
  }

  const [rows] = await pool.execute(
    `SELECT user_id, role, status, password_hash
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  )

  const existingUser = rows[0]
  const passwordHash = await bcrypt.hash(password, 12)

  if (existingUser) {
    if (existingUser.role !== 'ADMIN') {
      throw new Error('This email already belongs to a non-ADMIN user.')
    }

    if (!['ACTIVE', 'INVITED'].includes(existingUser.status)) {
      throw new Error(
        `Admin account status is ${existingUser.status}. Resolve the account status before running this setup command.`,
      )
    }

    if (existingUser.status === 'ACTIVE' && existingUser.password_hash && !resetExistingPassword) {
      console.log('Admin already has a password. No changes made.')
      console.log('Use --reset-password only if you intentionally want to replace it.')
      return
    }

    await pool.execute(
      `UPDATE users
       SET password_hash = ?, status = 'ACTIVE'
       WHERE user_id = ? AND role = 'ADMIN' AND status IN ('ACTIVE', 'INVITED')`,
      [passwordHash, existingUser.user_id],
    )

    console.log(
      existingUser.password_hash
        ? 'Existing Admin password has been reset.'
        : 'Password successfully configured for the existing Admin.',
    )
    return
  }

  await pool.execute(
    `INSERT INTO users
      (full_name, email, mobile, password_hash, role, status)
     VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE')`,
    [fullName, email, mobile, passwordHash],
  )

  console.log(`Admin account created successfully: ${email}`)
}

try {
  await createAdmin()
} catch (error) {
  console.error(
    'Admin setup failed:',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
} finally {
  await pool.end()
}