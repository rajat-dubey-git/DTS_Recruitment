import { pool } from '../config/db.js'
import { ensureServiceOrdersForActiveAgreements } from '../agreements/agreement.service.js'
import {
  convertRequirementIntake,
  createRequirementIntake,
  getRequirementConversionOptions,
} from './requirement-intake.service.js'
import {
  attachRequirementSkills,
  normalizeRequirementSkills,
} from './requirement-skills.js'
import { ensureCandidateProfile } from '../candidate/account-link.service.js'
import {
  createNotification,
  notifyActiveCustomerContacts,
  notifyAssignedRecruiters,
} from '../notifications/notification.service.js'

const MAX_LIMIT = 100
const MAX_OFFSET = 1000000

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

function requiredText(input, key, label, maxLength) {
  const value = typeof input?.[key] === 'string' ? input[key].trim() : ''
  if (!value || value.length > maxLength) {
    throw badRequest(`${label} is required and must be ${maxLength} characters or fewer.`)
  }
  return value
}

function optionalText(input, key, label, maxLength) {
  const value = typeof input?.[key] === 'string' ? input[key].trim() : ''
  if (value.length > maxLength) {
    throw badRequest(`${label} must be ${maxLength} characters or fewer.`)
  }
  return value || null
}

function enumValue(value, label, allowed) {
  if (!allowed.includes(value)) {
    throw badRequest(`Select a valid ${label}.`)
  }
  return value
}

function positiveId(value, label) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw badRequest(`Select a valid ${label}.`)
  }
  return parsed
}

