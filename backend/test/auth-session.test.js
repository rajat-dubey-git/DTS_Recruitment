import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { pool } from '../src/config/db.js'
import { login, logout, refresh } from '../src/auth/auth.controller.js'
import { requireAuth } from '../src/auth/auth.middleware.js'
import {
  ACCESS_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
  createAccessToken,
  hashRefreshToken,
} from '../src/auth/session.js'

const TEST_SECRET = 'test-secret-with-at-least-thirty-two-bytes'
const user = {
  user_id: 24,
  full_name: 'Test User',
  email: 'test@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
}

function responseRecorder() {
  const cookies = new Map()
  const clearedCookies = []
  return {
    cookies,
    clearedCookies,
    statusCode: 200,
    body: null,
    cookie(name, value, options) {
      cookies.set(name, { value, options })
      return this
    },
    clearCookie(name, options) {
      clearedCookies.push({ name, options })
      return this
    },
    status(statusCode) {
      this.statusCode = statusCode
      return this
    },
    json(body) {
      this.body = body
      return this
    },
  }
}

function withTestSecret() {
  const oldSecret = process.env.JWT_ACCESS_SECRET
  process.env.JWT_ACCESS_SECRET = TEST_SECRET
  return () => {
    if (oldSecret === undefined) delete process.env.JWT_ACCESS_SECRET
    else process.env.JWT_ACCESS_SECRET = oldSecret
  }
}

test('login stores a refresh-token hash and issues secure session cookies', async () => {
  const restoreSecret = withTestSecret()
  const originalExecute = pool.execute
  const originalGetConnection = pool.getConnection
  const statements = []
  const transaction = { committed: false }
  const connection = {
    async beginTransaction() {},
    async commit() { transaction.committed = true },
    async rollback() {},
    release() {},
    async execute(sql, params) {
      statements.push({ sql, params })
      if (sql.includes('INSERT INTO user_sessions')) return [{ insertId: 73 }, []]
      return [{ affectedRows: 1 }, []]
    },
  }

  try {
    pool.execute = async () => [[{
      ...user,
      password_hash: await bcrypt.hash('correct-password', 4),
    }], []]
    pool.getConnection = async () => connection

    const res = responseRecorder()
    let forwardedError
    await login({
      body: { email: user.email, password: 'correct-password' },
      ip: '127.0.0.1',
      get: () => 'test-agent',
    }, res, (error) => { forwardedError = error })

    assert.equal(forwardedError, undefined)
    assert.equal(transaction.committed, true)
    const insert = statements.find(({ sql }) => sql.includes('INSERT INTO user_sessions'))
    assert.ok(insert)
    const refreshCookie = res.cookies.get(REFRESH_COOKIE_NAME)
    const accessCookie = res.cookies.get(ACCESS_COOKIE_NAME)
    assert.ok(refreshCookie)
    assert.ok(accessCookie)
    assert.equal(insert.params[1], hashRefreshToken(refreshCookie.value))
    assert.notEqual(insert.params[1], refreshCookie.value)
    assert.equal(insert.params[2], '127.0.0.1')
    assert.equal(insert.params[3], 'test-agent')
    assert.equal(refreshCookie.options.httpOnly, true)
    assert.equal(refreshCookie.options.path, '/api/auth')
    assert.equal(jwt.verify(accessCookie.value, TEST_SECRET).sid, 73)
  } finally {
    pool.execute = originalExecute
    pool.getConnection = originalGetConnection
    restoreSecret()
  }
})

test('refresh rotates the stored hash and issues a new access token', async () => {
  const restoreSecret = withTestSecret()
  const originalGetConnection = pool.getConnection
  const previousRefreshToken = 'previous-refresh-token'
  const statements = []
  const session = {
    session_id: 73,
    user_id: user.user_id,
    refresh_token_hash: hashRefreshToken(previousRefreshToken),
    revoked_at: null,
    is_unexpired: 1,
    refresh_max_age_ms: 6 * 24 * 60 * 60 * 1000,
    ...user,
  }
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql, params) {
      statements.push({ sql, params })
      if (sql.includes('SELECT s.session_id')) return [[session], []]
      return [{ affectedRows: 1 }, []]
    },
  }

  try {
    pool.getConnection = async () => connection
    const res = responseRecorder()
    let forwardedError
    await refresh({ cookies: { [REFRESH_COOKIE_NAME]: previousRefreshToken } }, res, (error) => {
      forwardedError = error
    })

    assert.equal(forwardedError, undefined)
    assert.equal(res.statusCode, 200)
    const update = statements.find(({ sql }) => sql.includes('UPDATE user_sessions'))
    const nextRefreshCookie = res.cookies.get(REFRESH_COOKIE_NAME)
    assert.ok(update)
    assert.ok(nextRefreshCookie)
    assert.notEqual(nextRefreshCookie.value, previousRefreshToken)
    assert.equal(update.params[0], hashRefreshToken(nextRefreshCookie.value))
    assert.equal(jwt.verify(res.cookies.get(ACCESS_COOKIE_NAME).value, TEST_SECRET).sid, 73)
  } finally {
    pool.getConnection = originalGetConnection
    restoreSecret()
  }
})

test('logout revokes the matching session and clears both cookies', async () => {
  const restoreSecret = withTestSecret()
  const originalExecute = pool.execute
  const refreshToken = 'current-refresh-token'
  const statements = []

  try {
    pool.execute = async (sql, params) => {
      statements.push({ sql, params })
      return [{ affectedRows: 1 }, []]
    }

    const res = responseRecorder()
    await logout({
      cookies: {
        [ACCESS_COOKIE_NAME]: createAccessToken(user, 73),
        [REFRESH_COOKIE_NAME]: refreshToken,
      },
    }, res, (error) => { throw error })

    assert.equal(res.body.message, 'Signed out.')
    assert.equal(res.clearedCookies.length, 2)
    assert.match(statements[0].sql, /UPDATE user_sessions/)
    assert.deepEqual(statements[0].params, [73, hashRefreshToken(refreshToken)])
  } finally {
    pool.execute = originalExecute
    restoreSecret()
  }
})

test('protected requests require an active database session', async () => {
  const restoreSecret = withTestSecret()
  const originalExecute = pool.execute
  let sessionRows = [{ ...user }]

  try {
    pool.execute = async (sql) => {
      if (sql.includes('SELECT u.user_id')) return [sessionRows, []]
      return [{ affectedRows: 1 }, []]
    }

    const token = createAccessToken(user, 73)
    const req = { cookies: { [ACCESS_COOKIE_NAME]: token } }
    const res = responseRecorder()
    let nextCalled = false
    await requireAuth(req, res, () => { nextCalled = true })
    assert.equal(nextCalled, true)
    assert.equal(req.authSessionId, 73)

    sessionRows = []
    const rejectedResponse = responseRecorder()
    await requireAuth(
      { cookies: { [ACCESS_COOKIE_NAME]: token } },
      rejectedResponse,
      () => assert.fail('Revoked session must not authenticate.'),
    )
    assert.equal(rejectedResponse.statusCode, 401)
  } finally {
    pool.execute = originalExecute
    restoreSecret()
  }
})
