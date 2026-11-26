import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pool } from '../config/db.js'
import { resolvePrivateStoragePath } from '../agreements/document-storage.js'
import { shareEligibleCandidateApplications } from '../recruiter/resume-sharing.service.js'

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

export async function listAdminCandidates(req, res, next) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const searchClause = search
      ? `WHERE (c.candidate_code LIKE ? OR CONCAT_WS(' ', c.first_name, c.last_name) LIKE ?
          OR c.email LIKE ? OR c.mobile LIKE ?)`
      : ''
    const params = search ? Array(4).fill(`%${search}%`) : []
    const [candidates] = await pool.execute(
      `SELECT c.candidate_id, c.candidate_code, c.first_name, c.last_name,
              c.email, c.mobile, c.current_city, c.current_state,
              c.total_experience_years, c.status,
              (SELECT COUNT(*) FROM applications a WHERE a.candidate_id = c.candidate_id) AS application_count,
              (SELECT cd.document_id FROM candidate_documents cd
               WHERE cd.candidate_id = c.candidate_id AND cd.document_type = 'RESUME' AND cd.is_current = 1
               ORDER BY cd.uploaded_at DESC LIMIT 1) AS current_resume_id,
              (SELECT cd.verification_status FROM candidate_documents cd
               WHERE cd.candidate_id = c.candidate_id AND cd.document_type = 'RESUME' AND cd.is_current = 1
               ORDER BY cd.uploaded_at DESC LIMIT 1) AS resume_verification_status,
              (SELECT cd.malware_scan_status FROM candidate_documents cd
               WHERE cd.candidate_id = c.candidate_id AND cd.document_type = 'RESUME' AND cd.is_current = 1
               ORDER BY cd.uploaded_at DESC LIMIT 1) AS resume_malware_scan_status
       FROM candidates c
       ${searchClause}
       ORDER BY c.updated_at DESC, c.candidate_id DESC
       LIMIT 250`,
      params,
    )
    return res.json({ candidates })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminCandidateDetails(req, res, next) {
  try {
    const candidateId = Number(req.params.candidateId)
    if (!Number.isSafeInteger(candidateId) || candidateId < 1) throw httpError(400, 'Invalid candidate ID.')
    const [[candidateRows], [education], [experience], [skills], [documents]] = await Promise.all([
      pool.execute(
        `SELECT candidate_id, candidate_code, first_name, last_name, email, mobile,
                date_of_birth, current_city, current_state, total_experience_years,
                current_ctc, expected_ctc, notice_period_days, profile_summary, status,
                created_at, updated_at
         FROM candidates WHERE candidate_id = ? LIMIT 1`,
        [candidateId],
      ),
      pool.execute(
        `SELECT education_id, qualification, specialization, institution,
                passing_year, grade_or_percentage
         FROM candidate_education WHERE candidate_id = ?
         ORDER BY passing_year DESC, education_id DESC`,
        [candidateId],
      ),
      pool.execute(
        `SELECT experience_id, employer_name, designation, start_date, end_date, is_current
         FROM candidate_experience WHERE candidate_id = ?
         ORDER BY start_date DESC, experience_id DESC`,
        [candidateId],
      ),
      pool.execute(
        `SELECT cs.skill_id, s.skill_name, s.skill_category,
                cs.experience_years, cs.proficiency
         FROM candidate_skills cs
         JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = ?
         ORDER BY s.skill_name`,
        [candidateId],
      ),
      pool.execute(
        `SELECT document_id, file_name, uploaded_at, file_size_bytes,
                verification_status, malware_scan_status, is_current
         FROM candidate_documents
         WHERE candidate_id = ? AND document_type = 'RESUME'
         ORDER BY is_current DESC, uploaded_at DESC`,
        [candidateId],
      ),
    ])
    if (!candidateRows[0]) throw httpError(404, 'Candidate not found.')
    return res.json({
      candidate: candidateRows[0],
      education,
      experience,
      skills,
      documents,
    })
  } catch (error) {
    return next(error)
  }
}

