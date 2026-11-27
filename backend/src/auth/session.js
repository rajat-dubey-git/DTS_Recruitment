import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'

export const ACCESS_COOKIE_NAME = 'dts_access'
export const REFRESH_COOKIE_NAME = 'dts_refresh'
export const ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60
export const SESSION_LIFETIME_DAYS = 7
const SESSION_LIFETIME_MS = SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000

function cookieOptions(path) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  }
}

export function createAccessToken(user, sessionId) {
  return jwt.sign(
    { role: user.role, sid: sessionId },
    process.env.JWT_ACCESS_SECRET,
    {
      subject: String(user.user_id),
      expiresIn: ACCESS_TOKEN_LIFETIME_SECONDS,
      issuer: 'dts-recruitment-api',
      audience: 'dts-recruitment-web',
    },
  )
}

export function createRefreshToken() {
  return randomBytes(32).toString('base64url')
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function setSessionCookies(
  res,
  accessToken,
  refreshToken,
  refreshCookieMaxAgeMs = SESSION_LIFETIME_MS,
) {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, {
    ...cookieOptions('/'),
    maxAge: ACCESS_TOKEN_LIFETIME_SECONDS * 1000,
  })
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...cookieOptions('/api/auth'),
    maxAge: Math.max(0, Math.min(SESSION_LIFETIME_MS, refreshCookieMaxAgeMs)),
  })
}

export function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions('/'))
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions('/api/auth'))
}
