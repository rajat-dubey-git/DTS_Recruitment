import { randomBytes, createHash } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../config/db.js'
import { isEmailConfigured, sendInvitationEmail } from '../services/email.service.js'
import { ensureCandidateProfile } from '../candidate/account-link.service.js'

const ALLOWED_ROLES = new Set(['RECRUITER', 'CUSTOMER', 'CANDIDATE'])

const PASSWORD_REGEX = {
  minLength: 8,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  special: /[^A-Za-z0-9]/,
};

function validatePassword(password) {
  const errors = [];
  if (typeof password !== 'string' || password.length < PASSWORD_REGEX.minLength) {
    errors.push(`At least ${PASSWORD_REGEX.minLength} characters.`);
  }
  if (!PASSWORD_REGEX.upper.test(password)) {
    errors.push('At least one uppercase letter (A-Z).');
  }
  if (!PASSWORD_REGEX.lower.test(password)) {
    errors.push('At least one lowercase letter (a-z).');
  }
  if (!PASSWORD_REGEX.digit.test(password)) {
    errors.push('At least one number (0-9).');
  }
  if (!PASSWORD_REGEX.special.test(password)) {
    errors.push('At least one special character (e.g. @, #, $, %, &, !).');
  }
  return errors;
}

function passwordError(errors) {
  return Object.assign(new Error(errors.join(' ')), { statusCode: 400 });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function validateUserInput(input) {
  const fullName = String(input?.fullName ?? '').trim()
  const email = String(input?.email ?? '').trim().toLowerCase()
  const mobile = String(input?.mobile ?? '').trim() || null
  const role = String(input?.role ?? '').trim().toUpperCase()
  const customerId = input?.customerId == null || input.customerId === ''
    ? null
    : Number(input.customerId)

  if (!fullName || fullName.length > 100) {
    throw Object.assign(new Error('Full name is required and must be 100 characters or fewer.'), { statusCode: 400 })
  }

  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error('Enter a valid email address.'), { statusCode: 400 })
  }

  if (mobile && !/^[+]?[0-9]{7,15}$/.test(mobile)) {
    throw Object.assign(new Error('Mobile number must contain 7 to 15 digits, optionally starting with +.'), { statusCode: 400 })
  }

  if (!ALLOWED_ROLES.has(role)) {
    throw Object.assign(new Error('Role must be RECRUITER, CUSTOMER or CANDIDATE. Admin accounts are managed separately.'), { statusCode: 400 })
  }

  if (role === 'CUSTOMER' && (!Number.isSafeInteger(customerId) || customerId < 1)) {
    throw Object.assign(new Error('Select a valid customer organisation for a CUSTOMER user.'), { statusCode: 400 })
  }

  if (role === 'CANDIDATE' && !mobile) {
    throw Object.assign(new Error('A mobile number is required for a candidate account.'), { statusCode: 400 })
  }

  if (role !== 'CUSTOMER' && customerId !== null) {
    throw Object.assign(new Error('A customer organisation can only be assigned to a CUSTOMER user.'), { statusCode: 400 })
  }

  return { fullName, email, mobile, role, customerId }
}

