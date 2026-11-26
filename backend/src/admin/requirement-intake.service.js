import { createHash, randomBytes } from 'node:crypto'
import { pool } from '../config/db.js'
import { ensureServiceOrdersForActiveAgreements } from '../agreements/agreement.service.js'
import { isEmailConfigured, sendRequirementIntakeEmail } from '../services/email.service.js'
import {
  notifyActiveAdmins,
  notifyActiveCustomerContacts,
} from '../notifications/notification.service.js'
import {
  attachRequirementSkills,
  normalizeRequirementSkills,
  parseStoredRequirementSkills,
} from './requirement-skills.js'

const WORK_MODES = new Set(['ONSITE', 'REMOTE', 'HYBRID'])
const SCHEDULES = new Set(['FULL_TIME', 'PART_TIME'])

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

function validateToken(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
    throw httpError('This requirement form link is invalid or expired.', 400)
  }
}

function optionalNumber(value, label, max) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
    throw httpError(`${label} must be a number from 0 to ${max}.`, 400)
  }
  return parsed
}

function validDate(value) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError('Target join date must be a valid date.', 400)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw httpError('Target join date must be a valid date.', 400)
  }
  return value
}

function validateSubmission(input) {
  const jobTitle = String(input?.jobTitle ?? '').trim()
  const jobDescription = String(input?.jobDescription ?? '').trim()
  const skills = normalizeRequirementSkills(input?.skills)
  const headcount = Number(input?.headcount)
  const workMode = String(input?.workMode ?? '').trim().toUpperCase()
  const workLocation = String(input?.workLocation ?? '').trim() || null
  const employmentSchedule = String(input?.employmentSchedule ?? '').trim().toUpperCase()
  const experienceMin = optionalNumber(input?.experienceMinYears, 'Minimum experience', 999.9)
  const experienceMax = optionalNumber(input?.experienceMaxYears, 'Maximum experience', 999.9)
  const salaryMin = optionalNumber(input?.salaryMin, 'Minimum salary', 9999999999.99)
  const salaryMax = optionalNumber(input?.salaryMax, 'Maximum salary', 9999999999.99)
  const hoursPerWeek = optionalNumber(input?.hoursPerWeek, 'Hours per week', 168)
  const targetJoinDate = validDate(input?.targetJoinDate)

  if (!jobTitle || jobTitle.length > 150) {
    throw httpError('Job title is required and must be 150 characters or fewer.', 400)
  }
  if (!jobDescription || jobDescription.length > 60000) {
    throw httpError('Job description is required and must be 60,000 characters or fewer.', 400)
  }
  if (!Number.isSafeInteger(headcount) || headcount < 1 || headcount > 65535) {
    throw httpError('Headcount must be a whole number from 1 to 65,535.', 400)
  }
  if (!WORK_MODES.has(workMode)) {
    throw httpError('Select a valid work mode.', 400)
  }
  if (workLocation && workLocation.length > 150) {
    throw httpError('Work location must be 150 characters or fewer.', 400)
  }
  if (!SCHEDULES.has(employmentSchedule)) {
    throw httpError('Select a valid employment schedule.', 400)
  }
  if (experienceMin !== null && experienceMax !== null && experienceMax < experienceMin) {
    throw httpError('Maximum experience cannot be less than minimum experience.', 400)
  }
  if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
    throw httpError('Maximum salary cannot be less than minimum salary.', 400)
  }
  if (employmentSchedule === 'PART_TIME' && (hoursPerWeek === null || hoursPerWeek <= 0)) {
    throw httpError('Hours per week is required for part-time roles.', 400)
  }
  if (hoursPerWeek !== null && hoursPerWeek <= 0) {
    throw httpError('Hours per week must be greater than zero.', 400)
  }

  return {
    jobTitle,
    jobDescription,
    skills,
    headcount,
    workMode,
    workLocation,
    experienceMin,
    experienceMax,
    salaryMin,
    salaryMax,
    employmentSchedule,
    hoursPerWeek,
    targetJoinDate,
  }
}

