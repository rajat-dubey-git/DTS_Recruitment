import { randomBytes } from 'node:crypto'
import { pool } from '../config/db.js'

function accountError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean)
  const firstName = parts.shift() || ''
  const lastName = parts.join(' ') || null

  if (!firstName || firstName.length > 60 || (lastName && lastName.length > 60)) {
    throw accountError(400, 'Candidate first and last names must each be 60 characters or fewer.')
  }

  return { firstName, lastName }
}

export async function ensureCandidateProfile(connection, user) {
  if (!user || user.role !== 'CANDIDATE' || !user.user_id) {
    throw accountError(409, 'A candidate profile can only be linked to a candidate account.')
  }

  const [linkedRows] = await connection.execute(
    'SELECT candidate_id FROM candidates WHERE user_id = ? LIMIT 1 FOR UPDATE',
    [user.user_id],
  )
  if (linkedRows[0]) return linkedRows[0].candidate_id

  const email = String(user.email || '').trim().toLowerCase()
  if (!email) throw accountError(409, 'The candidate account has no email address to link.')

  const [emailRows] = await connection.execute(
    'SELECT candidate_id, user_id FROM candidates WHERE email = ? LIMIT 1 FOR UPDATE',
    [email],
  )
  if (emailRows[0]) {
    if (emailRows[0].user_id && Number(emailRows[0].user_id) !== Number(user.user_id)) {
      throw accountError(409, 'This candidate profile is already linked to another account.')
    }

    await connection.execute(
      'UPDATE candidates SET user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ? AND user_id IS NULL',
      [user.user_id, emailRows[0].candidate_id],
    )
    return emailRows[0].candidate_id
  }

  const mobile = String(user.mobile || '').trim()
  if (!/^[+]?[0-9]{7,15}$/.test(mobile)) {
    throw accountError(409, 'A valid mobile number is required to create the candidate profile. Contact an administrator.')
  }

  const { firstName, lastName } = splitName(user.full_name)
  const candidateCode = `CAN-${new Date().getFullYear()}-${randomBytes(8).toString('hex').toUpperCase()}`
  const [result] = await connection.execute(
    `INSERT INTO candidates
      (candidate_code, first_name, last_name, email, mobile, source, status, user_id)
     VALUES (?, ?, ?, ?, ?, 'ADMIN_UPLOAD', 'NEW', ?)`,
    [candidateCode, firstName, lastName, email, mobile, user.user_id],
  )
  return result.insertId
}

export async function getCandidateProfileForUser(userId) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [users] = await connection.execute(
      `SELECT user_id, full_name, email, mobile, role
       FROM users WHERE user_id = ? AND role = 'CANDIDATE' LIMIT 1 FOR UPDATE`,
      [userId],
    )
    if (!users[0]) {
      await connection.rollback()
      return null
    }

    const candidateId = await ensureCandidateProfile(connection, users[0])
    const [candidates] = await connection.execute(
      'SELECT * FROM candidates WHERE candidate_id = ? AND user_id = ? LIMIT 1',
      [candidateId, userId],
    )
    await connection.commit()
    return candidates[0] || null
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