export async function inviteUser(input, createdBy) {
  const emailConfigured = isEmailConfigured()
  if (process.env.NODE_ENV === 'production' && !emailConfigured) {
    throw Object.assign(
      new Error('Invitation email delivery is not configured. Set up SMTP before inviting users in production.'),
      { statusCode: 503 },
    )
  }

  const frontendUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:5173')
  if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
    throw Object.assign(new Error('FRONTEND_URL must use HTTP or HTTPS.'), { statusCode: 500 })
  }
  if (process.env.NODE_ENV === 'production' && frontendUrl.protocol !== 'https:') {
    throw Object.assign(new Error('FRONTEND_URL must use HTTPS in production.'), { statusCode: 500 })
  }

  const { fullName, email, mobile, role, customerId } = validateUserInput(input)
  const connection = await pool.getConnection()

  let user
  let rawToken
  let expiresAt

  try {
    await connection.beginTransaction()

    if (role === 'CUSTOMER') {
      const [customers] = await connection.execute(
        'SELECT customer_id FROM customers WHERE customer_id = ? LIMIT 1',
        [customerId],
      )

      if (!customers[0]) {
        throw Object.assign(new Error('Selected customer organisation was not found.'), { statusCode: 404 })
      }
    }

    const [existingRows] = await connection.execute(
      `SELECT user_id, role, status, password_hash
       FROM users
       WHERE email = ?
       LIMIT 1
       FOR UPDATE`,
      [email],
    )

    const existing = existingRows[0]
    let userId

    if (existing) {
      if (existing.role !== role) {
        throw Object.assign(new Error('This email already belongs to a different user role.'), { statusCode: 409 })
      }
      if (
        existing.password_hash ||
        !['INVITED', 'ACTIVE'].includes(existing.status)
      ) {
        throw Object.assign(new Error('This account already has credentials or is not eligible for an invitation.'), { statusCode: 409 })
      }

      userId = existing.user_id
      await connection.execute(
        `UPDATE users
         SET full_name = ?, mobile = ?, status = 'INVITED'
         WHERE user_id = ? AND password_hash IS NULL AND status IN ('ACTIVE', 'INVITED')`,
        [fullName, mobile, userId],
      )
    } else {
      const [insertResult] = await connection.execute(
        `INSERT INTO users
          (full_name, email, mobile, password_hash, role, status)
         VALUES (?, ?, ?, NULL, ?, 'INVITED')`,
        [fullName, email, mobile, role],
      )
      userId = insertResult.insertId
    }

    if (role === 'CANDIDATE') {
      await ensureCandidateProfile(connection, {
        user_id: userId,
        full_name: fullName,
        email,
        mobile,
        role,
      })
    }

    if (role === 'CUSTOMER') {
      const [contacts] = await connection.execute(
        'SELECT customer_id FROM customer_contacts WHERE user_id = ? LIMIT 1',
        [userId],
      )
      if (contacts[0] && contacts[0].customer_id !== customerId) {
        throw Object.assign(new Error('This user is already associated with a different customer.'), { statusCode: 409 })
      }
      if (contacts[0]) {
        await connection.execute(
          `UPDATE customer_contacts
           SET status = 'ACTIVE'
           WHERE user_id = ? AND customer_id = ?`,
          [userId, customerId],
        )
      } else {
        await connection.execute(
          `INSERT INTO customer_contacts
            (customer_id, user_id, designation, contact_type, is_primary, status)
           VALUES (?, ?, NULL, 'HIRING', 0, 'ACTIVE')`,
          [customerId, userId],
        )
      }
    }

    await connection.execute(
      `UPDATE user_invitations
       SET accepted_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND accepted_at IS NULL`,
      [userId],
    )

    rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256(rawToken)
    expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await connection.execute(
      `INSERT INTO user_invitations
        (user_id, token_hash, expires_at, created_by)
       VALUES (?, ?, ?, ?)`,
      [userId, tokenHash, expiresAt, createdBy],
    )

    await connection.commit()
    user = {
      userId,
      fullName,
      email,
      mobile,
      role,
      status: 'INVITED',
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const invitationUrl = new URL('/accept-invitation', frontendUrl)
  invitationUrl.searchParams.set('token', rawToken)

  if (emailConfigured) {
    try {
      await sendInvitationEmail({ to: user.email, fullName: user.fullName, invitationUrl: invitationUrl.toString(), expiresAt })
    } catch {
      throw Object.assign(
        new Error('The invitation was created, but email delivery failed. Correct SMTP settings and create a fresh invitation.'),
        { statusCode: 502 },
      )
    }
  }

  return {
    user,
    ...(emailConfigured ? {} : { invitationUrl: invitationUrl.toString() }),
    expiresAt,
  }
}

export async function deleteUserAccount(userId, actorUserId, database = pool) {
  const parsedUserId = Number(userId)
  if (!Number.isSafeInteger(parsedUserId) || parsedUserId < 1) {
    throw Object.assign(new Error('Invalid user ID.'), { statusCode: 400 })
  }
  if (parsedUserId === actorUserId) {
    throw Object.assign(new Error('You cannot delete your own account.'), { statusCode: 409 })
  }

  const connection = await database.getConnection()
  try {
    await connection.beginTransaction()
    const [users] = await connection.execute(
      'SELECT user_id, role, status FROM users WHERE user_id = ? LIMIT 1 FOR UPDATE',
      [parsedUserId],
    )
    const user = users[0]
    if (!user) throw Object.assign(new Error('User not found.'), { statusCode: 404 })

    if (user.role === 'ADMIN' && user.status === 'ACTIVE') {
      const [activeAdmins] = await connection.execute(
        `SELECT user_id
         FROM users
         WHERE role = 'ADMIN' AND status = 'ACTIVE'
         FOR UPDATE`,
      )
      if (activeAdmins.length <= 1) {
        throw Object.assign(new Error('The last active admin account cannot be deleted.'), { statusCode: 409 })
      }
    }

    await connection.execute('DELETE FROM user_invitations WHERE user_id = ?', [parsedUserId])
    await connection.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [parsedUserId])
    await connection.execute('DELETE FROM user_sessions WHERE user_id = ?', [parsedUserId])
    await connection.execute('DELETE FROM notifications WHERE user_id = ?', [parsedUserId])

    await connection.execute('UPDATE customers SET account_owner_id = NULL WHERE account_owner_id = ?', [parsedUserId])
    await connection.execute('UPDATE customer_contacts SET user_id = NULL WHERE user_id = ?', [parsedUserId])
    await connection.execute('UPDATE job_profiles SET created_by = NULL WHERE created_by = ?', [parsedUserId])
    await connection.execute('UPDATE agreements SET created_by = NULL WHERE created_by = ?', [parsedUserId])
    await connection.execute(
      'UPDATE service_orders SET approved_by = NULL WHERE approved_by = ?',
      [parsedUserId],
    )
    await connection.execute(
      `UPDATE job_requirements
       SET raised_by_user_id = IF(raised_by_user_id = ?, NULL, raised_by_user_id),
           approved_by = IF(approved_by = ?, NULL, approved_by)
       WHERE raised_by_user_id = ? OR approved_by = ?`,
      [parsedUserId, parsedUserId, parsedUserId, parsedUserId],
    )
    await connection.execute(
      `UPDATE requirement_assignments
       SET unassigned_at = COALESCE(unassigned_at, GREATEST(CURRENT_TIMESTAMP, assigned_at)),
           recruiter_id = NULL
       WHERE recruiter_id = ?`,
      [parsedUserId],
    )
    await connection.execute('UPDATE candidates SET created_by = NULL, user_id = NULL WHERE created_by = ? OR user_id = ?', [parsedUserId, parsedUserId])
    await connection.execute(
      `UPDATE candidate_documents
       SET verified_by = IF(verified_by = ?, NULL, verified_by),
           uploaded_by = IF(uploaded_by = ?, NULL, uploaded_by)
       WHERE verified_by = ? OR uploaded_by = ?`,
      [parsedUserId, parsedUserId, parsedUserId, parsedUserId],
    )
    await connection.execute('UPDATE applications SET recruiter_id = NULL WHERE recruiter_id = ?', [parsedUserId])
    await connection.execute('UPDATE screenings SET screened_by = NULL WHERE screened_by = ?', [parsedUserId])
    await connection.execute('UPDATE shortlists SET shortlisted_by = NULL WHERE shortlisted_by = ?', [parsedUserId])
    await connection.execute('UPDATE resume_shares SET shared_by = NULL WHERE shared_by = ?', [parsedUserId])
    await connection.execute(
      `UPDATE interviews
       SET interviewer_user_id = IF(interviewer_user_id = ?, NULL, interviewer_user_id),
           created_by = IF(created_by = ?, NULL, created_by)
       WHERE interviewer_user_id = ? OR created_by = ?`,
      [parsedUserId, parsedUserId, parsedUserId, parsedUserId],
    )
    await connection.execute('UPDATE interview_feedback SET entered_by = NULL WHERE entered_by = ?', [parsedUserId])
    await connection.execute('UPDATE selections SET selected_by = NULL WHERE selected_by = ?', [parsedUserId])
    await connection.execute('UPDATE attendance SET approved_by = NULL WHERE approved_by = ?', [parsedUserId])
    await connection.execute('UPDATE invoices SET created_by = NULL WHERE created_by = ?', [parsedUserId])
    await connection.execute('UPDATE user_invitations SET created_by = NULL WHERE created_by = ?', [parsedUserId])
    await connection.execute('UPDATE application_status_history SET changed_by = NULL WHERE changed_by = ?', [parsedUserId])
    await connection.execute('UPDATE audit_logs SET actor_user_id = NULL WHERE actor_user_id = ?', [parsedUserId])
    await connection.execute(
      `UPDATE customer_requirement_intakes
       SET created_by = IF(created_by = ?, NULL, created_by),
           reviewed_by = IF(reviewed_by = ?, NULL, reviewed_by)
       WHERE created_by = ? OR reviewed_by = ?`,
      [parsedUserId, parsedUserId, parsedUserId, parsedUserId],
    )
    await connection.execute(
      `UPDATE agreement_versions
       SET created_by = IF(created_by = ?, NULL, created_by),
           reviewed_by = IF(reviewed_by = ?, NULL, reviewed_by),
           customer_signed_by = IF(customer_signed_by = ?, NULL, customer_signed_by),
           activated_by = IF(activated_by = ?, NULL, activated_by)
       WHERE created_by = ? OR reviewed_by = ? OR customer_signed_by = ? OR activated_by = ?`,
      [parsedUserId, parsedUserId, parsedUserId, parsedUserId, parsedUserId, parsedUserId, parsedUserId, parsedUserId],
    )
    await connection.execute('UPDATE agreement_events SET actor_user_id = NULL WHERE actor_user_id = ?', [parsedUserId])
    await connection.execute('UPDATE candidate_consents SET recorded_by = NULL WHERE recorded_by = ?', [parsedUserId])
    await connection.execute('UPDATE resume_share_events SET actor_user_id = NULL WHERE actor_user_id = ?', [parsedUserId])
    await connection.execute('UPDATE customer_candidate_decisions SET decided_by = NULL WHERE decided_by = ?', [parsedUserId])
    await connection.execute('DELETE FROM users WHERE user_id = ?', [parsedUserId])
    await connection.commit()
    return { message: 'User account deleted. Related business history was retained.' }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function acceptInvitation(token, password) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    throw Object.assign(new Error('Invitation link is invalid or expired.'), { statusCode: 400 })
  }

  const passwordErrors = validatePassword(password)
  if (passwordErrors.length > 0) {
    throw passwordError(passwordErrors)
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw Object.assign(new Error('Password cannot exceed 72 UTF-8 bytes.'), { statusCode: 400 })
  }

  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const [rows] = await connection.execute(
      `SELECT
         i.invitation_id,
         i.user_id,
         i.expires_at,
         i.accepted_at,
         u.status,
         u.password_hash
       FROM user_invitations i
       INNER JOIN users u ON u.user_id = i.user_id
       WHERE i.token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [sha256(token)],
    )

    const invitation = rows[0]

    if (
      !invitation ||
      invitation.accepted_at ||
      invitation.status !== 'INVITED' ||
      invitation.password_hash ||
      new Date(invitation.expires_at).getTime() <= Date.now()
    ) {
      throw Object.assign(new Error('Invitation link is invalid, already used or expired.'), { statusCode: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await connection.execute(
      `UPDATE users
       SET password_hash = ?, status = 'ACTIVE'
       WHERE user_id = ? AND status = 'INVITED' AND password_hash IS NULL`,
      [passwordHash, invitation.user_id],
    )

    await connection.execute(
      `UPDATE user_invitations
       SET accepted_at = CURRENT_TIMESTAMP
       WHERE invitation_id = ?`,
      [invitation.invitation_id],
    )

    await connection.commit()

    return { message: 'Your account is active. You can now sign in.' }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}