async function getActiveCustomerContact(executor, userId, lock = false) {
  const [contacts] = await executor.execute(
    `SELECT cc.customer_id, cc.contact_id
     FROM customer_contacts cc
     INNER JOIN users u ON u.user_id = cc.user_id
     WHERE cc.user_id = ? AND cc.status = 'ACTIVE' AND u.role = 'CUSTOMER'
     ORDER BY cc.is_primary DESC, cc.contact_id
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [userId],
  )
  const contact = contacts[0]
  if (!contact) {
    throw httpError('No active customer organisation is linked to this account.', 403)
  }
  return contact
}

export async function listCustomerRequirements(userId) {
  const contact = await getActiveCustomerContact(pool, userId)
  await pool.execute(
    `UPDATE customer_requirement_intakes
     SET status = 'EXPIRED'
     WHERE customer_id = ? AND status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP`,
    [contact.customer_id],
  )
  const [[requests], [requirements]] = await Promise.all([
    pool.execute(
      `SELECT i.intake_id, i.job_title, i.skills_requested, i.headcount, i.work_mode, i.employment_schedule,
              i.status, i.submitted_at, i.created_at,
              r.requirement_id, r.requirement_number, r.status AS requirement_status
       FROM customer_requirement_intakes i
       LEFT JOIN job_requirements r ON r.requirement_id = i.requirement_id
       WHERE i.customer_id = ?
       ORDER BY i.created_at DESC, i.intake_id DESC`,
      [contact.customer_id],
    ),
    pool.execute(
      `SELECT r.requirement_id, r.requirement_number, r.job_title, r.headcount,
              r.status, r.work_mode, r.work_location, r.employment_schedule,
              r.created_at, so.order_number
       FROM job_requirements r
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE a.customer_id = ?
       ORDER BY r.created_at DESC, r.requirement_id DESC`,
      [contact.customer_id],
    ),
  ])
  return {
    requests: requests.map((request) => ({
      ...request,
      skills_requested: parseStoredRequirementSkills(request.skills_requested),
    })),
    requirements,
  }
}

export async function submitCustomerRequirementRequest(userId, input) {
  const submission = validateSubmission(input)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const contact = await getActiveCustomerContact(connection, userId, true)
    const token = randomBytes(32).toString('hex')
    const [result] = await connection.execute(
      `INSERT INTO customer_requirement_intakes
        (customer_id, contact_id, token_hash, expires_at, status, job_title, skills_requested,
         job_description, headcount, work_mode, work_location,
         experience_min_years, experience_max_years, salary_min, salary_max,
         employment_schedule, hours_per_week, target_join_date, submitted_at, created_by)
       VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR), 'SUBMITTED',
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [
        contact.customer_id,
        contact.contact_id,
        tokenHash(token),
        submission.jobTitle,
         JSON.stringify(submission.skills),
        submission.jobDescription,
        submission.headcount,
        submission.workMode,
        submission.workLocation,
        submission.experienceMin,
        submission.experienceMax,
        submission.salaryMin,
        submission.salaryMax,
        submission.employmentSchedule,
        submission.hoursPerWeek,
        submission.targetJoinDate,
        userId,
      ],
    )
    await notifyActiveAdmins(connection, {
      type: 'CUSTOMER_REQUIREMENT_SUBMITTED',
      title: 'New customer requirement',
      message: `A customer submitted "${submission.jobTitle}" for review.`,
      targetUrl: '/app/admin/requirement-intakes',
    })
    await connection.commit()
    return {
      intakeId: Number(result.insertId),
      message: 'Your hiring requirement was submitted for review.',
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function frontendBaseUrl() {
  const url = new URL(process.env.FRONTEND_URL || 'http://localhost:5173')
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw httpError('FRONTEND_URL must use HTTP or HTTPS.', 500)
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw httpError('FRONTEND_URL must use HTTPS in production.', 500)
  }
  return url
}