function numberValue(value, label, { min = 0, max = 9999999999.99, optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return null
  if (value === undefined || value === null || value === '') {
    throw badRequest(`${label} is required.`)
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw badRequest(`${label} must be a number.`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw badRequest(`${label} must be a number from ${min} to ${max}.`)
  }
  return parsed
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${label} must be a valid date.`)
  }
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw badRequest(`${label} must be a valid date.`)
  }
  return value
}

function optionalBoolean(value, label) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1
  if (value === false || value === 0 || value === '0' || value === 'false' || value === undefined) return 0
  throw badRequest(`${label} must be selected or cleared.`)
}

async function insertWorkspaceRecord(module, input, actorId) {
  if (module === 'customers') {
    const customerCode = requiredText(input, 'customerCode', 'Customer code', 30).toUpperCase()
    const companyName = requiredText(input, 'companyName', 'Company name', 200)
    const gstin = optionalText(input, 'gstin', 'GSTIN', 15)?.toUpperCase() ?? null
    const pan = optionalText(input, 'pan', 'PAN', 10)?.toUpperCase() ?? null
    const industry = optionalText(input, 'industry', 'Industry', 100)
    const paymentTermsDays = input.paymentTermsDays === '' || input.paymentTermsDays === undefined
      ? 30
      : Number(input.paymentTermsDays)
    const status = enumValue(input.status ?? 'PROSPECT', 'customer status', ['PROSPECT', 'ACTIVE', 'INACTIVE'])
    if (!Number.isSafeInteger(paymentTermsDays) || paymentTermsDays < 0 || paymentTermsDays > 365) {
      throw badRequest('Payment terms must be a whole number from 0 to 365.')
    }

    const [result] = await pool.execute(
      `INSERT INTO customers
        (customer_code, company_name, gstin, pan, industry, payment_terms_days, status, account_owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customerCode, companyName, gstin, pan, industry, paymentTermsDays, status, actorId],
    )
    return { customerId: Number(result.insertId) }
  }

  if (module === 'skills') {
    const skillName = requiredText(input, 'skillName', 'Skill name', 100)
    const skillCategory = optionalText(input, 'skillCategory', 'Skill category', 60)
    const [result] = await pool.execute(
      'INSERT INTO skills (skill_name, skill_category) VALUES (?, ?)',
      [skillName, skillCategory],
    )
    return { skillId: Number(result.insertId) }
  }

  if (module === 'service-types') {
    const serviceCode = requiredText(input, 'serviceCode', 'Service code', 30).toUpperCase()
    const serviceName = requiredText(input, 'serviceName', 'Service name', 100)
    const employmentModel = enumValue(input.employmentModel, 'employment model', ['DTS_PAYROLL', 'CUSTOMER_PAYROLL'])
    const [result] = await pool.execute(
      'INSERT INTO service_types (service_code, service_name, employment_model) VALUES (?, ?, ?)',
      [serviceCode, serviceName, employmentModel],
    )
    return { serviceTypeId: Number(result.insertId) }
  }

  if (module === 'job-profiles') {
    const profileCode = requiredText(input, 'profileCode', 'Profile code', 30).toUpperCase()
    const profileName = requiredText(input, 'profileName', 'Profile name', 150)
    const category = optionalText(input, 'category', 'Category', 100)
    const purpose = requiredText(input, 'purpose', 'Purpose', 60000)
    const responsibilities = requiredText(input, 'keyResponsibilities', 'Key responsibilities', 60000)
    const qualifications = optionalText(input, 'qualifications', 'Qualifications', 60000)
    const reportingTo = optionalText(input, 'reportingTo', 'Reporting to', 150)
    const experienceMin = numberValue(input.experienceMin, 'Minimum experience', { max: 999.9, optional: true })
    const experienceMax = numberValue(input.experienceMax, 'Maximum experience', { max: 999.9, optional: true })
    const status = enumValue(input.status ?? 'DRAFT', 'job profile status', ['DRAFT', 'ACTIVE', 'ARCHIVED'])
    if (input.skillIds !== undefined && !Array.isArray(input.skillIds)) {
      throw badRequest('Skills must be supplied as a list.')
    }
    if (Array.isArray(input.skillIds) && input.skillIds.length > 100) {
      throw badRequest('Select no more than 100 skills.')
    }
    const skillIds = Array.isArray(input.skillIds)
      ? [...new Set(input.skillIds.map((id) => positiveId(id, 'skill')))]
      : []

    if (experienceMin !== null && experienceMax !== null && experienceMax < experienceMin) {
      throw badRequest('Maximum experience cannot be less than minimum experience.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [result] = await connection.execute(
        `INSERT INTO job_profiles
          (profile_code, profile_name, category, purpose, key_responsibilities,
           qualifications, reporting_to, default_experience_min,
           default_experience_max, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          profileCode,
          profileName,
          category,
          purpose,
          responsibilities,
          qualifications,
          reportingTo,
          experienceMin,
          experienceMax,
          status,
          actorId,
        ],
      )

      for (const skillId of skillIds) {
        await connection.execute(
          `INSERT INTO job_profile_skills (job_profile_id, skill_id, is_mandatory)
           VALUES (?, ?, 1)`,
          [result.insertId, skillId],
        )
      }

      await connection.commit()
      return { jobProfileId: Number(result.insertId) }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  if (module === 'agreements') {
    const agreementNumber = requiredText(input, 'agreementNumber', 'Agreement number', 50)
    const customerId = positiveId(input.customerId, 'customer')
    const title = requiredText(input, 'title', 'Agreement title', 200)
    const status = enumValue(input.status ?? 'DRAFT', 'agreement status', [
      'DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED',
    ])
    const effectiveDate = optionalDate(input.effectiveDate, 'Effective date')
    const expiryDate = optionalDate(input.expiryDate, 'Expiry date')
    const signedDate = optionalDate(input.signedDate, 'Signed date')
    const autoRenew = optionalBoolean(input.autoRenew, 'Auto-renew')

    if (expiryDate && effectiveDate && expiryDate < effectiveDate) {
      throw badRequest('Expiry date cannot be earlier than the effective date.')
    }
    if (status === 'ACTIVE' && (!effectiveDate || !signedDate)) {
      throw badRequest('Active agreements require an effective date and a signed date.')
    }

    const [result] = await pool.execute(
      `INSERT INTO agreements
        (agreement_number, customer_id, title, status, effective_date, expiry_date,
         signed_date, auto_renew, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agreementNumber, customerId, title, status, effectiveDate, expiryDate, signedDate, autoRenew, actorId],
    )
    return { agreementId: Number(result.insertId) }
  }

  if (module === 'rate-cards') {
    const agreementId = positiveId(input.agreementId, 'agreement')
    const serviceTypeId = positiveId(input.serviceTypeId, 'service type')
    const jobProfileId = positiveId(input.jobProfileId, 'job profile')
    const feeType = enumValue(input.feeType, 'fee type', ['PERCENTAGE', 'FIXED_AMOUNT', 'SALARY_MONTHS'])
    const feeBasis = enumValue(input.feeBasis, 'fee basis', ['MONTHLY_SALARY', 'ANNUAL_CTC', 'HOURLY', 'PER_PLACEMENT'])
    const feeValue = numberValue(input.feeValue, 'Fee value')
    const billingFrequency = enumValue(input.billingFrequency, 'billing frequency', ['ONE_TIME', 'MONTHLY', 'QUARTERLY'])
    const replacementDays = input.replacementDays === '' || input.replacementDays === undefined
      ? null
      : Number(input.replacementDays)
    const effectiveFrom = optionalDate(input.effectiveFrom, 'Effective from')
    const effectiveTo = optionalDate(input.effectiveTo, 'Effective to')
    if (feeType === 'PERCENTAGE' && feeValue > 100) {
      throw badRequest('Percentage fee value cannot exceed 100.')
    }
    if (replacementDays !== null && (!Number.isSafeInteger(replacementDays) || replacementDays < 0 || replacementDays > 65535)) {
      throw badRequest('Replacement days must be a whole number from 0 to 65,535.')
    }
    if (!effectiveFrom) throw badRequest('Effective from date is required.')
    if (effectiveTo && effectiveTo < effectiveFrom) throw badRequest('Effective to cannot be earlier than effective from.')

    const [result] = await pool.execute(
      `INSERT INTO rate_cards
        (agreement_id, service_type_id, job_profile_id, fee_type, fee_basis,
         fee_value, billing_frequency, replacement_days, effective_from, effective_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [agreementId, serviceTypeId, jobProfileId, feeType, feeBasis, feeValue, billingFrequency, replacementDays, effectiveFrom, effectiveTo],
    )
    return { rateCardId: Number(result.insertId) }
  }

  if (module === 'service-orders') {
    const orderNumber = requiredText(input, 'orderNumber', 'Order number', 50)
    const agreementId = positiveId(input.agreementId, 'agreement')
    const serviceTypeId = positiveId(input.serviceTypeId, 'service type')
    const customerReference = optionalText(input, 'customerReference', 'Customer reference', 100)
    const title = requiredText(input, 'title', 'Service order title', 200)
    const scopeDescription = optionalText(input, 'scopeDescription', 'Scope description', 60000)
    const startDate = optionalDate(input.startDate, 'Start date')
    const endDate = optionalDate(input.endDate, 'End date')
    const status = enumValue(input.status ?? 'DRAFT', 'service order status', ['DRAFT', 'PENDING_APPROVAL'])
    if (endDate && startDate && endDate < startDate) {
      throw badRequest('End date cannot be earlier than the start date.')
    }
    const [coveredServices] = await pool.execute(
      `SELECT line.agreement_service_line_id
       FROM agreement_versions version
       INNER JOIN agreement_service_lines line
         ON line.agreement_version_id = version.agreement_version_id
       WHERE version.agreement_id = ?
         AND version.version_number = (
           SELECT MAX(latest.version_number)
           FROM agreement_versions latest
           WHERE latest.agreement_id = version.agreement_id
         )
         AND line.service_type_id = ?
       LIMIT 1`,
      [agreementId, serviceTypeId],
    )
    if (!coveredServices[0]) {
      throw Object.assign(
        new Error('Select a service included in the agreement’s latest version.'),
        { statusCode: 409 },
      )
    }

    const [result] = await pool.execute(
      `INSERT INTO service_orders
        (order_number, agreement_id, service_type_id, customer_reference, title,
         scope_description, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, agreementId, serviceTypeId, customerReference, title, scopeDescription, startDate, endDate, status],
    )
    return { serviceOrderId: Number(result.insertId) }
  }

  if (module === 'requirements') {
    const requirementNumber = requiredText(input, 'requirementNumber', 'Requirement number', 50)
    const serviceOrderId = positiveId(input.serviceOrderId, 'approved service order')
    const jobProfileId = positiveId(input.jobProfileId, 'active job profile')
    const jobTitle = requiredText(input, 'jobTitle', 'Job title', 150)
    const skills = normalizeRequirementSkills(input.skills)
    const jobDescription = requiredText(input, 'jobDescription', 'Job description', 60000)
    const headcount = numberValue(input.headcount, 'Headcount', { min: 1, max: 65535 })
    const workMode = enumValue(input.workMode, 'work mode', ['ONSITE', 'REMOTE', 'HYBRID'])
    const workLocation = optionalText(input, 'workLocation', 'Work location', 150)
    const experienceMin = numberValue(input.experienceMinYears, 'Minimum experience', { max: 999.9, optional: true })
    const experienceMax = numberValue(input.experienceMaxYears, 'Maximum experience', { max: 999.9, optional: true })
    const salaryMin = numberValue(input.salaryMin, 'Minimum salary', { optional: true })
    const salaryMax = numberValue(input.salaryMax, 'Maximum salary', { optional: true })
    const employmentSchedule = enumValue(input.employmentSchedule, 'employment schedule', ['FULL_TIME', 'PART_TIME'])
    const hoursPerWeek = numberValue(input.hoursPerWeek, 'Hours per week', { min: 0.01, max: 168, optional: true })
    const targetJoinDate = optionalDate(input.targetJoinDate, 'Target join date')

    if (!Number.isSafeInteger(headcount)) {
      throw badRequest('Headcount must be a whole number from 1 to 65,535.')
    }
    if (experienceMin !== null && experienceMax !== null && experienceMax < experienceMin) {
      throw badRequest('Maximum experience cannot be less than minimum experience.')
    }
    if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
      throw badRequest('Maximum salary cannot be less than minimum salary.')
    }
    if (employmentSchedule === 'PART_TIME' && hoursPerWeek === null) {
      throw badRequest('Hours per week is required for part-time roles.')
    }

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [orders] = await connection.execute(
        `SELECT so.service_order_id
         FROM service_orders so
         INNER JOIN agreements a ON a.agreement_id = so.agreement_id
         WHERE so.service_order_id = ? AND a.status = 'ACTIVE'
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
        [serviceOrderId],
      )
      if (!orders[0]) {
        throw Object.assign(new Error('Select an approved or in-progress service order.'), { statusCode: 409 })
      }

      const [profiles] = await connection.execute(
        `SELECT job_profile_id
         FROM job_profiles
         WHERE job_profile_id = ? AND status = 'ACTIVE'
         LIMIT 1`,
        [jobProfileId],
      )
      if (!profiles[0]) {
        throw Object.assign(new Error('Select an active job profile.'), { statusCode: 409 })
      }

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
          actorId,
          jobTitle,
          jobDescription,
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
        ],
      )

      await attachRequirementSkills(connection, result.insertId, skills)
      await connection.commit()
      return { requirementId: Number(result.insertId) }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  throw badRequest('Create is not supported for this business module.')
}

function listOptions(req) {
  const limit = req.query.limit === undefined ? 50 : Number(req.query.limit)
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset)
  const search = req.query.search ?? ''
  const status = req.query.status ?? ''

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw badRequest(`limit must be an integer from 1 to ${MAX_LIMIT}.`)
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw badRequest(`offset must be an integer from 0 to ${MAX_OFFSET}.`)
  }
  if (typeof search !== 'string' || search.length > 100) {
    throw badRequest('search must be a string of 100 characters or fewer.')
  }

  return { limit, offset, search: search.trim(), status: typeof status === 'string' ? status.trim() : '' }
}

function parseColumnFilters(req, filterColumns) {
  const raw = req.query.filters
  if (!raw || !filterColumns || filterColumns.length === 0) {
    return { sql: '', values: [] }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw badRequest('filters must be a JSON object.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw badRequest('filters must be a JSON object.')
  }
  const allowed = new Set(filterColumns.map((column) => column.column))
  const conditions = []
  const values = []
  for (const [column, value] of Object.entries(parsed)) {
    if (!allowed.has(column)) continue
    if (value === undefined || value === null || value === '') continue
    if (typeof value === 'object' && value.like !== undefined) {
      conditions.push(`${column} LIKE ?`)
      values.push(`%${String(value.like)}%`)
    } else if (
      typeof value === 'object' &&
      value !== null &&
      (value.from !== undefined || value.to !== undefined)
    ) {
      if (value.from !== undefined && value.to !== undefined) {
        conditions.push(`${column} BETWEEN ? AND ?`)
        values.push(value.from, value.to)
      } else if (value.from !== undefined) {
        conditions.push(`${column} >= ?`)
        values.push(value.from)
      } else {
        conditions.push(`${column} <= ?`)
        values.push(value.to)
      }
    } else {
      conditions.push(`${column} = ?`)
      values.push(value)
    }
  }
  return {
    sql: conditions.length ? ` AND (${conditions.join(' AND ')})` : '',
    values,
  }
}

async function listPage(req, res, next, {
  columns, from, where = '1 = 1', searchColumns, statusColumn, orderBy, filterColumns,
}) {
  try {
    const { limit, offset, search, status } = listOptions(req)
    const values = []
    let filter = where

    if (search) {
      filter += ` AND (${searchColumns.map((column) => `${column} LIKE ?`).join(' OR ')})`
      values.push(...searchColumns.map(() => `%${search}%`))
    }

    const columnFilter = parseColumnFilters(req, filterColumns)
    filter += columnFilter.sql
    values.push(...columnFilter.values)

    if (status && status !== 'ALL' && statusColumn) {
      filter += ` AND ${statusColumn} = ?`
      values.push(status)
    }

    const [rows] = await pool.execute(
      `SELECT ${columns}
       FROM ${from}
       WHERE ${filter}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [...values, limit, offset],
    )
    const [counts] = await pool.execute(
      `SELECT COUNT(*) AS total FROM ${from} WHERE ${filter}`,
      values,
    )
    const filterOptions = {}
    for (const column of filterColumns ?? []) {
      if (column.type !== 'enum') continue
      const [options] = await pool.execute(
        `SELECT DISTINCT ${column.column} AS value
         FROM ${from}
         WHERE (${where}) AND ${column.column} IS NOT NULL
         ORDER BY ${column.column}`,
      )
      filterOptions[column.column] = options.map((option) => option.value)
    }

    return res.json({
      rows,
      total: Number(counts[0].total),
      limit,
      offset,
      filterOptions,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getDashboardSummary(_req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM customers) AS customers,
         (SELECT COUNT(*) FROM users WHERE role = 'RECRUITER' AND status = 'ACTIVE') AS activeRecruiters,
         (SELECT COUNT(*) FROM job_profiles WHERE status = 'ACTIVE') AS activeJobProfiles,
         (SELECT COUNT(*) FROM job_requirements WHERE status = 'OPEN') AS openRequirements`,
    )

    return res.json({
      summary: Object.fromEntries(
        Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]),
      ),
    })
  } catch (error) {
    return next(error)
  }
}

export function listCustomers(req, res, next) {
  return listPage(req, res, next, {
    columns: 'customer_id, customer_code, company_name, industry, status, payment_terms_days',
    from: 'customers',
    searchColumns: ['customer_code', 'company_name', 'industry'],
    statusColumn: 'status',
    filterColumns: [
      { column: 'customer_code', type: 'text' },
      { column: 'company_name', type: 'text' },
      { column: 'industry', type: 'text' },
      { column: 'status', type: 'enum' },
      { column: 'payment_terms_days', type: 'numeric' },
    ],
    orderBy: 'company_name, customer_id',
  })
}

export function listCustomerAddresses(req, res, next) {
  return listPage(req, res, next, {
    columns: `ca.address_id, c.company_name, ca.address_type, ca.address_line,
      ca.city, ca.state, ca.postal_code, ca.is_primary`,
    from: `customer_addresses ca
      INNER JOIN customers c ON c.customer_id = ca.customer_id`,
    searchColumns: ['c.company_name', 'ca.city', 'ca.state', 'ca.postal_code'],
    filterColumns: [
      { column: 'ca.address_type', type: 'enum' },
    ],
    orderBy: 'c.company_name, ca.address_type, ca.address_id',
  })
}

export function listCustomerContacts(req, res, next) {
  return listPage(req, res, next, {
    columns: `cc.contact_id, c.company_name, COALESCE(u.full_name, 'Deleted account') AS full_name, u.email,
      cc.designation, cc.contact_type, cc.is_primary, cc.status`,
    from: `customer_contacts cc
      INNER JOIN customers c ON c.customer_id = cc.customer_id
      LEFT JOIN users u ON u.user_id = cc.user_id`,
    searchColumns: ['c.company_name', 'COALESCE(u.full_name, \'\')', 'u.email', 'cc.designation'],
    statusColumn: 'cc.status',
    filterColumns: [
      { column: 'c.company_name', type: 'text' },
      { column: 'u.full_name', type: 'text' },
      { column: 'u.email', type: 'text' },
      { column: 'cc.designation', type: 'text' },
      { column: 'cc.contact_type', type: 'enum' },
      { column: 'cc.status', type: 'enum' },
    ],
    orderBy: 'c.company_name, u.full_name, cc.contact_id',
  })
}

export function listRecruiters(req, res, next) {
  return listPage(req, res, next, {
    columns: 'user_id, full_name, email, status, last_login_at',
    from: 'users',
    where: "role = 'RECRUITER'",
    searchColumns: ['full_name', 'email'],
    statusColumn: 'status',
    filterColumns: [
      { column: 'full_name', type: 'text' },
      { column: 'email', type: 'text' },
      { column: 'status', type: 'enum' },
    ],
    orderBy: 'full_name, user_id',
  })
}

export function listUsers(req, res, next) {
  return listPage(req, res, next, {
    columns: `u.user_id, u.full_name, u.email, u.mobile, u.role, u.status,
      u.last_login_at,
      (SELECT c.company_name
       FROM customer_contacts cc
       INNER JOIN customers c ON c.customer_id = cc.customer_id
       WHERE cc.user_id = u.user_id
       ORDER BY cc.is_primary DESC, cc.contact_id
        LIMIT 1) AS customer_company,
        CASE WHEN u.role = 'CANDIDATE' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM candidates candidate WHERE candidate.user_id = u.user_id
          ) THEN 'LINKED' ELSE 'MISSING' END
        ELSE NULL END AS candidate_profile_status`,
    from: 'users u',
    searchColumns: ['u.full_name', 'u.email', 'u.mobile', 'u.role', 'u.status'],
    statusColumn: 'u.status',
    filterColumns: [
      { column: 'u.full_name', type: 'text' },
      { column: 'u.email', type: 'text' },
      { column: 'u.mobile', type: 'text' },
      { column: 'u.role', type: 'enum' },
      { column: 'u.status', type: 'enum' },
      { column: 'customer_company', type: 'text' },
    ],
    orderBy: 'u.full_name, u.user_id',
  })
}

export function listSkills(req, res, next) {
  return listPage(req, res, next, {
    columns: 'skill_id, skill_name, skill_category',
    from: 'skills',
    searchColumns: ['skill_name', 'skill_category'],
    filterColumns: [
      { column: 'skill_name', type: 'text' },
      { column: 'skill_category', type: 'text' },
    ],
    orderBy: 'skill_name, skill_id',
  })
}

export function listServiceTypes(req, res, next) {
  return listPage(req, res, next, {
    columns: 'service_type_id, service_code, service_name, employment_model',
    from: 'service_types',
    searchColumns: ['service_code', 'service_name', 'employment_model'],
    filterColumns: [
      { column: 'service_code', type: 'text' },
      { column: 'service_name', type: 'text' },
      { column: 'employment_model', type: 'enum' },
    ],
    orderBy: 'service_name, service_type_id',
  })
}

export function listJobProfiles(req, res, next) {
  return listPage(req, res, next, {
    columns: `job_profile_id, profile_code, profile_name, category,
      default_experience_min, default_experience_max, status`,
    from: 'job_profiles',
    searchColumns: ['profile_code', 'profile_name', 'category'],
    statusColumn: 'status',
    filterColumns: [
      { column: 'profile_code', type: 'text' },
      { column: 'profile_name', type: 'text' },
      { column: 'category', type: 'text' },
      { column: 'status', type: 'enum' },
      { column: 'default_experience_min', type: 'numeric' },
      { column: 'default_experience_max', type: 'numeric' },
    ],
    orderBy: 'profile_name, job_profile_id',
  })
}

export function listAgreements(req, res, next) {
  return listPage(req, res, next, {
    columns: `a.agreement_id, a.agreement_number, c.company_name, a.title,
      COALESCE(current_version.status, a.status) AS status,
      a.effective_date, a.expiry_date, a.signed_date`,
    from: `agreements a
      INNER JOIN customers c ON c.customer_id = a.customer_id
      LEFT JOIN (
        SELECT version.agreement_id, version.status
        FROM agreement_versions version
        INNER JOIN (
          SELECT agreement_id, MAX(version_number) AS version_number
          FROM agreement_versions
          GROUP BY agreement_id
        ) latest ON latest.agreement_id = version.agreement_id
          AND latest.version_number = version.version_number
      ) current_version ON current_version.agreement_id = a.agreement_id`,
    searchColumns: ['a.agreement_number', 'c.company_name', 'a.title', 'COALESCE(current_version.status, a.status)'],
    statusColumn: 'COALESCE(current_version.status, a.status)',
    filterColumns: [
      { column: 'a.agreement_number', type: 'text' },
      { column: 'c.company_name', type: 'text' },
      { column: 'a.title', type: 'text' },
      { column: 'COALESCE(current_version.status, a.status)', type: 'enum' },
      { column: 'a.effective_date', type: 'date' },
      { column: 'a.expiry_date', type: 'date' },
    ],
    orderBy: 'a.created_at DESC, a.agreement_id DESC',
  })
}

export function listRateCards(req, res, next) {
  return listPage(req, res, next, {
    columns: `rc.rate_card_id, a.agreement_number, c.company_name,
      st.service_name, jp.profile_name, rc.fee_type, rc.fee_basis,
      rc.fee_value, rc.billing_frequency, rc.effective_from, rc.effective_to`,
    from: `rate_cards rc
      INNER JOIN agreements a ON a.agreement_id = rc.agreement_id
      INNER JOIN customers c ON c.customer_id = a.customer_id
      INNER JOIN service_types st ON st.service_type_id = rc.service_type_id
      INNER JOIN job_profiles jp ON jp.job_profile_id = rc.job_profile_id`,
    searchColumns: ['a.agreement_number', 'c.company_name', 'st.service_name', 'jp.profile_name'],
    filterColumns: [
      { column: 'a.agreement_number', type: 'text' },
      { column: 'c.company_name', type: 'text' },
      { column: 'st.service_name', type: 'text' },
      { column: 'jp.profile_name', type: 'text' },
      { column: 'rc.fee_type', type: 'enum' },
      { column: 'rc.fee_basis', type: 'enum' },
      { column: 'rc.billing_frequency', type: 'enum' },
      { column: 'rc.fee_value', type: 'numeric' },
      { column: 'rc.effective_from', type: 'date' },
      { column: 'rc.effective_to', type: 'date' },
    ],
    orderBy: 'a.agreement_number, rc.effective_from DESC, rc.rate_card_id DESC',
  })
}

export function listServiceOrders(req, res, next) {
  return listPage(req, res, next, {
    columns: `so.service_order_id, so.order_number, a.agreement_number,
      c.company_name, st.service_name, so.title, so.start_date, so.end_date, so.status`,
    from: `service_orders so
      INNER JOIN agreements a ON a.agreement_id = so.agreement_id
      INNER JOIN customers c ON c.customer_id = a.customer_id
      INNER JOIN service_types st ON st.service_type_id = so.service_type_id`,
    searchColumns: ['so.order_number', 'a.agreement_number', 'c.company_name', 'st.service_name', 'so.title'],
    statusColumn: 'so.status',
    filterColumns: [
      { column: 'so.order_number', type: 'text' },
      { column: 'a.agreement_number', type: 'text' },
      { column: 'c.company_name', type: 'text' },
      { column: 'st.service_name', type: 'text' },
      { column: 'so.title', type: 'text' },
      { column: 'so.status', type: 'enum' },
      { column: 'so.start_date', type: 'date' },
      { column: 'so.end_date', type: 'date' },
    ],
    orderBy: 'so.created_at DESC, so.service_order_id DESC',
  })
}

export function listRequirements(req, res, next) {
  return listPage(req, res, next, {
    columns: `r.requirement_id, r.requirement_number, c.company_name,
      r.job_title, jp.profile_name, r.headcount, r.work_mode, r.status, r.created_at,
      (SELECT GROUP_CONCAT(DISTINCT assigned_user.full_name ORDER BY assigned_user.full_name SEPARATOR ', ')
       FROM requirement_assignments assigned
       INNER JOIN users assigned_user ON assigned_user.user_id = assigned.recruiter_id
       WHERE assigned.requirement_id = r.requirement_id AND assigned.unassigned_at IS NULL
      ) AS assigned_recruiters`,
    from: `job_requirements r
      INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
      INNER JOIN agreements a ON a.agreement_id = so.agreement_id
      INNER JOIN customers c ON c.customer_id = a.customer_id
      INNER JOIN job_profiles jp ON jp.job_profile_id = r.job_profile_id`,
    searchColumns: ['r.requirement_number', 'c.company_name', 'r.job_title', 'jp.profile_name'],
    statusColumn: 'r.status',
    filterColumns: [
      { column: 'r.requirement_number', type: 'text' },
      { column: 'c.company_name', type: 'text' },
      { column: 'r.job_title', type: 'text' },
      { column: 'jp.profile_name', type: 'text' },
      { column: 'r.headcount', type: 'numeric' },
      { column: 'r.work_mode', type: 'enum' },
      { column: 'r.status', type: 'enum' },
    ],
    orderBy: 'r.created_at DESC, r.requirement_id DESC',
  })
}

export async function getRequirementAssignmentOptions(req, res, next) {
  try {
    const requirementId = positiveId(req.params.requirementId, 'requirement')
    const [requirements] = await pool.execute(
      'SELECT requirement_id, job_title, status FROM job_requirements WHERE requirement_id = ?',
      [requirementId],
    )
    if (!requirements[0]) {
      return res.status(404).json({ message: 'Requirement not found.' })
    }

    const [recruiters] = await pool.execute(
      `SELECT user_id, full_name, email
       FROM users
       WHERE role = 'RECRUITER' AND status = 'ACTIVE'
       ORDER BY full_name, user_id`,
    )
    const [assignments] = await pool.execute(
      `SELECT ra.recruiter_id, ra.assignment_role, u.full_name, u.email
       FROM requirement_assignments ra
       INNER JOIN users u ON u.user_id = ra.recruiter_id
       WHERE ra.requirement_id = ? AND ra.unassigned_at IS NULL
       ORDER BY ra.assignment_role, u.full_name`,
      [requirementId],
    )
    return res.json({ requirement: requirements[0], recruiters, assignments })
  } catch (error) {
    return next(error)
  }
}

export async function assignRequirementRecruiter(req, res, next) {
  const connection = await pool.getConnection()
  try {
    const requirementId = positiveId(req.params.requirementId, 'requirement')
    const recruiterId = positiveId(req.body?.recruiterId, 'recruiter')
    const assignmentRole = req.body?.assignmentRole ?? 'LEAD'
    if (!['LEAD', 'SUPPORT'].includes(assignmentRole)) {
      throw badRequest('Assignment role must be LEAD or SUPPORT.')
    }

    await connection.beginTransaction()
    const [requirements] = await connection.execute(
      `SELECT r.requirement_id, r.status, r.requirement_number, r.job_title,
              a.customer_id
       FROM job_requirements r
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE r.requirement_id = ?
       FOR UPDATE`,
      [requirementId],
    )
    if (!requirements[0]) {
      throw Object.assign(new Error('Requirement not found.'), { statusCode: 404 })
    }
    if (!['APPROVED', 'OPEN'].includes(requirements[0].status)) {
      throw Object.assign(new Error('Only approved or open requirements can be assigned.'), { statusCode: 409 })
    }

    const [recruiters] = await connection.execute(
      `SELECT user_id
       FROM users
       WHERE user_id = ? AND role = 'RECRUITER' AND status = 'ACTIVE'
       LIMIT 1`,
      [recruiterId],
    )
    if (!recruiters[0]) {
      throw Object.assign(new Error('Select an active recruiter account.'), { statusCode: 400 })
    }

    if (assignmentRole === 'LEAD') {
      await connection.execute(
        `UPDATE requirement_assignments
         SET unassigned_at = CURRENT_TIMESTAMP
         WHERE requirement_id = ? AND assignment_role = 'LEAD'
           AND recruiter_id <> ? AND unassigned_at IS NULL`,
        [requirementId, recruiterId],
      )
    }

    const [existing] = await connection.execute(
      `SELECT assignment_id
       FROM requirement_assignments
       WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
       LIMIT 1
       FOR UPDATE`,
      [requirementId, recruiterId],
    )
    if (existing[0]) {
      await connection.execute(
        'UPDATE requirement_assignments SET assignment_role = ? WHERE assignment_id = ?',
        [assignmentRole, existing[0].assignment_id],
      )
    } else {
      await connection.execute(
        `INSERT INTO requirement_assignments
         (requirement_id, recruiter_id, assignment_role)
         VALUES (?, ?, ?)`,
        [requirementId, recruiterId, assignmentRole],
      )
    }

    await createNotification(connection, {
      userId: recruiterId,
      type: 'REQUIREMENT_ASSIGNED',
      title: `Requirement assigned: ${requirements[0].requirement_number}`,
      message: `You are assigned to ${requirements[0].job_title}.`,
      targetUrl: '/app/assigned-requirements',
    })
    await notifyActiveCustomerContacts(connection, Number(requirements[0].customer_id), {
      type: 'REQUIREMENT_RECRUITER_ASSIGNED',
      title: `Recruiter assigned: ${requirements[0].requirement_number}`,
      message: 'A recruiter has been assigned to your requirement.',
      targetUrl: '/app/recruiters',
    })

    await connection.commit()
    return res.json({ message: 'Recruiter assigned to requirement.' })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function getRequirementCreationOptions(req, res, next) {
  try {
    await ensureServiceOrdersForActiveAgreements(req.authUser.user_id)
    const [jobProfiles] = await pool.execute(
      `SELECT job_profile_id, profile_code, profile_name
       FROM job_profiles
       WHERE status = 'ACTIVE'
       ORDER BY profile_name, job_profile_id`,
    )
    const [serviceOrders] = await pool.execute(
      `SELECT so.service_order_id, so.order_number, so.title,
              a.agreement_number, c.company_name
       FROM service_orders so
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       INNER JOIN customers c ON c.customer_id = a.customer_id
       WHERE a.status = 'ACTIVE' AND so.status IN ('APPROVED', 'IN_PROGRESS')
         AND EXISTS (
           SELECT 1
           FROM agreement_versions active_version
           INNER JOIN agreement_service_lines line
             ON line.agreement_version_id = active_version.agreement_version_id
           WHERE active_version.agreement_id = a.agreement_id
             AND active_version.status = 'ACTIVE'
             AND line.service_type_id = so.service_type_id
         )
       ORDER BY c.company_name, so.order_number, so.service_order_id`,
    )
    return res.json({ jobProfiles, serviceOrders })
  } catch (error) {
    return next(error)
  }
}

export async function listRequirementIntakes(req, res, next) {
  try {
    await pool.execute(
      `UPDATE customer_requirement_intakes
       SET status = 'EXPIRED'
       WHERE status = 'PENDING' AND expires_at <= CURRENT_TIMESTAMP`,
    )
  } catch (error) {
    return next(error)
  }

  return listPage(req, res, next, {
    columns: `i.intake_id, c.company_name, COALESCE(u.full_name, 'Deleted account') AS contact_name, u.email,
      i.job_title, i.headcount, i.work_mode, i.employment_schedule,
      i.status, i.submitted_at, i.created_at`,
    from: `customer_requirement_intakes i
      INNER JOIN customers c ON c.customer_id = i.customer_id
      INNER JOIN customer_contacts cc ON cc.contact_id = i.contact_id
      LEFT JOIN users u ON u.user_id = cc.user_id`,
    where: "i.status IN ('PENDING','SUBMITTED','CONVERTED','EXPIRED')",
    searchColumns: ['c.company_name', 'COALESCE(u.full_name, \'\')', 'u.email', 'i.job_title'],
    statusColumn: 'i.status',
    filterColumns: [
      { column: 'c.company_name', type: 'text' },
      { column: 'u.full_name', type: 'text' },
      { column: 'u.email', type: 'text' },
      { column: 'i.job_title', type: 'text' },
      { column: 'i.headcount', type: 'numeric' },
      { column: 'i.work_mode', type: 'enum' },
      { column: 'i.employment_schedule', type: 'enum' },
      { column: 'i.status', type: 'enum' },
    ],
    orderBy: 'i.created_at DESC, i.intake_id DESC',
  })
}

export async function createWorkspaceRecord(req, res, next) {
  try {
    const result = await insertWorkspaceRecord(req.params.module, req.body ?? {}, req.authUser.user_id)
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function sendCustomerRequirementIntake(req, res, next) {
  try {
    const customerId = positiveId(req.params.customerId, 'customer')
    const result = await createRequirementIntake(customerId, req.authUser.user_id)
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function getRequirementIntakeOptions(req, res, next) {
  try {
    const intakeId = positiveId(req.params.intakeId, 'requirement request')
    return res.json(await getRequirementConversionOptions(intakeId, req.authUser.user_id))
  } catch (error) {
    return next(error)
  }
}

export async function convertRequirementIntakeRecord(req, res, next) {
  try {
    const intakeId = positiveId(req.params.intakeId, 'requirement request')
    const result = await convertRequirementIntake(intakeId, req.body ?? {}, req.authUser.user_id)
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function approveServiceOrder(req, res, next) {
  let connection
  try {
    const serviceOrderId = positiveId(req.params.serviceOrderId, 'service order')
    connection = await pool.getConnection()
    await connection.beginTransaction()

    const [rows] = await connection.execute(
      `SELECT so.status, so.order_number, a.customer_id, a.status AS agreement_status,
              EXISTS (
                SELECT 1
                FROM agreement_versions active_version
                INNER JOIN agreement_service_lines line
                  ON line.agreement_version_id = active_version.agreement_version_id
                WHERE active_version.agreement_id = a.agreement_id
                  AND active_version.status = 'ACTIVE'
                  AND line.service_type_id = so.service_type_id
              ) AS service_covered
       FROM service_orders so
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE so.service_order_id = ?
       LIMIT 1
       FOR UPDATE`,
      [serviceOrderId],
    )
    const order = rows[0]
    if (!order) throw Object.assign(new Error('Service order was not found.'), { statusCode: 404 })
    if (order.status !== 'PENDING_APPROVAL') {
      throw Object.assign(new Error('Only service orders pending approval can be approved.'), { statusCode: 409 })
    }
    if (order.agreement_status !== 'ACTIVE') {
      throw Object.assign(new Error('Activate and sign the customer agreement before approving this service order.'), { statusCode: 409 })
    }
    if (Number(order.service_covered) !== 1) {
      throw Object.assign(new Error('The active agreement does not include this service.'), { statusCode: 409 })
    }

    await connection.execute(
      `UPDATE service_orders
       SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE service_order_id = ?`,
      [req.authUser.user_id, serviceOrderId],
    )
    await notifyActiveCustomerContacts(connection, Number(order.customer_id), {
      type: 'SERVICE_ORDER_APPROVED',
      title: `Service order approved: ${order.order_number}`,
      message: 'Your service order is approved and ready for requirement conversion.',
      targetUrl: '/app/my-requirements',
    })
    await connection.commit()
    return res.json({ message: 'Service order approved.' })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
}

export async function updateWorkspaceRecord(req, res, next) {
  try {
    const { module, id } = req.params
    const recordId = positiveId(id, 'Record ID')
    const input = req.body ?? {}

    if (module === 'customers') {
      const companyName = requiredText(input, 'company_name', 'Company name', 200)
      const customerCode = requiredText(input, 'customer_code', 'Customer code', 30).toUpperCase()
      const industry = optionalText(input, 'industry', 'Industry', 100)
      const status = enumValue(input.status ?? 'ACTIVE', 'customer status', ['PROSPECT', 'ACTIVE', 'INACTIVE'])
      const paymentTermsDays = input.payment_terms_days == null || input.payment_terms_days === ''
        ? 30
        : Number(input.payment_terms_days)

      await pool.execute(
        `UPDATE customers
         SET company_name = ?, customer_code = ?, industry = ?, status = ?, payment_terms_days = ?
         WHERE customer_id = ?`,
        [companyName, customerCode, industry, status, paymentTermsDays, recordId],
      )
      return res.json({ message: 'Customer updated successfully.' })
    }

    if (module === 'users') {
      const fullName = requiredText(input, 'full_name', 'Full name', 100)
      const mobile = optionalText(input, 'mobile', 'Mobile', 15)
      if (mobile && !/^[+]?[0-9]{7,15}$/.test(mobile)) {
        throw badRequest('Mobile number must contain 7 to 15 digits, optionally starting with +.')
      }
      const status = enumValue(input.status ?? 'ACTIVE', 'user status', ['INVITED', 'ACTIVE', 'INACTIVE', 'LOCKED'])
      const role = enumValue(input.role, 'role', ['ADMIN', 'RECRUITER', 'CUSTOMER', 'CANDIDATE'])

      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        const [userRows] = await connection.execute(
          'SELECT user_id, email, role FROM users WHERE user_id = ? LIMIT 1 FOR UPDATE',
          [recordId],
        )
        const currentUser = userRows[0]
        if (!currentUser) throw Object.assign(new Error('User account not found.'), { statusCode: 404 })

        const [associationRows] = await connection.execute(
          `SELECT
             EXISTS(SELECT 1 FROM candidates WHERE user_id = ? OR email = ?) AS candidate_profile,
             EXISTS(SELECT 1 FROM customer_contacts WHERE user_id = ?) AS customer_contact,
             EXISTS(SELECT 1 FROM requirement_assignments WHERE recruiter_id = ?) AS recruiter_assignments`,
          [recordId, currentUser.email, recordId, recordId],
        )
        const associations = associationRows[0]
        if ((associations.candidate_profile && role !== 'CANDIDATE')
          || (associations.customer_contact && role !== 'CUSTOMER')
          || (associations.recruiter_assignments && role !== 'RECRUITER')) {
          throw Object.assign(new Error('This user has role-specific records and cannot be changed to another role.'), { statusCode: 409 })
        }

        await connection.execute(
          `UPDATE users
           SET full_name = ?, mobile = ?, status = ?, role = ?
           WHERE user_id = ?`,
          [fullName, mobile, status, role, recordId],
        )

        if (role === 'CANDIDATE') {
          await ensureCandidateProfile(connection, {
            user_id: recordId,
            full_name: fullName,
            email: currentUser.email,
            mobile,
            role,
          })
        }

        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
      return res.json({ message: 'User updated successfully.' })
    }

    if (module === 'skills') {
      const skillName = requiredText(input, 'skill_name', 'Skill name', 100)
      const skillCategory = optionalText(input, 'skill_category', 'Skill category', 60)
      await pool.execute(
        'UPDATE skills SET skill_name = ?, skill_category = ? WHERE skill_id = ?',
        [skillName, skillCategory, recordId],
      )
      return res.json({ message: 'Skill updated successfully.' })
    }

    if (module === 'service-types') {
      const serviceCode = requiredText(input, 'service_code', 'Service code', 30).toUpperCase()
      const serviceName = requiredText(input, 'service_name', 'Service name', 100)
      const employmentModel = enumValue(input.employment_model, 'employment model', ['DTS_PAYROLL', 'CUSTOMER_PAYROLL'])
      await pool.execute(
        'UPDATE service_types SET service_code = ?, service_name = ?, employment_model = ? WHERE service_type_id = ?',
        [serviceCode, serviceName, employmentModel, recordId],
      )
      return res.json({ message: 'Service type updated successfully.' })
    }

    if (module === 'job-profiles') {
      const profileCode = requiredText(input, 'profile_code', 'Profile code', 30).toUpperCase()
      const profileName = requiredText(input, 'profile_name', 'Profile name', 150)
      const category = optionalText(input, 'category', 'Category', 100)
      const status = enumValue(input.status ?? 'ACTIVE', 'job profile status', ['DRAFT', 'ACTIVE', 'ARCHIVED'])
      const experienceMin = numberValue(input.default_experience_min, 'Min experience', { max: 999.9, optional: true })
      const experienceMax = numberValue(input.default_experience_max, 'Max experience', { max: 999.9, optional: true })

      await pool.execute(
        `UPDATE job_profiles
         SET profile_code = ?, profile_name = ?, category = ?, status = ?,
             default_experience_min = ?, default_experience_max = ?
         WHERE job_profile_id = ?`,
        [profileCode, profileName, category, status, experienceMin, experienceMax, recordId],
      )
      return res.json({ message: 'Job profile updated successfully.' })
    }

    if (module === 'agreements') {
      const title = requiredText(input, 'title', 'Title', 200)
      const effectiveDate = optionalDate(input.effective_date, 'Effective date')
      const expiryDate = optionalDate(input.expiry_date, 'Expiry date')
      const signedDate = optionalDate(input.signed_date, 'Signed date')

      await pool.execute(
        `UPDATE agreements
         SET title = ?, effective_date = ?, expiry_date = ?, signed_date = ?
         WHERE agreement_id = ?`,
        [title, effectiveDate, expiryDate, signedDate, recordId],
      )
      return res.json({ message: 'Agreement details updated. Use the agreement workflow to change its status.' })
    }

    if (module === 'rate-cards') {
      const feeType = enumValue(input.fee_type, 'fee type', ['PERCENTAGE', 'FIXED_AMOUNT', 'SALARY_MONTHS'])
      const feeBasis = enumValue(input.fee_basis, 'fee basis', ['MONTHLY_SALARY', 'ANNUAL_CTC', 'HOURLY', 'PER_PLACEMENT'])
      const feeValue = numberValue(input.fee_value, 'Fee value')
      const billingFrequency = enumValue(input.billing_frequency, 'billing frequency', ['ONE_TIME', 'MONTHLY', 'QUARTERLY'])
      const effectiveFrom = optionalDate(input.effective_from, 'Effective from')
      const effectiveTo = optionalDate(input.effective_to, 'Effective to')

      await pool.execute(
        `UPDATE rate_cards
         SET fee_type = ?, fee_basis = ?, fee_value = ?, billing_frequency = ?,
             effective_from = ?, effective_to = ?
         WHERE rate_card_id = ?`,
        [feeType, feeBasis, feeValue, billingFrequency, effectiveFrom, effectiveTo, recordId],
      )
      return res.json({ message: 'Rate card updated successfully.' })
    }

    if (module === 'service-orders') {
      const title = requiredText(input, 'title', 'Title', 200)
      const status = enumValue(input.status ?? 'DRAFT', 'status', [
        'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
      ])
      const startDate = optionalDate(input.start_date, 'Start date')
      const endDate = optionalDate(input.end_date, 'End date')
      const scopeDescription = optionalText(input, 'scope_description', 'Scope', 60000)
      if (endDate && startDate && endDate < startDate) {
        throw badRequest('End date cannot be earlier than the start date.')
      }
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        const [currentRows] = await connection.execute(
          `SELECT so.status, so.order_number, a.customer_id, a.status AS agreement_status,
                EXISTS (
                  SELECT 1
                  FROM agreement_versions active_version
                  INNER JOIN agreement_service_lines line
                    ON line.agreement_version_id = active_version.agreement_version_id
                  WHERE active_version.agreement_id = a.agreement_id
                    AND active_version.status = 'ACTIVE'
                    AND line.service_type_id = so.service_type_id
                ) AS service_covered
           FROM service_orders so
           INNER JOIN agreements a ON a.agreement_id = so.agreement_id
           WHERE so.service_order_id = ?
           LIMIT 1
           FOR UPDATE`,
          [recordId],
        )
        const current = currentRows[0]
        if (!current) throw Object.assign(new Error('Service order not found.'), { statusCode: 404 })
        const transitions = {
          DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
          PENDING_APPROVAL: [],
          APPROVED: ['IN_PROGRESS', 'CANCELLED'],
          IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
          COMPLETED: [],
          CANCELLED: [],
        }
        if (status !== current.status && !transitions[current.status]?.includes(status)) {
          throw Object.assign(new Error('Use the available service-order workflow actions for this status transition.'), { statusCode: 409 })
        }
        if (status === 'IN_PROGRESS'
          && (current.agreement_status !== 'ACTIVE' || Number(current.service_covered) !== 1)) {
          throw Object.assign(new Error('Only services on an active agreement can move in progress.'), { statusCode: 409 })
        }

        await connection.execute(
          `UPDATE service_orders
           SET title = ?, status = ?, start_date = ?, end_date = ?, scope_description = ?
           WHERE service_order_id = ?`,
          [title, status, startDate, endDate, scopeDescription, recordId],
        )
        if (status !== current.status) {
          await notifyActiveCustomerContacts(connection, Number(current.customer_id), {
            type: 'SERVICE_ORDER_STATUS_CHANGED',
            title: `Service order ${status.toLowerCase()}: ${current.order_number}`,
            message: `The status of service order ${current.order_number} changed to ${status.replace(/_/g, ' ')}.`,
            targetUrl: '/app/my-requirements',
          })
        }
        await connection.commit()
        return res.json({ message: 'Service order updated successfully.' })
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    }

    if (module === 'requirements') {
      const jobTitle = requiredText(input, 'job_title', 'Job title', 150)
      const status = enumValue(input.status ?? 'OPEN', 'status', [
        'PENDING_APPROVAL', 'APPROVED', 'OPEN', 'ON_HOLD', 'FILLED', 'CANCELLED',
      ])
      const headcount = numberValue(input.headcount, 'Headcount', { min: 1, max: 65535 })
      const workMode = enumValue(input.work_mode, 'work mode', ['ONSITE', 'REMOTE', 'HYBRID'])
      const salaryMin = numberValue(input.salary_min, 'Minimum salary', { optional: true })
      const salaryMax = numberValue(input.salary_max, 'Maximum salary', { optional: true })
      if (!Number.isSafeInteger(headcount)) {
        throw badRequest('Headcount must be a whole number.')
      }
      if (salaryMin !== null && salaryMax !== null && salaryMax < salaryMin) {
        throw badRequest('Maximum salary cannot be less than minimum salary.')
      }
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        const [currentRows] = await connection.execute(
          `SELECT r.status, r.requirement_number, r.job_title, a.customer_id
           FROM job_requirements r
           INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
           INNER JOIN agreements a ON a.agreement_id = so.agreement_id
           WHERE r.requirement_id = ?
           LIMIT 1
           FOR UPDATE`,
          [recordId],
        )
        const current = currentRows[0]
        if (!current) throw Object.assign(new Error('Requirement not found.'), { statusCode: 404 })
        const transitions = {
          PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
          APPROVED: ['OPEN', 'CANCELLED'],
          OPEN: ['ON_HOLD', 'FILLED', 'CANCELLED'],
          ON_HOLD: ['OPEN', 'CANCELLED'],
          FILLED: [],
          CANCELLED: [],
        }
        if (status !== current.status && !transitions[current.status]?.includes(status)) {
          throw Object.assign(new Error('This requirement status transition is not allowed.'), { statusCode: 409 })
        }

        await connection.execute(
          `UPDATE job_requirements
           SET job_title = ?, status = ?, headcount = ?, work_mode = ?, salary_min = ?, salary_max = ?
           WHERE requirement_id = ?`,
          [jobTitle, status, headcount, workMode, salaryMin, salaryMax, recordId],
        )
        if (status !== current.status) {
          await notifyActiveCustomerContacts(connection, Number(current.customer_id), {
            type: 'REQUIREMENT_STATUS_CHANGED',
            title: `Requirement ${status.toLowerCase()}: ${current.requirement_number}`,
            message: `${current.job_title} changed to ${status.replace(/_/g, ' ')}.`,
            targetUrl: '/app/my-requirements',
          })
          await notifyAssignedRecruiters(connection, recordId, {
            type: 'REQUIREMENT_STATUS_CHANGED',
            title: `Requirement ${status.toLowerCase()}: ${current.requirement_number}`,
            message: `${current.job_title} changed to ${status.replace(/_/g, ' ')}.`,
            targetUrl: '/app/assigned-requirements',
          })
        }
        await connection.commit()
        return res.json({ message: 'Requirement updated successfully.' })
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    }

    if (module === 'customer-contacts') {
      const designation = optionalText(input, 'designation', 'Designation', 100)
      const contactType = enumValue(input.contact_type ?? 'HIRING', 'contact type', ['PRIMARY', 'BILLING', 'HIRING', 'ESCALATION', 'OTHER'])
      const status = enumValue(input.status ?? 'ACTIVE', 'contact status', ['ACTIVE', 'INACTIVE'])
      const isPrimary = optionalBoolean(input.is_primary, 'Is primary')

      await pool.execute(
        `UPDATE customer_contacts
         SET designation = ?, contact_type = ?, status = ?, is_primary = ?
         WHERE contact_id = ?`,
        [designation, contactType, status, isPrimary, recordId],
      )
      return res.json({ message: 'Customer contact updated successfully.' })
    }

    if (module === 'customer-addresses') {
      const addressType = enumValue(input.address_type ?? 'SERVICE', 'address type', ['REGISTERED', 'BILLING', 'SERVICE', 'OTHER'])
      const addressLine = requiredText(input, 'address_line', 'Address line', 255)
      const city = requiredText(input, 'city', 'City', 100)
      const state = requiredText(input, 'state', 'State', 100)
      const postalCode = optionalText(input, 'postal_code', 'Postal code', 20)
      const isPrimary = optionalBoolean(input.is_primary, 'Is primary')

      await pool.execute(
        `UPDATE customer_addresses
         SET address_type = ?, address_line = ?, city = ?, state = ?, postal_code = ?, is_primary = ?
         WHERE address_id = ?`,
        [addressType, addressLine, city, state, postalCode, isPrimary, recordId],
      )
      return res.json({ message: 'Customer address updated successfully.' })
    }

    throw badRequest('Update is not supported for this business module.')
  } catch (error) {
    return next(error)
  }
}
