import { randomBytes } from 'node:crypto'
import PDFDocument from 'pdfkit'
import { pool } from '../config/db.js'
import {
  createDraftPdf,
  fileMetadata,
  removePrivateFile,
  resolvePrivateStoragePath,
  storeSignedPdf,
} from './document-storage.js'

const agreementStatus = {
  REVIEW: 'PENDING_ADMIN_REVIEW',
  CHANGES: 'CHANGES_REQUESTED',
  SIGNATURE: 'PENDING_CUSTOMER_SIGNATURE',
  ACTIVATION: 'SIGNED_PENDING_ADMIN_ACTIVATION',
  ACTIVE: 'ACTIVE',
}

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode })
}

function positiveId(value, label) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw httpError(`${label} is invalid.`)
  }
  return parsed
}

function parseDate(value, label) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(`${label} must use YYYY-MM-DD format.`)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw httpError(`${label} is not a valid date.`)
  }
  return value
}

function validateText(value, label, maximum) {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || value.length > maximum) {
    throw httpError(`${label} must be ${maximum} characters or fewer.`)
  }
  return value.trim() || null
}

function normalizedLines(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 25) {
    throw httpError('Select between 1 and 25 service lines.')
  }
  return input.map((line, index) => {
    if (!line || typeof line !== 'object') {
      throw httpError(`Service line ${index + 1} is invalid.`)
    }
    const serviceTypeId = positiveId(line.serviceTypeId, 'Service type')
    const jobProfileId = positiveId(line.jobProfileId, 'Job profile')
    const employmentSchedule = line.employmentSchedule ?? 'FULL_TIME'
    if (!['FULL_TIME', 'PART_TIME'].includes(employmentSchedule)) {
      throw httpError(`Service line ${index + 1} has an invalid schedule.`)
    }
    const hoursPerWeek = line.hoursPerWeek == null || line.hoursPerWeek === ''
      ? null
      : Number(line.hoursPerWeek)
    if (hoursPerWeek !== null && (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0 || hoursPerWeek > 168)) {
      throw httpError(`Service line ${index + 1} must have valid weekly hours.`)
    }
    if (employmentSchedule === 'PART_TIME' && hoursPerWeek === null) {
      throw httpError(`Service line ${index + 1} needs weekly hours for part-time work.`)
    }
    const headcount = line.headcount == null ? 1 : Number(line.headcount)
    if (!Number.isSafeInteger(headcount) || headcount < 1 || headcount > 65535) {
      throw httpError(`Service line ${index + 1} must have a valid headcount.`)
    }
    const feeValue = line.feeValue == null || line.feeValue === '' ? null : Number(line.feeValue)
    if (feeValue !== null && (!Number.isFinite(feeValue) || feeValue < 0 || feeValue > 1000000000)) {
      throw httpError(`Service line ${index + 1} has an invalid fee value.`)
    }
    return {
      serviceTypeId,
      jobProfileId,
      employmentSchedule,
      hoursPerWeek,
      headcount,
      scopeDescription: validateText(line.scopeDescription, `Service line ${index + 1} scope`, 60000),
      feeValue,
    }
  })
}

async function getValidLines(connection, input) {
  const lines = normalizedLines(input)
  const serviceIds = [...new Set(lines.map((line) => line.serviceTypeId))]
  const profileIds = [...new Set(lines.map((line) => line.jobProfileId))]
  const [serviceTypes] = await connection.execute(
    `SELECT service_type_id, service_code, service_name, employment_model
     FROM service_types
     WHERE service_type_id IN (${serviceIds.map(() => '?').join(',')})`,
    serviceIds,
  )
  const [profiles] = await connection.execute(
    `SELECT job_profile_id, profile_code, profile_name
     FROM job_profiles
     WHERE status = 'ACTIVE'
       AND job_profile_id IN (${profileIds.map(() => '?').join(',')})`,
    profileIds,
  )
  const serviceById = new Map(serviceTypes.map((row) => [Number(row.service_type_id), row]))
  const profileById = new Map(profiles.map((row) => [Number(row.job_profile_id), row]))
  if (serviceById.size !== serviceIds.length || profileById.size !== profileIds.length) {
    throw httpError('A selected service or active job profile no longer exists.', 409)
  }

  return lines.map((line) => {
    const service = serviceById.get(line.serviceTypeId)
    const profile = profileById.get(line.jobProfileId)
    const customerPayroll = service.employment_model === 'CUSTOMER_PAYROLL'
    return {
      ...line,
      service,
      profile,
      feeType: customerPayroll ? 'SALARY_MONTHS' : 'PERCENTAGE',
      feeBasis: customerPayroll ? 'MONTHLY_SALARY' : 'ANNUAL_CTC',
      feeValue: line.feeValue ?? (customerPayroll ? 1 : 10),
    }
  })
}

