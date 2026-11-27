// backend/src/auth/auth.middleware.js
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import { ACCESS_COOKIE_NAME } from './session.js'

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE_NAME]

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

  if (
    typeof payload === 'string'
    || !/^\d+$/.test(String(payload.sub))
    || !Number.isSafeInteger(Number(payload.sid))
    || Number(payload.sid) < 1
  ) {
    return res.status(401).json({ message: 'Invalid session.' })
  }

  try {
    const [rows] = await pool.execute(
      `SELECT u.user_id, u.full_name, u.email, u.role, u.status
       FROM users u
       INNER JOIN user_sessions s ON s.user_id = u.user_id
       WHERE u.user_id = ?
         AND s.session_id = ?
         AND s.revoked_at IS NULL
         AND s.expires_at > CURRENT_TIMESTAMP
       LIMIT 1`,
      [Number(payload.sub), Number(payload.sid)],
    )

    const user = rows[0]

    if (!user) {
      return res.status(401).json({ message: 'Session expired. Sign in again.' })
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Account is not active.' })
    }

    await pool.execute(
      `UPDATE user_sessions
       SET last_used_at = CURRENT_TIMESTAMP
       WHERE session_id = ?
         AND (last_used_at IS NULL OR last_used_at < CURRENT_TIMESTAMP - INTERVAL 5 MINUTE)`,
      [Number(payload.sid)],
    )

    req.authUser = user
    req.authSessionId = Number(payload.sid)

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
