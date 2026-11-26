import assert from 'node:assert/strict'
import test from 'node:test'
import { deleteUserAccount } from '../src/admin/user.service.js'

function fakeDatabase(user, activeAdmins = []) {
  const statements = []
  const state = { committed: false, rolledBack: false }
  const connection = {
    async beginTransaction() {},
    async commit() { state.committed = true },
    async rollback() { state.rolledBack = true },
    release() {},
    async execute(sql, params) {
      statements.push({ sql, params })
      if (sql.includes('SELECT user_id, role, status FROM users')) return [[user], []]
      if (sql.includes("role = 'ADMIN' AND status = 'ACTIVE'")) return [activeAdmins, []]
      return [{ affectedRows: 1 }, []]
    },
  }
  return {
    statements,
    state,
    database: { async getConnection() { return connection } },
  }
}

test('deletes the user row after removing auth-only data and unlinking history', async () => {
  const fake = fakeDatabase({ user_id: 24, role: 'RECRUITER', status: 'ACTIVE' })

  const result = await deleteUserAccount(24, 1, fake.database)

  assert.equal(result.message, 'User account deleted. Related business history was retained.')
  assert.equal(fake.state.committed, true)
  assert.equal(fake.state.rolledBack, false)
  assert.equal(fake.statements.at(-1).sql, 'DELETE FROM users WHERE user_id = ?')
  assert.ok(fake.statements.some(({ sql }) => sql.includes('UPDATE requirement_assignments')))
  assert.ok(fake.statements.some(({ sql }) => sql.includes('DELETE FROM user_sessions')))
})

test('refuses to delete the last active administrator', async () => {
  const fake = fakeDatabase(
    { user_id: 24, role: 'ADMIN', status: 'ACTIVE' },
    [{ user_id: 24 }],
  )

  await assert.rejects(deleteUserAccount(24, 1, fake.database), {
    statusCode: 409,
    message: 'The last active admin account cannot be deleted.',
  })
  assert.equal(fake.state.committed, false)
  assert.equal(fake.state.rolledBack, true)
  assert.equal(fake.statements.some(({ sql }) => sql === 'DELETE FROM users WHERE user_id = ?'), false)
})

test('refuses to delete the signed-in administrator account', async () => {
  await assert.rejects(deleteUserAccount(24, 24, {
    async getConnection() {
      throw new Error('A database connection should not be opened.')
    },
  }), {
    statusCode: 409,
    message: 'You cannot delete your own account.',
  })
})
