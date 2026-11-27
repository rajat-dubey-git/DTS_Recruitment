import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../config/db.js'
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  SESSION_LIFETIME_DAYS,
  clearSessionCookies,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  setSessionCookies,
} from './session.js'

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

    const refreshToken = createRefreshToken()
    const connection = await pool.getConnection()
    let accessToken
    try {
      await connection.beginTransaction()
      const [sessionResult] = await connection.execute(
        `INSERT INTO user_sessions
          (user_id, refresh_token_hash, ip_address, user_agent, expires_at)
         VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${SESSION_LIFETIME_DAYS} DAY))`,
        [
          user.user_id,
          hashRefreshToken(refreshToken),
          req.ip ? String(req.ip).slice(0, 45) : null,
          req.get('user-agent')?.slice(0, 500) ?? null,
        ],
      )
      const sessionId = Number(sessionResult.insertId)
      accessToken = createAccessToken(user, sessionId)
      await connection.execute(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [user.user_id],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    setSessionCookies(res, accessToken, refreshToken)
    return res.json({ user: toUser(user) })
  } catch (error) {
    return next(error)
  }
}

export async function refresh(req, res, next) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
  if (!refreshToken) {
    clearSessionCookies(res)
    return res.status(401).json({ message: 'Session expired. Sign in again.' })
  }

  let connection
  let transactionStarted = false
  try {
    connection = await pool.getConnection()
    await connection.beginTransaction()
    transactionStarted = true
    const [rows] = await connection.execute(
      `SELECT s.session_id, s.user_id, s.refresh_token_hash, s.revoked_at,
              (s.expires_at > CURRENT_TIMESTAMP) AS is_unexpired,
              TIMESTAMPDIFF(SECOND, CURRENT_TIMESTAMP, s.expires_at) * 1000 AS refresh_max_age_ms,
              u.full_name, u.email, u.role, u.status
       FROM user_sessions s
       INNER JOIN users u ON u.user_id = s.user_id
       WHERE s.refresh_token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [hashRefreshToken(refreshToken)],
    )
    const session = rows[0]
    if (!session) {
      await connection.rollback()
      transactionStarted = false
      return res.status(401).json({ message: 'Session expired. Sign in again.' })
    }

    if (session.revoked_at || !Number(session.is_unexpired)) {
      if (!session.revoked_at) {
        await connection.execute(
          `UPDATE user_sessions
           SET revoked_at = CURRENT_TIMESTAMP
           WHERE session_id = ? AND revoked_at IS NULL`,
          [session.session_id],
        )
        await connection.commit()
        transactionStarted = false
      } else {
        await connection.rollback()
        transactionStarted = false
      }
      clearSessionCookies(res)
      return res.status(401).json({ message: 'Session expired. Sign in again.' })
    }

    if (session.status !== 'ACTIVE') {
      await connection.execute(
        'UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE session_id = ?',
        [session.session_id],
      )
      await connection.commit()
      transactionStarted = false
      clearSessionCookies(res)
      return res.status(401).json({ message: 'Account is not active.' })
    }

    const nextRefreshToken = createRefreshToken()
    const [updateResult] = await connection.execute(
      `UPDATE user_sessions
       SET refresh_token_hash = ?, last_used_at = CURRENT_TIMESTAMP
       WHERE session_id = ?
         AND refresh_token_hash = ?
         AND revoked_at IS NULL
         AND expires_at > CURRENT_TIMESTAMP`,
      [
        hashRefreshToken(nextRefreshToken),
        session.session_id,
        session.refresh_token_hash,
      ],
    )
    if (updateResult.affectedRows !== 1) {
      await connection.rollback()
      transactionStarted = false
      clearSessionCookies(res)
      return res.status(401).json({ message: 'Session expired. Sign in again.' })
    }

    const accessToken = createAccessToken(session, Number(session.session_id))
    await connection.commit()
    transactionStarted = false
    setSessionCookies(
      res,
      accessToken,
      nextRefreshToken,
      Math.max(0, Number(session.refresh_max_age_ms)),
    )
    return res.json({ message: 'Session refreshed.' })
  } catch (error) {
    if (transactionStarted) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
}

export async function logout(req, res, next) {
  clearSessionCookies(res)
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME]
    const accessToken = req.cookies?.[ACCESS_COOKIE_NAME]
    let sessionId = null

    if (accessToken) {
      try {
        const payload = jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET, {
          issuer: 'dts-recruitment-api',
          audience: 'dts-recruitment-web',
          algorithms: ['HS256'],
          ignoreExpiration: true,
        })
        if (
          typeof payload !== 'string'
          && Number.isSafeInteger(Number(payload.sid))
          && Number(payload.sid) > 0
        ) {
          sessionId = Number(payload.sid)
        }
      } catch {
        // Invalid access cookies are cleared without affecting other sessions.
      }
    }

    if (sessionId !== null || refreshToken) {
      await pool.execute(
        `UPDATE user_sessions
         SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
         WHERE revoked_at IS NULL
           AND (session_id = ? OR refresh_token_hash = ?)`,
        [sessionId, refreshToken ? hashRefreshToken(refreshToken) : null],
      )
    }

    return res.json({ message: 'Signed out.' })
  } catch (error) {
    return next(error)
  }
}

export async function me(req, res, next) {
  try {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Not authenticated.' })
    }
    return res.json({ user: toUser(req.authUser) })
  } catch (error) {
    return next(error)
  }
}