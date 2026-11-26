import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCustomerResumeShare,
  shareEligibleCandidateApplications,
} from '../src/recruiter/resume-sharing.service.js'

function createConnection({ hasVerifiedResume = true, activeShareId = null } = {}) {
  const statements = []
  return {
    statements,
    async execute(query, values = []) {
      statements.push({ query, values })
      if (query.includes('FROM applications a')) {
        return [[{
          application_id: 17,
          requirement_id: 23,
          candidate_id: 31,
          recruiter_id: 41,
          customer_id: 51,
        }], []]
      }
      if (query.includes('FROM candidate_consents')) return [[{ candidate_consent_id: 1 }], []]
      if (query.includes('SELECT cc.contact_id')) return [[{ contact_id: 61 }], []]
      if (query.includes('FROM candidate_documents')) {
        return [hasVerifiedResume ? [{ document_id: 71 }] : [], []]
      }
      if (query.includes('FROM resume_shares')) {
        return [activeShareId ? [{ share_id: activeShareId }] : [], []]
      }
      if (query.startsWith('INSERT INTO resume_shares')) return [{ insertId: 81 }, []]
      if (query.startsWith('INSERT INTO resume_share_events')) return [{ affectedRows: 1 }, []]
      if (query.includes('SELECT DISTINCT cc.user_id')) return [[{ user_id: 91 }], []]
      if (query.startsWith('INSERT INTO notifications')) return [{ affectedRows: 1 }, []]
      throw new Error(`Unexpected query: ${query}`)
    },
  }
}

test('shares an eligible submitted candidate and notifies the customer', async () => {
  const connection = createConnection()

  const result = await createCustomerResumeShare(connection, 17, 41)

  assert.deepEqual(result, { shareId: 81, alreadyShared: false })
  assert.ok(connection.statements.some(({ query }) => query.startsWith('INSERT INTO resume_share_events')))
  assert.ok(connection.statements.some(({ query }) => query.startsWith('INSERT INTO notifications')))
})

test('does not share until the current resume is verified and security-cleared', async () => {
  const connection = createConnection({ hasVerifiedResume: false })

  const result = await createCustomerResumeShare(connection, 17, 41)

  assert.equal(result.shareId, null)
  assert.match(result.reason, /verification and a clean security scan/)
  assert.equal(connection.statements.some(({ query }) => query.startsWith('INSERT INTO resume_shares')), false)
})

test('reuses an active share instead of creating duplicates', async () => {
  const connection = createConnection({ activeShareId: 99 })

  const result = await createCustomerResumeShare(connection, 17, 41)

  assert.deepEqual(result, { shareId: 99, alreadyShared: true })
  assert.equal(connection.statements.some(({ query }) => query.startsWith('INSERT INTO resume_shares')), false)
})

test('releases eligible pending submissions after resume clearance', async () => {
  const connection = createConnection()

  const sharedCount = await shareEligibleCandidateApplications(connection, 31, 91)

  assert.equal(sharedCount, 1)
  assert.ok(connection.statements.some(({ query }) => query.startsWith('INSERT INTO resume_shares')))
})