async function customerHasAccess(userId, customerId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT cc.customer_id
     FROM customer_contacts cc
     INNER JOIN users u ON u.user_id = cc.user_id
     WHERE cc.user_id = ? AND cc.customer_id = ?
       AND cc.status = 'ACTIVE' AND u.status = 'ACTIVE'
     LIMIT 1`,
    [userId, customerId],
  )
  return rows.length > 0
}

function agreementNumber() {
  const month = new Date().toISOString().slice(0, 7).replace('-', '')
  return `DTS-AGR-${month}-${randomBytes(4).toString('hex').toUpperCase()}`
}

function latestVersionJoin() {
  return `LEFT JOIN agreement_versions av
    ON av.agreement_id = a.agreement_id
    AND av.version_number = (
      SELECT MAX(av2.version_number)
      FROM agreement_versions av2
      WHERE av2.agreement_id = a.agreement_id
    )`
}

export async function getCustomerCatalog(userId) {
  const [customers] = await pool.execute(
    `SELECT c.customer_id, c.company_name
     FROM customer_contacts cc
     INNER JOIN customers c ON c.customer_id = cc.customer_id
     WHERE cc.user_id = ? AND cc.status = 'ACTIVE'
     ORDER BY c.company_name, c.customer_id`,
    [userId],
  )
  const [serviceTypes] = await pool.execute(
    `SELECT service_type_id, service_code, service_name, employment_model
     FROM service_types
     ORDER BY service_name, service_type_id`,
  )
  const [jobProfiles] = await pool.execute(
    `SELECT job_profile_id, profile_code, profile_name
     FROM job_profiles
     WHERE status = 'ACTIVE'
     ORDER BY profile_name, job_profile_id`,
  )
  return { customers, serviceTypes, jobProfiles }
}

export async function getAdminCatalog() {
  const [serviceTypes] = await pool.execute(
    `SELECT service_type_id, service_code, service_name, employment_model
     FROM service_types
     ORDER BY service_name, service_type_id`,
  )
  const [jobProfiles] = await pool.execute(
    `SELECT job_profile_id, profile_code, profile_name
     FROM job_profiles
     WHERE status = 'ACTIVE'
     ORDER BY profile_name, job_profile_id`,
  )
  return { serviceTypes, jobProfiles }
}

export async function createCustomerAgreement(user, input) {
  const customerId = positiveId(input.customerId, 'Customer')
  const requestKey = typeof input.requestKey === 'string' ? input.requestKey : ''
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) {
    throw httpError('A valid request key is required.')
  }
  const lines = normalizedLines(input.serviceLines)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    if (!await customerHasAccess(user.user_id, customerId, connection)) {
      throw httpError('You do not have access to this customer account.', 403)
    }
    const [existing] = await connection.execute(
      `SELECT agreement_id
       FROM agreement_versions
       WHERE created_by = ? AND request_key = ?
       LIMIT 1`,
      [user.user_id, requestKey],
    )
    if (existing.length) {
      await connection.commit()
      return getCustomerAgreementDetail(user.user_id, existing[0].agreement_id)
    }

    const validatedLines = await getValidLines(connection, lines)
    const number = agreementNumber()
    const [agreementResult] = await connection.execute(
      `INSERT INTO agreements
        (agreement_number, customer_id, title, status, created_by)
       VALUES (?, ?, ?, 'DRAFT', ?)`,
      [number, customerId, 'Recruitment Services Agreement', user.user_id],
    )
    const agreementId = Number(agreementResult.insertId)
    const [versionResult] = await connection.execute(
      `INSERT INTO agreement_versions
        (agreement_id, version_number, request_key, status, created_by, submitted_at)
       VALUES (?, 1, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [agreementId, requestKey, agreementStatus.REVIEW, user.user_id],
    )
    const versionId = Number(versionResult.insertId)
    for (const line of validatedLines) {
      await insertServiceLine(connection, versionId, line)
    }
    await connection.execute(
      `INSERT INTO agreement_events
        (agreement_id, agreement_version_id, action_code, new_status, actor_user_id, customer_visible_comment)
       VALUES (?, ?, 'SERVICE_SELECTION_SUBMITTED', ?, ?, 'Service selection submitted for administrator review.')`,
      [agreementId, versionId, agreementStatus.REVIEW, user.user_id],
    )
    await connection.commit()
    return getCustomerAgreementDetail(user.user_id, agreementId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

async function insertServiceLine(connection, versionId, line) {
  await connection.execute(
    `INSERT INTO agreement_service_lines
      (agreement_version_id, service_type_id, job_profile_id, employment_schedule,
       hours_per_week, headcount, scope_description, fee_type, fee_basis, fee_value, currency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR')`,
    [
      versionId,
      line.serviceTypeId,
      line.jobProfileId,
      line.employmentSchedule,
      line.hoursPerWeek,
      line.headcount,
      line.scopeDescription,
      line.feeType,
      line.feeBasis,
      line.feeValue,
    ],
  )
}

async function getAgreementHeader(connection, agreementId) {
  const [rows] = await connection.execute(
    `SELECT a.agreement_id, a.agreement_number, a.customer_id, a.title, a.status,
            a.effective_date, a.expiry_date, a.signed_date, a.document_path,
            c.company_name, c.customer_code
     FROM agreements a
     INNER JOIN customers c ON c.customer_id = a.customer_id
     WHERE a.agreement_id = ?
     LIMIT 1`,
    [agreementId],
  )
  return rows[0] ?? null
}

async function getVersionRows(connection, agreementId) {
  const [rows] = await connection.execute(
    `SELECT agreement_version_id, agreement_id, version_number, status,
            draft_document_path, signed_document_path, change_reason,
            internal_review_note, created_by, reviewed_by, reviewed_at,
            customer_signed_by, signed_uploaded_at, activated_by, activated_at,
            created_at
     FROM agreement_versions
     WHERE agreement_id = ?
     ORDER BY version_number DESC
     LIMIT 1`,
    [agreementId],
  )
  return rows[0] ?? null
}

async function getServiceLines(connection, versionId) {
  const [rows] = await connection.execute(
    `SELECT l.agreement_service_line_id, l.service_type_id, st.service_code,
            st.service_name, st.employment_model, l.job_profile_id,
            jp.profile_code, jp.profile_name, l.employment_schedule,
            l.hours_per_week, l.headcount, l.scope_description,
            l.fee_type, l.fee_basis, l.fee_value, l.currency,
            l.monthly_salary_snapshot, l.annual_ctc_snapshot, l.quoted_fee_amount
     FROM agreement_service_lines l
     INNER JOIN service_types st ON st.service_type_id = l.service_type_id
     INNER JOIN job_profiles jp ON jp.job_profile_id = l.job_profile_id
     WHERE l.agreement_version_id = ?
     ORDER BY l.agreement_service_line_id`,
    [versionId],
  )
  return rows
}

async function getEvents(connection, agreementId, customerVisibleOnly) {
  const [rows] = await connection.execute(
    `SELECT ev.action_code, ev.previous_status, ev.new_status,
            ev.customer_visible_comment, ev.internal_comment, ev.occurred_at,
            u.full_name AS actor_name
     FROM agreement_events ev
     LEFT JOIN users u ON u.user_id = ev.actor_user_id
     WHERE ev.agreement_id = ?
     ORDER BY ev.occurred_at, ev.agreement_event_id`,
    [agreementId],
  )
  return customerVisibleOnly
    ? rows.map(({ internal_comment, ...event }) => event)
    : rows
}

function serializeDetail(agreement, version, lines, events, customerView) {
  if (!agreement) throw httpError('Agreement not found.', 404)
  return {
    agreement: {
      agreementId: Number(agreement.agreement_id),
      agreementNumber: agreement.agreement_number,
      customerId: Number(agreement.customer_id),
      companyName: agreement.company_name,
      title: agreement.title,
      status: agreement.status,
      effectiveDate: agreement.effective_date,
      expiryDate: agreement.expiry_date,
      signedDate: agreement.signed_date,
    },
    version: version
      ? {
          agreementVersionId: Number(version.agreement_version_id),
          versionNumber: Number(version.version_number),
          status: version.status,
          changeReason: version.change_reason,
          internalReviewNote: customerView ? undefined : version.internal_review_note,
          canDownloadDraft: Boolean(version.draft_document_path),
          canDownloadSignedCopy: Boolean(version.signed_document_path),
          createdAt: version.created_at,
          reviewedAt: version.reviewed_at,
          signedUploadedAt: version.signed_uploaded_at,
          activatedAt: version.activated_at,
        }
      : null,
    serviceLines: lines,
    events,
  }
}

async function loadDetail(agreementId, customerView = false) {
  const connection = await pool.getConnection()
  try {
    const agreement = await getAgreementHeader(connection, agreementId)
    const version = agreement ? await getVersionRows(connection, agreementId) : null
    const lines = version ? await getServiceLines(connection, version.agreement_version_id) : []
    const events = agreement ? await getEvents(connection, agreementId, customerView) : []
    return serializeDetail(agreement, version, lines, events, customerView)
  } finally {
    connection.release()
  }
}

export async function getCustomerAgreementDetail(userId, agreementIdValue) {
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const [rows] = await pool.execute(
    'SELECT customer_id FROM agreements WHERE agreement_id = ? LIMIT 1',
    [agreementId],
  )
  if (!rows.length) throw httpError('Agreement not found.', 404)
  if (!await customerHasAccess(userId, Number(rows[0].customer_id))) {
    throw httpError('You do not have access to this agreement.', 403)
  }
  return loadDetail(agreementId, true)
}

export async function getAdminAgreementDetail(agreementIdValue) {
  return loadDetail(positiveId(agreementIdValue, 'Agreement'))
}

export async function listCustomerAgreements(userId) {
  const [rows] = await pool.execute(
    `SELECT a.agreement_id, a.agreement_number, a.customer_id, c.company_name,
            a.title, a.status, a.effective_date, a.expiry_date, a.signed_date,
            av.agreement_version_id, av.version_number, av.status AS version_status,
            av.change_reason, (av.draft_document_path IS NOT NULL) AS has_draft_document,
            (av.signed_document_path IS NOT NULL) AS has_signed_document, a.created_at
     FROM agreements a
     INNER JOIN customers c ON c.customer_id = a.customer_id
     ${latestVersionJoin()}
     WHERE EXISTS (
       SELECT 1 FROM customer_contacts cc
       WHERE cc.customer_id = a.customer_id AND cc.user_id = ? AND cc.status = 'ACTIVE'
     )
     ORDER BY a.created_at DESC, a.agreement_id DESC`,
    [userId],
  )
  return rows
}

export async function listAdminAgreements() {
  const [rows] = await pool.execute(
    `SELECT a.agreement_id, a.agreement_number, a.customer_id, c.company_name,
            a.title, a.status, a.effective_date, a.expiry_date, a.signed_date,
            av.agreement_version_id, av.version_number, av.status AS version_status,
            av.change_reason, (av.draft_document_path IS NOT NULL) AS has_draft_document,
            (av.signed_document_path IS NOT NULL) AS has_signed_document, a.created_at
     FROM agreements a
     INNER JOIN customers c ON c.customer_id = a.customer_id
     ${latestVersionJoin()}
     ORDER BY a.created_at DESC, a.agreement_id DESC`,
  )
  return rows
}

async function getCurrentVersionForUpdate(connection, agreementId, versionId) {
  const [rows] = await connection.execute(
    `SELECT av.agreement_version_id, av.agreement_id, av.version_number, av.status,
            av.created_by, av.draft_document_path, av.signed_document_path,
            a.customer_id, a.agreement_number, a.title, a.effective_date, a.expiry_date,
            c.company_name
     FROM agreement_versions av
     INNER JOIN agreements a ON a.agreement_id = av.agreement_id
     INNER JOIN customers c ON c.customer_id = a.customer_id
     WHERE av.agreement_id = ? AND av.agreement_version_id = ?
     FOR UPDATE`,
    [agreementId, versionId],
  )
  if (!rows.length) throw httpError('Agreement version not found.', 404)
  return rows[0]
}

export async function saveAdminAgreementTerms(agreementIdValue, versionIdValue, input, adminUserId) {
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const versionId = positiveId(versionIdValue, 'Agreement version')
  const linesInput = normalizedLines(input.serviceLines)
  const effectiveDate = parseDate(input.effectiveDate, 'Effective date')
  const expiryDate = parseDate(input.expiryDate, 'Expiry date')
  if (effectiveDate && expiryDate && expiryDate < effectiveDate) {
    throw httpError('Expiry date cannot be earlier than the effective date.')
  }
  const internalNote = validateText(input.internalReviewNote, 'Internal review note', 10000)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const agreement = await getCurrentVersionForUpdate(connection, agreementId, versionId)
    if (![agreementStatus.REVIEW, agreementStatus.CHANGES].includes(agreement.status)) {
      throw httpError('Terms can only be edited while the agreement awaits administrator review.', 409)
    }
    const lines = await getValidLines(connection, linesInput)
    await connection.execute(
      'DELETE FROM agreement_service_lines WHERE agreement_version_id = ?',
      [versionId],
    )
    const rateCardDate = effectiveDate ?? new Date().toISOString().slice(0, 10)
    for (const line of lines) {
      const [rateResult] = await connection.execute(
        `INSERT INTO rate_cards
          (agreement_id, service_type_id, job_profile_id, fee_type, fee_basis,
           fee_value, billing_frequency, effective_from)
         VALUES (?, ?, ?, ?, ?, ?, 'ONE_TIME', ?)
         ON DUPLICATE KEY UPDATE
           rate_card_id = LAST_INSERT_ID(rate_card_id),
           fee_type = VALUES(fee_type), fee_basis = VALUES(fee_basis),
           fee_value = VALUES(fee_value), billing_frequency = VALUES(billing_frequency)`,
        [
          agreementId,
          line.serviceTypeId,
          line.jobProfileId,
          line.feeType,
          line.feeBasis,
          line.feeValue,
          rateCardDate,
        ],
      )
      await insertServiceLine(connection, versionId, {
        ...line,
        rateCardId: Number(rateResult.insertId),
      })
      await connection.execute(
        `UPDATE agreement_service_lines
         SET rate_card_id = ?
         WHERE agreement_version_id = ? AND agreement_service_line_id = LAST_INSERT_ID()`,
        [Number(rateResult.insertId), versionId],
      )
    }
    await connection.execute(
      `UPDATE agreements
       SET effective_date = ?, expiry_date = ?
       WHERE agreement_id = ?`,
      [effectiveDate, expiryDate, agreementId],
    )
    await connection.execute(
      `UPDATE agreement_versions
       SET internal_review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
       WHERE agreement_version_id = ?`,
      [internalNote, adminUserId, versionId],
    )
    await connection.execute(
      `INSERT INTO agreement_events
        (agreement_id, agreement_version_id, action_code, previous_status, new_status,
         actor_user_id, internal_comment)
       VALUES (?, ?, 'TERMS_UPDATED', ?, ?, ?, ?)`,
      [agreementId, versionId, agreement.status, agreement.status, adminUserId, internalNote],
    )
    await connection.commit()
    return getAdminAgreementDetail(agreementId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

function buildDraftDocument(agreement, version, lines) {
  const doc = new PDFDocument({ size: 'A4', margin: 52, bufferPages: true })
  doc.fontSize(17).font('Helvetica-Bold').text('DTS RECRUITMENT SERVICES AGREEMENT', { align: 'center' })
  doc.moveDown(0.35)
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#a11').text('SAMPLE DRAFT - SUBJECT TO LEGAL AND COMMERCIAL APPROVAL', { align: 'center' })
  doc.fillColor('#111').moveDown()
  doc.fontSize(10).font('Helvetica')
  doc.text(`Agreement number: ${agreement.agreement_number}`)
  doc.text(`Version: ${version.version_number}`)
  doc.text(`Customer: ${agreement.company_name}`)
  doc.text(`Effective date: ${agreement.effective_date ?? 'To be confirmed'}`)
  doc.text(`Expiry date: ${agreement.expiry_date ?? 'To be confirmed'}`)
  doc.moveDown()
  doc.fontSize(12).font('Helvetica-Bold').text('Selected services')
  doc.moveDown(0.4)

  lines.forEach((line, index) => {
    doc.fontSize(10).font('Helvetica-Bold').text(`${index + 1}. ${line.service_name} - ${line.profile_name}`)
    doc.font('Helvetica')
    doc.text(`Employment model: ${line.employment_model.replace(/_/g, ' ')}`)
    doc.text(`Schedule: ${line.employment_schedule.replace(/_/g, ' ')}${line.hours_per_week ? ` (${line.hours_per_week} hours/week)` : ''}`)
    doc.text(`Headcount: ${line.headcount}`)
    doc.text(`Commercial basis: ${line.fee_type === 'SALARY_MONTHS' ? `${line.fee_value} month(s) of monthly salary` : `${line.fee_value}% of annual CTC`}`)
    if (line.scope_description) doc.text(`Scope: ${line.scope_description}`)
    doc.moveDown(0.65)
  })

  doc.moveDown(0.3)
  doc.fontSize(10).font('Helvetica-Bold').text('Commercial and legal terms')
  doc.font('Helvetica').text(
    'This sample document records the selected services and commercial basis for review. ' +
      'The final payment terms, taxes, definitions, replacement policy, confidentiality, data protection, ' +
      'termination, governing law, and other legal clauses must be confirmed by DTS and the customer before use.',
    { align: 'justify' },
  )
  doc.moveDown(2)
  doc.font('Helvetica-Bold').text('For the customer')
  doc.font('Helvetica').text('Authorized signatory: __________________________________')
  doc.text('Name and designation: __________________________________')
  doc.text('Date: ____________________')
  doc.moveDown()
  doc.font('Helvetica-Bold').text('For DTS')
  doc.font('Helvetica').text('Authorized signatory: __________________________________')
  doc.text('Name and designation: __________________________________')
  doc.text('Date: ____________________')
  return doc
}

export async function requestAdminAgreementDecision(
  agreementIdValue,
  versionIdValue,
  input,
  adminUserId,
) {
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const versionId = positiveId(versionIdValue, 'Agreement version')
  const decision = input.decision
  if (!['APPROVE_FOR_SIGNATURE', 'REQUEST_CHANGES'].includes(decision)) {
    throw httpError('Choose a valid agreement review decision.')
  }
  const customerComment = validateText(input.customerComment, 'Customer comment', 1000)
  const internalComment = validateText(input.internalComment, 'Internal comment', 10000)
  if (decision === 'REQUEST_CHANGES' && !customerComment) {
    throw httpError('A customer-visible explanation is required when requesting changes.')
  }

  const connection = await pool.getConnection()
  let version
  let agreement
  let lines
  try {
    await connection.beginTransaction()
    version = await getCurrentVersionForUpdate(connection, agreementId, versionId)
    if (![agreementStatus.REVIEW, agreementStatus.CHANGES].includes(version.status)) {
      throw httpError('This agreement is not awaiting administrator review.', 409)
    }
    agreement = version
    lines = await getServiceLines(connection, versionId)
    if (!lines.length) throw httpError('Add at least one service before approving the agreement.', 409)
    if (decision === 'REQUEST_CHANGES') {
      await connection.execute(
        `UPDATE agreement_versions
         SET status = ?, change_reason = ?, internal_review_note = ?,
             reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
         WHERE agreement_version_id = ?`,
        [agreementStatus.CHANGES, customerComment, internalComment, adminUserId, versionId],
      )
      await connection.execute(
        `UPDATE agreements SET status = 'DRAFT' WHERE agreement_id = ?`,
        [agreementId],
      )
      await connection.execute(
        `INSERT INTO agreement_events
          (agreement_id, agreement_version_id, action_code, previous_status, new_status,
           actor_user_id, customer_visible_comment, internal_comment)
         VALUES (?, ?, 'CHANGES_REQUESTED', ?, ?, ?, ?, ?)`,
        [
          agreementId,
          versionId,
          version.status,
          agreementStatus.CHANGES,
          adminUserId,
          customerComment,
          internalComment,
        ],
      )
      await connection.commit()
      return getAdminAgreementDetail(agreementId)
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  const draft = await createDraftPdf(agreementId, version.version_number, () => (
    buildDraftDocument(agreement, version, lines)
  ))
  const updateConnection = await pool.getConnection()
  try {
    await updateConnection.beginTransaction()
    const current = await getCurrentVersionForUpdate(updateConnection, agreementId, versionId)
    if (![agreementStatus.REVIEW, agreementStatus.CHANGES].includes(current.status)) {
      throw httpError('Agreement status changed while the draft was being prepared.', 409)
    }
    await updateConnection.execute(
      `UPDATE agreement_versions
       SET status = ?, draft_document_path = ?, draft_sha256 = ?,
           change_reason = NULL, internal_review_note = ?, reviewed_by = ?,
           reviewed_at = CURRENT_TIMESTAMP
       WHERE agreement_version_id = ?`,
      [
        agreementStatus.SIGNATURE,
        draft.storageKey,
        draft.sha256,
        internalComment,
        adminUserId,
        versionId,
      ],
    )
    await updateConnection.execute(
      `UPDATE agreements
       SET status = 'PENDING_SIGNATURE', document_path = ?
       WHERE agreement_id = ?`,
      [draft.storageKey, agreementId],
    )
    await updateConnection.execute(
      `INSERT INTO agreement_events
        (agreement_id, agreement_version_id, action_code, previous_status, new_status,
         actor_user_id, customer_visible_comment, internal_comment)
       VALUES (?, ?, 'APPROVED_FOR_SIGNATURE', ?, ?, ?, ?, ?)`,
      [
        agreementId,
        versionId,
        current.status,
        agreementStatus.SIGNATURE,
        adminUserId,
        'Agreement approved. Download, sign, and upload the signed PDF.',
        internalComment,
      ],
    )
    await updateConnection.commit()
    return getAdminAgreementDetail(agreementId)
  } catch (error) {
    await updateConnection.rollback()
    await removePrivateFile(draft.absolutePath)
    throw error
  } finally {
    updateConnection.release()
  }
}

export async function getAgreementDocument(agreementIdValue, versionIdValue, documentKind, user) {
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const versionId = positiveId(versionIdValue, 'Agreement version')
  const connection = await pool.getConnection()
  try {
    const version = await getCurrentVersionForUpdate(connection, agreementId, versionId)
    if (user.role !== 'ADMIN' && !await customerHasAccess(user.user_id, version.customer_id, connection)) {
      throw httpError('You do not have access to this agreement.', 403)
    }
    const storageKey = documentKind === 'draft'
      ? version.draft_document_path
      : version.signed_document_path
    if (!storageKey) throw httpError('Document is not available.', 404)
    const absolutePath = resolvePrivateStoragePath(storageKey)
    const metadata = await fileMetadata(absolutePath)
    const [hashRows] = await connection.execute(
      `SELECT ${documentKind === 'draft' ? 'draft_sha256' : 'signed_sha256'} AS expected_hash
       FROM agreement_versions
       WHERE agreement_version_id = ?`,
      [versionId],
    )
    if (metadata.sha256 !== hashRows[0]?.expected_hash) {
      throw httpError('Stored document failed its integrity check.', 500)
    }
    return {
      absolutePath,
      fileName: `${version.agreement_number}-v${version.version_number}-${documentKind}.pdf`,
    }
  } finally {
    connection.release()
  }
}

export async function uploadSignedAgreement(user, agreementIdValue, versionIdValue, file) {
  if (!file?.path) throw httpError('Select a signed PDF to upload.')
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const versionId = positiveId(versionIdValue, 'Agreement version')
  let stored
  try {
    const connection = await pool.getConnection()
    try {
      const version = await getCurrentVersionForUpdate(connection, agreementId, versionId)
      if (!await customerHasAccess(user.user_id, version.customer_id, connection)) {
        throw httpError('You do not have access to this agreement.', 403)
      }
      if (Number(version.created_by) !== Number(user.user_id)) {
        throw httpError('Only the customer contact who submitted this selection can upload the signed copy.', 403)
      }
      if (version.status !== agreementStatus.SIGNATURE) {
        throw httpError('This agreement is not awaiting a signed copy.', 409)
      }
      stored = await storeSignedPdf(file.path, agreementId, version.version_number)
      await connection.beginTransaction()
      await connection.execute(
        `UPDATE agreement_versions
         SET status = ?, signed_document_path = ?, signed_sha256 = ?,
             customer_signed_by = ?, signed_uploaded_at = CURRENT_TIMESTAMP
         WHERE agreement_version_id = ? AND status = ?`,
        [
          agreementStatus.ACTIVATION,
          stored.storageKey,
          stored.sha256,
          user.user_id,
          versionId,
          agreementStatus.SIGNATURE,
        ],
      )
      await connection.execute(
        `INSERT INTO agreement_events
          (agreement_id, agreement_version_id, action_code, previous_status, new_status,
           actor_user_id, customer_visible_comment)
         VALUES (?, ?, 'SIGNED_COPY_UPLOADED', ?, ?, ?, 'Signed agreement uploaded for administrator verification.')`,
        [
          agreementId,
          versionId,
          agreementStatus.SIGNATURE,
          agreementStatus.ACTIVATION,
          user.user_id,
        ],
      )
      await connection.commit()
    } finally {
      connection.release()
    }
    return getCustomerAgreementDetail(user.user_id, agreementId)
  } catch (error) {
    await removePrivateFile(stored?.absolutePath)
    throw error
  } finally {
    if (file.path) await removePrivateFile(file.path)
  }
}

export async function requestCustomerAgreementChanges(user, agreementIdValue, versionIdValue, input) {
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const versionId = positiveId(versionIdValue, 'Agreement version')
  const comment = validateText(input.comment, 'Change request', 1000)
  if (!comment) throw httpError('Explain the changes required.')
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const version = await getCurrentVersionForUpdate(connection, agreementId, versionId)
    if (!await customerHasAccess(user.user_id, version.customer_id, connection)) {
      throw httpError('You do not have access to this agreement.', 403)
    }
    if (Number(version.created_by) !== Number(user.user_id)) {
      throw httpError('Only the customer contact who submitted this selection can request changes.', 403)
    }
    if (version.status !== agreementStatus.SIGNATURE) {
      throw httpError('Changes can only be requested while the agreement is awaiting signature.', 409)
    }
    await connection.execute(
      `UPDATE agreement_versions
       SET status = ?, change_reason = ?
       WHERE agreement_version_id = ?`,
      [agreementStatus.CHANGES, comment, versionId],
    )
    await connection.execute(
      `UPDATE agreements SET status = 'DRAFT' WHERE agreement_id = ?`,
      [agreementId],
    )
    await connection.execute(
      `INSERT INTO agreement_events
        (agreement_id, agreement_version_id, action_code, previous_status, new_status,
         actor_user_id, customer_visible_comment)
       VALUES (?, ?, 'CUSTOMER_CHANGE_REQUESTED', ?, ?, ?, ?)`,
      [agreementId, versionId, agreementStatus.SIGNATURE, agreementStatus.CHANGES, user.user_id, comment],
    )
    await connection.commit()
    return getCustomerAgreementDetail(user.user_id, agreementId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function activateSignedAgreement(agreementIdValue, versionIdValue, input, adminUserId) {
  const agreementId = positiveId(agreementIdValue, 'Agreement')
  const versionId = positiveId(versionIdValue, 'Agreement version')
  const effectiveDate = parseDate(input.effectiveDate, 'Effective date')
  const expiryDate = parseDate(input.expiryDate, 'Expiry date')
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const version = await getCurrentVersionForUpdate(connection, agreementId, versionId)
    if (version.status !== agreementStatus.ACTIVATION || !version.signed_document_path) {
      throw httpError('A customer-signed PDF must be uploaded before activation.', 409)
    }
    const finalEffectiveDate = effectiveDate ?? new Date().toISOString().slice(0, 10)
    const finalExpiryDate = expiryDate ?? version.expiry_date
    if (finalExpiryDate && finalExpiryDate < finalEffectiveDate) {
      throw httpError('Expiry date cannot be earlier than the effective date.')
    }
    await connection.execute(
      `UPDATE agreements
       SET status = 'ACTIVE', effective_date = ?, expiry_date = ?,
           signed_date = DATE(?), document_path = ?
       WHERE agreement_id = ?`,
      [
        finalEffectiveDate,
        finalExpiryDate,
        version.signed_uploaded_at,
        version.signed_document_path,
        agreementId,
      ],
    )
    await connection.execute(
      `UPDATE agreement_versions
       SET status = ?, activated_by = ?, activated_at = CURRENT_TIMESTAMP
       WHERE agreement_version_id = ?`,
      [agreementStatus.ACTIVE, adminUserId, versionId],
    )
    await connection.execute(
      `INSERT INTO agreement_events
        (agreement_id, agreement_version_id, action_code, previous_status, new_status,
         actor_user_id, customer_visible_comment)
       VALUES (?, ?, 'AGREEMENT_ACTIVATED', ?, ?, ?, 'Signed agreement verified and activated.')`,
      [agreementId, versionId, agreementStatus.ACTIVATION, agreementStatus.ACTIVE, adminUserId],
    )
    await connection.commit()
    return getAdminAgreementDetail(agreementId)
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function getPendingSignedDocument(agreementIdValue, versionIdValue) {
  return getAgreementDocument(
    agreementIdValue,
    versionIdValue,
    'signed',
    { role: 'ADMIN', user_id: 0 },
  )
}
