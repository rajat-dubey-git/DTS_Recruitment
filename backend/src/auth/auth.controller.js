import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'

const COOKIE_NAME = 'dts_access'
const TOKEN_LIFETIME_MS = 15 * 60 * 1000

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TOKEN_LIFETIME_MS,
  }
}

function toUser(row) {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
  }
}

export async function login(req, res, next) {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase()
    const password = req.body?.password

    if (!email || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const [rows] = await pool.execute(
      `SELECT user_id, full_name, email, password_hash, role, status
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [email],
    )

    const user = rows[0]

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !user.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    await pool.execute(
      'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [user.user_id],
    )

    const token = jwt.sign(
      { role: user.role },
      process.env.JWT_ACCESS_SECRET,
      {
        subject: String(user.user_id),
        expiresIn: '15m',
        issuer: 'dts-recruitment-api',
        audience: 'dts-recruitment-web',
      },
    )

    res.cookie(COOKIE_NAME, token, cookieOptions())
    return res.json({ user: toUser(user) })
  } catch (error) {
    return next(error)
  }
}

export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, cookieOptions())
  return res.json({ message: 'Signed out.' })
}

export async function me(req, res) {
  return res.json({ user: toUser(req.authUser) })
}