export async function downloadAdminCandidateDocument(req, res, next) {
  try {
    const candidateId = Number(req.params.candidateId)
    const documentId = Number(req.params.documentId)
    if (!Number.isSafeInteger(candidateId) || candidateId < 1
      || !Number.isSafeInteger(documentId) || documentId < 1) {
      throw httpError(400, 'Invalid candidate document.')
    }
    const [documents] = await pool.execute(
      `SELECT file_path, file_name, malware_scan_status
       FROM candidate_documents
       WHERE candidate_id = ? AND document_id = ? AND document_type = 'RESUME'
       LIMIT 1`,
      [candidateId, documentId],
    )
    if (!documents[0]) throw httpError(404, 'Candidate resume not found.')
    if (documents[0].malware_scan_status === 'REJECTED') {
      throw httpError(409, 'This resume was rejected by the security scan and cannot be downloaded.')
    }
    const fullPath = resolvePrivateStoragePath(documents[0].file_path)
    let fileStats
    try {
      fileStats = await stat(fullPath)
    } catch (error) {
      if (error.code === 'ENOENT') throw httpError(404, 'Resume file not found.')
      throw error
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', fileStats.size)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${String(documents[0].file_name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    )
    return createReadStream(fullPath).pipe(res)
  } catch (error) {
    return next(error)
  }
}

export async function reviewAdminCandidateDocument(req, res, next) {
  const connection = await pool.getConnection()
  try {
    const candidateId = Number(req.params.candidateId)
    const documentId = Number(req.params.documentId)
    const verificationStatus = req.body?.verificationStatus
    const malwareScanStatus = req.body?.malwareScanStatus
    if (!Number.isSafeInteger(candidateId) || candidateId < 1
      || !Number.isSafeInteger(documentId) || documentId < 1) {
      throw httpError(400, 'Invalid candidate document.')
    }
    if (!['VERIFIED', 'REJECTED'].includes(verificationStatus)) {
      throw httpError(400, 'Select VERIFIED or REJECTED for document review.')
    }
    if (!['CLEAN', 'REJECTED', 'ERROR'].includes(malwareScanStatus)) {
      throw httpError(400, 'Select a completed security scan result.')
    }
    if (req.body?.scanConfirmed !== true) {
      throw httpError(400, 'Confirm that the resume was scanned using approved security software.')
    }

    await connection.beginTransaction()
    const [documents] = await connection.execute(
      `SELECT verification_status, malware_scan_status
       FROM candidate_documents
       WHERE candidate_id = ? AND document_id = ? AND document_type = 'RESUME'
       FOR UPDATE`,
      [candidateId, documentId],
    )
    if (!documents[0]) throw httpError(404, 'Candidate resume not found.')
    const previous = documents[0]
    await connection.execute(
      `UPDATE candidate_documents
       SET verification_status = ?, verified_by = ?, verified_at = CURRENT_TIMESTAMP,
           malware_scan_status = ?, malware_scanned_at = CURRENT_TIMESTAMP
       WHERE candidate_id = ? AND document_id = ?`,
      [verificationStatus, req.authUser.user_id, malwareScanStatus, candidateId, documentId],
    )
    await connection.execute(
      `INSERT INTO audit_logs
        (actor_user_id, action_code, entity_name, entity_id, old_values, new_values, ip_address)
       VALUES (?, 'CANDIDATE_RESUME_REVIEWED', 'candidate_documents', ?, ?, ?, ?)`,
      [
        req.authUser.user_id,
        String(documentId),
        JSON.stringify({
          verification_status: previous.verification_status,
          malware_scan_status: previous.malware_scan_status,
        }),
        JSON.stringify({ verification_status: verificationStatus, malware_scan_status: malwareScanStatus }),
        req.ip || null,
      ],
    )
    const sharedCount = verificationStatus === 'VERIFIED' && malwareScanStatus === 'CLEAN'
      ? await shareEligibleCandidateApplications(connection, candidateId, req.authUser.user_id)
      : 0
    await connection.commit()
    return res.json({
      message: sharedCount > 0
        ? `Resume review recorded. ${sharedCount} candidate submission(s) were shared with customers.`
        : 'Resume review and scan result recorded.',
    })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}