export async function createRequirementIntake(customerId, createdBy) {
  const emailConfigured = isEmailConfigured()
  if (process.env.NODE_ENV === 'production' && !emailConfigured) {
    throw httpError('Customer form email delivery is not configured. Set up SMTP before sending forms in production.', 503)
  }
  const frontendUrl = frontendBaseUrl()

  const connection = await pool.getConnection()
  let intake
  const rawToken = randomBytes(32).toString('hex')

  try {
    await connection.beginTransaction()
    const [contacts] = await connection.execute(
      `SELECT c.customer_id, c.company_name, cc.contact_id, u.user_id,
              u.full_name, u.email
       FROM customers c
       INNER JOIN customer_contacts cc ON cc.customer_id = c.customer_id AND cc.status = 'ACTIVE'
       INNER JOIN users u ON u.user_id = cc.user_id AND u.role = 'CUSTOMER'
         AND u.status IN ('ACTIVE','INVITED')
       WHERE c.customer_id = ?
       ORDER BY cc.is_primary DESC, cc.contact_id
       LIMIT 1
       FOR UPDATE`,
      [customerId],
    )
    const contact = contacts[0]
    if (!contact) {
      throw httpError('This customer has no active contact. Invite a customer contact before sending a requirement form.', 409)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
      throw httpError('The selected customer contact does not have a valid email address.', 409)
    }

    const [result] = await connection.execute(
      `INSERT INTO customer_requirement_intakes
        (customer_id, contact_id, token_hash, expires_at, created_by)
       VALUES (?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 72 HOUR), ?)`,
      [customerId, contact.contact_id, tokenHash(rawToken), createdBy],
    )
    const [intakes] = await connection.execute(
      'SELECT expires_at FROM customer_requirement_intakes WHERE intake_id = ?',
      [result.insertId],
    )
    intake = {
      intakeId: Number(result.insertId),
      companyName: contact.company_name,
      fullName: contact.full_name,
      email: contact.email,
      expiresAt: intakes[0].expires_at,
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const intakeUrl = new URL(`/requirement-form/${rawToken}`, frontendUrl).toString()
  if (emailConfigured) {
    try {
      await sendRequirementIntakeEmail({
        to: intake.email,
        companyName: intake.companyName,
        intakeUrl,
        expiresAt: intake.expiresAt,
      })
    } catch {
      throw httpError('The form request was created, but email delivery failed. Correct SMTP settings and send a fresh form request.', 502)
    }
  }

  return {
    intakeId: intake.intakeId,
    companyName: intake.companyName,
    recipientEmail: intake.email,
    expiresAt: intake.expiresAt,
    ...(emailConfigured ? {} : { intakeUrl }),
  }
}

export async function getRequirementIntake(token) {
  validateToken(token)
  const hash = tokenHash(token)
  const [rows] = await pool.execute(
    `SELECT i.intake_id, i.expires_at, c.company_name
     FROM customer_requirement_intakes i
     INNER JOIN customers c ON c.customer_id = i.customer_id
     WHERE i.token_hash = ? AND i.status = 'PENDING'
       AND i.expires_at > CURRENT_TIMESTAMP
     LIMIT 1`,
    [hash],
  )

  if (!rows[0]) {
    await pool.execute(
      `UPDATE customer_requirement_intakes
       SET status = 'EXPIRED'
       WHERE token_hash = ? AND status = 'PENDING'
         AND expires_at <= CURRENT_TIMESTAMP`,
      [hash],
    )
    throw httpError('This requirement form link is invalid, already used or expired.', 410)
  }

  return {
    companyName: rows[0].company_name,
    expiresAt: rows[0].expires_at,
  }
}

export async function submitRequirementIntake(token, input) {
  validateToken(token)
  const submission = validateSubmission(input)
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute(
      `SELECT intake_id, status, expires_at,
              expires_at > CURRENT_TIMESTAMP AS is_unexpired
       FROM customer_requirement_intakes
       WHERE token_hash = ?
       LIMIT 1
       FOR UPDATE`,
      [tokenHash(token)],
    )
    const intake = rows[0]
    if (!intake || intake.status !== 'PENDING' || Number(intake.is_unexpired) !== 1) {
      throw httpError('This requirement form link is invalid, already used or expired.', 410)
    }

    await connection.execute(
      `UPDATE customer_requirement_intakes
       SET job_title = ?, skills_requested = ?, job_description = ?, headcount = ?, work_mode = ?,
           work_location = ?, experience_min_years = ?, experience_max_years = ?,
           salary_min = ?, salary_max = ?, employment_schedule = ?,
           hours_per_week = ?, target_join_date = ?, status = 'SUBMITTED',
           submitted_at = CURRENT_TIMESTAMP
       WHERE intake_id = ?`,
      [
        submission.jobTitle,
        JSON.stringify(submission.skills),
        submission.jobDescription,
        submission.headcount,
        submission.workMode,
        submission.workLocation,
        submission.experienceMin,
        submission.experienceMax,
        submission.salaryMin,
        submission.salaryMax,
        submission.employmentSchedule,
        submission.hoursPerWeek,
        submission.targetJoinDate,
        intake.intake_id,
      ],
    )
    await connection.commit()
    return { message: 'Your hiring requirement was submitted for review.' }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getRequirementConversionOptions(intakeId, adminUserId) {
  if (!Number.isSafeInteger(intakeId) || intakeId < 1) {
    throw httpError('Invalid requirement request.', 400)
  }

  const [intakes] = await pool.execute(
    `SELECT i.customer_id, i.status, i.job_title, i.skills_requested, i.job_description, i.headcount,
            i.work_mode, i.work_location, i.experience_min_years,
            i.experience_max_years, i.salary_min, i.salary_max,
            i.employment_schedule, i.hours_per_week, i.target_join_date,
            c.company_name
     FROM customer_requirement_intakes i
     INNER JOIN customers c ON c.customer_id = i.customer_id
     WHERE i.intake_id = ?
     LIMIT 1`,
    [intakeId],
  )
  const intake = intakes[0]
  if (!intake || intake.status !== 'SUBMITTED') {
    throw httpError('Only submitted customer forms can be converted.', 409)
  }
  await ensureServiceOrdersForActiveAgreements(adminUserId, Number(intake.customer_id))

  const [jobProfiles] = await pool.execute(
    `SELECT job_profile_id, profile_code, profile_name
     FROM job_profiles
     WHERE status = 'ACTIVE'
     ORDER BY profile_name, job_profile_id`,
  )
  const [serviceOrders] = await pool.execute(
    `SELECT so.service_order_id, so.order_number, so.title, a.agreement_number
     FROM service_orders so
     INNER JOIN agreements a ON a.agreement_id = so.agreement_id
     WHERE a.customer_id = ? AND a.status = 'ACTIVE'
       AND so.status IN ('APPROVED', 'IN_PROGRESS')
       AND EXISTS (
         SELECT 1
         FROM agreement_versions active_version
         INNER JOIN agreement_service_lines line
           ON line.agreement_version_id = active_version.agreement_version_id
         WHERE active_version.agreement_id = a.agreement_id
           AND active_version.status = 'ACTIVE'
           AND line.service_type_id = so.service_type_id
       )
     ORDER BY so.created_at DESC, so.service_order_id DESC`,
    [intake.customer_id],
  )

  return {
    request: {
      companyName: intake.company_name,
      jobTitle: intake.job_title,
      skills: parseStoredRequirementSkills(intake.skills_requested),
      jobDescription: intake.job_description,
      headcount: intake.headcount,
      workMode: intake.work_mode,
      workLocation: intake.work_location,
      experienceMinYears: intake.experience_min_years,
      experienceMaxYears: intake.experience_max_years,
      salaryMin: intake.salary_min,
      salaryMax: intake.salary_max,
      employmentSchedule: intake.employment_schedule,
      hoursPerWeek: intake.hours_per_week,
      targetJoinDate: intake.target_join_date,
    },
    jobProfiles,
    serviceOrders,
  }
}

export async function convertRequirementIntake(intakeId, input, reviewedBy) {
  const serviceOrderId = Number(input?.serviceOrderId)
  const jobProfileId = Number(input?.jobProfileId)
  if (!Number.isSafeInteger(intakeId) || intakeId < 1 ||
      !Number.isSafeInteger(serviceOrderId) || serviceOrderId < 1 ||
      !Number.isSafeInteger(jobProfileId) || jobProfileId < 1) {
    throw httpError('Select a valid job profile and service order.', 400)
  }

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute(
      `SELECT i.*, cc.user_id AS contact_user_id
       FROM customer_requirement_intakes i
       INNER JOIN customer_contacts cc ON cc.contact_id = i.contact_id
       WHERE i.intake_id = ?
       LIMIT 1
       FOR UPDATE`,
      [intakeId],
    )
    const intake = rows[0]
    if (!intake || intake.status !== 'SUBMITTED') {
      throw httpError('Only submitted customer forms can be converted.', 409)
    }
    const jobTitle = input?.jobTitle === undefined
      ? String(intake.job_title ?? '').trim()
      : typeof input.jobTitle === 'string'
        ? input.jobTitle.trim()
        : ''
    if (!jobTitle || jobTitle.length > 150) {
      throw httpError('Job title is required and must be 150 characters or fewer.', 400)
    }
    const skills = input?.skills === undefined
      ? parseStoredRequirementSkills(intake.skills_requested)
      : normalizeRequirementSkills(input.skills)

    const [orders] = await connection.execute(
      `SELECT service_order_id
       FROM service_orders so
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE so.service_order_id = ? AND a.customer_id = ?
         AND a.status = 'ACTIVE'
         AND so.status IN ('APPROVED', 'IN_PROGRESS')
         AND EXISTS (
           SELECT 1
           FROM agreement_versions active_version
           INNER JOIN agreement_service_lines line
             ON line.agreement_version_id = active_version.agreement_version_id
           WHERE active_version.agreement_id = a.agreement_id
             AND active_version.status = 'ACTIVE'
             AND line.service_type_id = so.service_type_id
         )
       LIMIT 1
       FOR UPDATE`,
      [serviceOrderId, intake.customer_id],
    )
    if (!orders[0]) {
      throw httpError('Select an approved or in-progress service order belonging to this customer.', 409)
    }

    const [profiles] = await connection.execute(
      `SELECT job_profile_id
       FROM job_profiles
       WHERE job_profile_id = ? AND status = 'ACTIVE'
       LIMIT 1`,
      [jobProfileId],
    )
    if (!profiles[0]) {
      throw httpError('Select an active job profile.', 409)
    }

    const requirementNumber = `REQ-EXT-${intakeId}`
    const [result] = await connection.execute(
      `INSERT INTO job_requirements
        (requirement_number, service_order_id, job_profile_id, raised_by_user_id,
         job_title, job_description, headcount, work_mode, work_location,
         experience_min_years, experience_max_years, salary_min, salary_max,
         employment_schedule, hours_per_week, target_join_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_APPROVAL')`,
      [
        requirementNumber,
        serviceOrderId,
        jobProfileId,
        intake.contact_user_id,
        jobTitle,
        intake.job_description,
        intake.headcount,
        intake.work_mode,
        intake.work_location,
        intake.experience_min_years,
        intake.experience_max_years,
        intake.salary_min,
        intake.salary_max,
        intake.employment_schedule,
        intake.hours_per_week,
        intake.target_join_date,
      ],
    )
    await attachRequirementSkills(connection, result.insertId, skills)

    await connection.execute(
      `UPDATE customer_requirement_intakes
       SET status = 'CONVERTED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
           requirement_id = ?
       WHERE intake_id = ?`,
      [reviewedBy, result.insertId, intakeId],
    )
    await notifyActiveCustomerContacts(connection, Number(intake.customer_id), {
      type: 'CUSTOMER_REQUIREMENT_CONVERTED',
      title: `Requirement received: ${requirementNumber}`,
      message: 'Your request was converted and is awaiting internal approval.',
      targetUrl: '/app/my-requirements',
    })
    await connection.commit()
    return {
      requirementId: Number(result.insertId),
      requirementNumber,
      message: 'Customer request converted to a requirement pending internal approval.',
    }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}
