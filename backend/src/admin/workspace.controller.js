import { pool } from '../config/db.js'
import {
  convertRequirementIntake,
  createRequirementIntake,
  getRequirementConversionOptions,
} from './requirement-intake.service.js'

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
         WHERE so.service_order_id = ? AND so.status IN ('APPROVED', 'IN_PROGRESS')
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

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw badRequest(`limit must be an integer from 1 to ${MAX_LIMIT}.`)
  }
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw badRequest(`offset must be an integer from 0 to ${MAX_OFFSET}.`)
  }
  if (typeof search !== 'string' || search.length > 100) {
    throw badRequest('search must be a string of 100 characters or fewer.')
  }

  return { limit, offset, search: search.trim() }
}

async function listPage(req, res, next, { columns, from, where = '1 = 1', searchColumns, orderBy }) {
  try {
    const { limit, offset, search } = listOptions(req)
    const values = []
    let filter = where

    if (search) {
      filter += ` AND (${searchColumns.map((column) => `${column} LIKE ?`).join(' OR ')})`
      values.push(...searchColumns.map(() => `%${search}%`))
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

    return res.json({
      rows,
      total: Number(counts[0].total),
      limit,
      offset,
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
    orderBy: 'c.company_name, ca.address_type, ca.address_id',
  })
}

export function listCustomerContacts(req, res, next) {
  return listPage(req, res, next, {
    columns: `cc.contact_id, c.company_name, u.full_name, u.email,
      cc.designation, cc.contact_type, cc.is_primary, cc.status`,
    from: `customer_contacts cc
      INNER JOIN customers c ON c.customer_id = cc.customer_id
      INNER JOIN users u ON u.user_id = cc.user_id`,
    searchColumns: ['c.company_name', 'u.full_name', 'u.email', 'cc.designation'],
    orderBy: 'c.company_name, u.full_name, cc.contact_id',
  })
}

export function listRecruiters(req, res, next) {
  return listPage(req, res, next, {
    columns: 'user_id, full_name, email, status, last_login_at',
    from: 'users',
    where: "role = 'RECRUITER'",
    searchColumns: ['full_name', 'email'],
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
       LIMIT 1) AS customer_company`,
    from: 'users u',
    searchColumns: ['u.full_name', 'u.email', 'u.mobile', 'u.role', 'u.status'],
    orderBy: 'u.full_name, u.user_id',
  })
}

export function listSkills(req, res, next) {
  return listPage(req, res, next, {
    columns: 'skill_id, skill_name, skill_category',
    from: 'skills',
    searchColumns: ['skill_name', 'skill_category'],
    orderBy: 'skill_name, skill_id',
  })
}

export function listServiceTypes(req, res, next) {
  return listPage(req, res, next, {
    columns: 'service_type_id, service_code, service_name, employment_model',
    from: 'service_types',
    searchColumns: ['service_code', 'service_name', 'employment_model'],
    orderBy: 'service_name, service_type_id',
  })
}

export function listJobProfiles(req, res, next) {
  return listPage(req, res, next, {
    columns: `job_profile_id, profile_code, profile_name, category,
      default_experience_min, default_experience_max, status`,
    from: 'job_profiles',
    searchColumns: ['profile_code', 'profile_name', 'category'],
    orderBy: 'profile_name, job_profile_id',
  })
}

export function listAgreements(req, res, next) {
  return listPage(req, res, next, {
    columns: `a.agreement_id, a.agreement_number, c.company_name, a.title,
      a.status, a.effective_date, a.expiry_date, a.signed_date`,
    from: `agreements a
      INNER JOIN customers c ON c.customer_id = a.customer_id`,
    searchColumns: ['a.agreement_number', 'c.company_name', 'a.title', 'a.status'],
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
    orderBy: 'so.created_at DESC, so.service_order_id DESC',
  })
}

export function listRequirements(req, res, next) {
  return listPage(req, res, next, {
    columns: `r.requirement_id, r.requirement_number, c.company_name,
      r.job_title, jp.profile_name, r.headcount, r.work_mode, r.status, r.created_at`,
    from: `job_requirements r
      INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
      INNER JOIN agreements a ON a.agreement_id = so.agreement_id
      INNER JOIN customers c ON c.customer_id = a.customer_id
      INNER JOIN job_profiles jp ON jp.job_profile_id = r.job_profile_id`,
    searchColumns: ['r.requirement_number', 'c.company_name', 'r.job_title', 'jp.profile_name'],
    orderBy: 'r.created_at DESC, r.requirement_id DESC',
  })
}

export async function getRequirementCreationOptions(_req, res, next) {
  try {
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
       WHERE so.status IN ('APPROVED', 'IN_PROGRESS')
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
    columns: `i.intake_id, c.company_name, u.full_name AS contact_name, u.email,
      i.job_title, i.headcount, i.work_mode, i.employment_schedule,
      i.status, i.submitted_at, i.created_at`,
    from: `customer_requirement_intakes i
      INNER JOIN customers c ON c.customer_id = i.customer_id
      INNER JOIN customer_contacts cc ON cc.contact_id = i.contact_id
      INNER JOIN users u ON u.user_id = cc.user_id`,
    where: "i.status IN ('PENDING','SUBMITTED','CONVERTED','EXPIRED')",
    searchColumns: ['c.company_name', 'u.full_name', 'u.email', 'i.job_title'],
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
    return res.json(await getRequirementConversionOptions(intakeId))
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
      `SELECT so.status, a.status AS agreement_status
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

    await connection.execute(
      `UPDATE service_orders
       SET status = 'APPROVED', approved_by = ?, approved_at = CURRENT_TIMESTAMP
       WHERE service_order_id = ?`,
      [req.authUser.user_id, serviceOrderId],
    )
    await connection.commit()
    return res.json({ message: 'Service order approved.' })
  } catch (error) {
    if (connection) await connection.rollback()
    return next(error)
  } finally {
    connection?.release()
  }
}
