import { stat } from 'node:fs/promises'
import path from 'node:path'
import { pool } from '../config/db.js'
import { getCandidateProfileForUser } from '../candidate/account-link.service.js'
import {
  removePrivateFile,
  resolvePrivateStoragePath,
  storePrivatePdf,
} from '../agreements/document-storage.js'
import {
  createNotification,
  notifyActiveAdmins,
  notifyAssignedRecruiters,
} from '../notifications/notification.service.js'

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

function positiveId(value, label) {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw httpError(`Invalid ${label}.`, 400)
  return parsed
}

function optionalAmount(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 9999999999.99
    || Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001) {
    throw httpError('Offered CTC must be a positive amount with up to two decimal places.', 400)
  }
  return parsed.toFixed(2)
}

function optionalDate(value, label) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(`${label} must be a valid date.`, 400)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw httpError(`${label} must be a valid date.`, 400)
  }
  return value
}

function optionalText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > maxLength) throw httpError(`${label} must be ${maxLength} characters or fewer.`, 400)
  return text || null
}

export async function listAdminOfferSelections() {
  const [selections] = await pool.execute(
    `SELECT s.selection_id, s.application_id, s.selected_at, s.agreed_ctc,
            a.application_number, r.requirement_number, r.job_title,
            c.candidate_id, CONCAT_WS(' ', c.first_name, c.last_name) AS candidate_name,
            c.email AS candidate_email, c.user_id AS candidate_user_id,
            candidate_user.status AS candidate_user_status, customer.company_name,
            latest_offer.offer_id, latest_offer.offer_reference,
            latest_offer.status AS offer_status, latest_offer.offered_at
     FROM selections s
     INNER JOIN applications a ON a.application_id = s.application_id
     INNER JOIN candidates c ON c.candidate_id = a.candidate_id
     INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
     INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
     INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
     INNER JOIN customers customer ON customer.customer_id = agreement.customer_id
     LEFT JOIN users candidate_user ON candidate_user.user_id = c.user_id
       AND candidate_user.role = 'CANDIDATE'
     LEFT JOIN (
       SELECT offer.offer_id, offer.selection_id, offer.offer_reference,
              offer.status, offer.offered_at
       FROM offers offer
       INNER JOIN (
         SELECT selection_id, MAX(offer_id) AS offer_id
         FROM offers
         GROUP BY selection_id
       ) latest ON latest.offer_id = offer.offer_id
     ) latest_offer ON latest_offer.selection_id = s.selection_id
     WHERE a.status = 'SELECTED'
     ORDER BY s.selected_at DESC, s.selection_id DESC
     LIMIT 250`,
  )
  return { selections }
}

export async function sendOffer(selectionIdValue, input, file, actor) {
  const selectionId = positiveId(selectionIdValue, 'selection')
  if (!file?.path) throw httpError('Select the offer PDF to upload.', 400)
  const offerReference = optionalText(input?.offerReference, 'Offer reference', 100)
  const offeredCtc = optionalAmount(input?.offeredCtc)
  const expiresOn = optionalDate(input?.expiresOn, 'Expiry date')
  const joiningDate = optionalDate(input?.proposedJoiningDate, 'Proposed joining date')
  const expiresAt = expiresOn ? `${expiresOn} 23:59:59` : null
  let stored

  try {
    stored = await storePrivatePdf(file.path, path.join('offers', String(selectionId)), 'offer')
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute(
        `SELECT s.selection_id, s.application_id, a.candidate_id, a.recruiter_id,
                r.requirement_id, c.user_id AS candidate_user_id,
                candidate_user.role AS candidate_user_role,
                candidate_user.status AS candidate_user_status,
                c.first_name, c.last_name, r.job_title
         FROM selections s
         INNER JOIN applications a ON a.application_id = s.application_id
         INNER JOIN candidates c ON c.candidate_id = a.candidate_id
         INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
         LEFT JOIN users candidate_user ON candidate_user.user_id = c.user_id
         WHERE s.selection_id = ? AND a.status = 'SELECTED'
         LIMIT 1
         FOR UPDATE`,
        [selectionId],
      )
      const selection = rows[0]
      if (!selection) throw httpError('Only a selected candidate can receive an offer.', 409)
      if (!selection.candidate_user_id
        || selection.candidate_user_role !== 'CANDIDATE'
        || selection.candidate_user_status !== 'ACTIVE') {
        throw httpError('This candidate does not have an active portal account for offer delivery.', 409)
      }

      if (actor.role === 'RECRUITER') {
        const [assignments] = await connection.execute(
          `SELECT assignment_id
           FROM requirement_assignments
           WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
           LIMIT 1`,
          [selection.requirement_id, actor.user_id],
        )
        if (!assignments[0]) throw httpError('This requirement is not assigned to you.', 403)
      }

      if (expiresAt && new Date(`${expiresOn}T23:59:59`).getTime() <= Date.now()) {
        throw httpError('Expiry date must be in the future.', 400)
      }

      const [result] = await connection.execute(
        `INSERT INTO offers
          (selection_id, offer_reference, offered_ctc, offered_at, expires_at,
           proposed_joining_date, status, document_path)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, 'SENT', ?)`,
        [
          selectionId,
          offerReference,
          offeredCtc,
          expiresAt,
          joiningDate,
          stored.storageKey,
        ],
      )
      await createNotification(connection, {
        userId: selection.candidate_user_id,
        type: 'OFFER_RECEIVED',
        title: `Offer received: ${selection.job_title}`,
        message: 'A new offer letter is available in your candidate portal.',
        targetUrl: '/app/candidate/offers',
      })
      await connection.commit()
      return { offerId: Number(result.insertId), message: 'Offer uploaded and sent to the candidate.' }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    await removePrivateFile(stored?.absolutePath)
    throw error
  } finally {
    if (file.path) await removePrivateFile(file.path)
  }
}

