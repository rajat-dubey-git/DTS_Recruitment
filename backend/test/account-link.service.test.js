import assert from 'node:assert/strict'
import test from 'node:test'
import { ensureCandidateProfile } from '../src/candidate/account-link.service.js'

function createConnection(results) {
  const statements = []
  return {
    statements,
    async execute(sql, params) {
      statements.push({ sql, params })
      const result = results.shift()
      if (result instanceof Error) throw result
      return result
    },
  }
}

const candidateUser = {
  user_id: 24,
  full_name: 'Jamie Rivera',
  email: 'jamie@example.test',
  mobile: '+14155550124',
  role: 'CANDIDATE',
}

test('uses an existing candidate profile already linked by user ID', async () => {
  const connection = createConnection([[[{ candidate_id: 31 }], []]])

  const candidateId = await ensureCandidateProfile(connection, candidateUser)

  assert.equal(candidateId, 31)
  assert.equal(connection.statements.length, 1)
})

test('links an existing unlinked profile by its unique email', async () => {
  const connection = createConnection([
    [[], []],
    [[{ candidate_id: 32, user_id: null }], []],
    [{ affectedRows: 1 }, []],
  ])

  const candidateId = await ensureCandidateProfile(connection, candidateUser)

  assert.equal(candidateId, 32)
  assert.match(connection.statements[2].sql, /SET user_id = \?/)
  assert.deepEqual(connection.statements[2].params, [24, 32])
})

test('creates a profile linked to the candidate account when none exists', async () => {
  const connection = createConnection([
    [[], []],
    [[], []],
    [{ insertId: 33 }, []],
  ])

  const candidateId = await ensureCandidateProfile(connection, candidateUser)

  assert.equal(candidateId, 33)
  assert.deepEqual(connection.statements[2].params.slice(1, 6), [
    'Jamie',
    'Rivera',
    'jamie@example.test',
    '+14155550124',
    24,
  ])
})

test('does not reassign a profile linked to a different account', async () => {
  const connection = createConnection([
    [[], []],
    [[{ candidate_id: 34, user_id: 25 }], []],
  ])

  await assert.rejects(
    ensureCandidateProfile(connection, candidateUser),
    { statusCode: 409, message: 'This candidate profile is already linked to another account.' },
  )
  assert.equal(connection.statements.length, 2)
})

test('requires a valid mobile number before creating a new profile', async () => {
  const connection = createConnection([ [[], []], [[], []] ])

  await assert.rejects(
    ensureCandidateProfile(connection, { ...candidateUser, mobile: null }),
    { statusCode: 409, message: /valid mobile number is required/ },
  )
  assert.equal(connection.statements.length, 2)
})
