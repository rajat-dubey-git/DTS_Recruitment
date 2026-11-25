// backend/src/auth/auth.middleware.js
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'

export async function requireAuth(req, res, next) {
  const token = req.cookies?.dts_access

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated.' })
  }

  let payload

  try {
    payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      issuer: 'dts-recruitment-api',
      audience: 'dts-recruitment-web',
      algorithms: ['HS256']
    })
  } catch {
    return res.status(401).json({ message: 'Session expired. Sign in again.' })
  }

  if (typeof payload === 'string' || !/^\d+$/.test(String(payload.sub))) {
    return res.status(401).json({ message: 'Invalid session.' })
  }

  try {
    const [rows] = await pool.execute(
      `SELECT user_id, full_name, email, role, status
      FROM users
      WHERE user_id = ?`,
      [Number(payload.sub)]
    )

    const user = rows[0]

    if (!user || user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Account is not active.' })
    }

    req.authUser = user

    return next()
  } catch (error) {
    return next(error)
  }
}

export function requireAdmin(req, res, next) {
  if (req.authUser?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Administrator access is required.' })
  }
  return next()
}

export function requireCandidate(req, res, next) {
  if (!req.authUser) {
    return res.status(401).json({ message: 'Authentication required.' })
  }

  if (req.authUser.role !== 'CANDIDATE') {
    return res.status(403).json({ message: 'Candidate access required.' })
  }

  next()
}