export async function listCandidateOffers(userId) {
  const candidate = await getCandidateProfileForUser(userId)
  if (!candidate) throw httpError('Candidate profile is not linked to this account.', 409)
  const [offers] = await pool.execute(
    `SELECT offer.offer_id, offer.offer_reference, offer.offered_ctc,
            offer.offered_at, offer.expires_at, offer.proposed_joining_date,
            CASE WHEN offer.status = 'SENT' AND offer.expires_at <= CURRENT_TIMESTAMP
              THEN 'EXPIRED' ELSE offer.status END AS status,
            a.application_number, r.requirement_number, r.job_title,
            customer.company_name
     FROM offers offer
     INNER JOIN selections s ON s.selection_id = offer.selection_id
     INNER JOIN applications a ON a.application_id = s.application_id
     INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
     INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
     INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
     INNER JOIN customers customer ON customer.customer_id = agreement.customer_id
     WHERE a.candidate_id = ? AND offer.status <> 'DRAFT'
     ORDER BY offer.offered_at DESC, offer.offer_id DESC`,
    [candidate.candidate_id],
  )
  return { offers }
}

export async function getCandidateOfferDocument(userId, offerIdValue) {
  const offerId = positiveId(offerIdValue, 'offer')
  const candidate = await getCandidateProfileForUser(userId)
  if (!candidate) throw httpError('Candidate profile is not linked to this account.', 409)
  const [rows] = await pool.execute(
    `SELECT offer.document_path, offer.offer_reference, offer.status
     FROM offers offer
     INNER JOIN selections s ON s.selection_id = offer.selection_id
     INNER JOIN applications a ON a.application_id = s.application_id
     WHERE offer.offer_id = ? AND a.candidate_id = ? AND offer.status <> 'DRAFT'
     LIMIT 1`,
    [offerId, candidate.candidate_id],
  )
  if (!rows[0]) throw httpError('Offer not found.', 404)
  if (!rows[0].document_path) throw httpError('The offer document is not available.', 404)
  const absolutePath = resolvePrivateStoragePath(rows[0].document_path)
  try {
    await stat(absolutePath)
  } catch (error) {
    if (error.code === 'ENOENT') throw httpError('The offer document is not available.', 404)
    throw error
  }
  const name = rows[0].offer_reference
    ? String(rows[0].offer_reference).replace(/[^a-zA-Z0-9._-]/g, '_')
    : `offer-${offerId}`
  return { absolutePath, fileName: `${name}.pdf` }
}

export async function respondToCandidateOffer(userId, offerIdValue, response) {
  const offerId = positiveId(offerIdValue, 'offer')
  if (!['ACCEPTED', 'DECLINED'].includes(response)) {
    throw httpError('Select ACCEPTED or DECLINED.', 400)
  }
  const candidate = await getCandidateProfileForUser(userId)
  if (!candidate) throw httpError('Candidate profile is not linked to this account.', 409)
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [rows] = await connection.execute(
      `SELECT offer.offer_id, offer.status, offer.expires_at, r.requirement_id,
              r.job_title, a.application_number
       FROM offers offer
       INNER JOIN selections s ON s.selection_id = offer.selection_id
       INNER JOIN applications a ON a.application_id = s.application_id
       INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
       WHERE offer.offer_id = ? AND a.candidate_id = ?
       LIMIT 1
       FOR UPDATE`,
      [offerId, candidate.candidate_id],
    )
    const offer = rows[0]
    if (!offer) throw httpError('Offer not found.', 404)
    if (offer.status !== 'SENT') throw httpError('Only a sent offer can be accepted or declined.', 409)
    if (offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) {
      await connection.execute(
        `UPDATE offers SET status = 'EXPIRED'
         WHERE offer_id = ? AND status = 'SENT'`,
        [offerId],
      )
      await connection.commit()
      return { expired: true, message: 'This offer has expired and can no longer be answered.' }
    }

    await connection.execute(
      `UPDATE offers
       SET status = ?, responded_at = CURRENT_TIMESTAMP
       WHERE offer_id = ? AND status = 'SENT'`,
      [response, offerId],
    )
    await notifyActiveAdmins(connection, {
      type: `OFFER_${response}`,
      title: `Offer ${response.toLowerCase()}: ${offer.job_title}`,
      message: `The candidate ${response.toLowerCase()} offer ${offer.offer_id}.`,
      targetUrl: '/app/admin/offers',
    })
    await notifyAssignedRecruiters(connection, offer.requirement_id, {
      type: `OFFER_${response}`,
      title: `Offer ${response.toLowerCase()}: ${offer.job_title}`,
      message: `The candidate ${response.toLowerCase()} the offer for application ${offer.application_number}.`,
      targetUrl: '/app/recruiter/applications',
    })
    await connection.commit()
    return { expired: false, message: `Offer ${response.toLowerCase()}.` }
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

