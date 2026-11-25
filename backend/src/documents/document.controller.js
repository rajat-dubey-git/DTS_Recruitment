import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pool } from '../config/db.js'
import { resolvePrivateStoragePath } from '../agreements/document-storage.js'

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

export async function streamResumeDocument(req, res, next) {
  try {
    const shareId = Number(req.params.shareId)
    if (!Number.isSafeInteger(shareId) || shareId < 1) {
      throw httpError(400, 'Invalid resume share ID.')
    }

    const [rows] = await pool.execute(
      `SELECT rs.share_id, rs.application_id, rs.shared_with_contact_id,
              rs.document_id, rs.access_expires_at, rs.status,
              a.candidate_id, CONCAT_WS(' ', c.first_name, c.last_name) AS candidate_name,
              cd.file_path, cd.file_name,
              cd.verification_status, cd.malware_scan_status
       FROM resume_shares rs
       INNER JOIN applications a ON a.application_id = rs.application_id
       INNER JOIN candidates c ON c.candidate_id = a.candidate_id
       INNER JOIN candidate_documents cd
         ON cd.document_id = rs.document_id AND cd.candidate_id = a.candidate_id
       WHERE rs.share_id = ?`,
      [shareId],
    )
    const share = rows[0]
    if (!share) throw httpError(404, 'Resume share not found.')

    if (req.authUser.role === 'CUSTOMER') {
      const [contacts] = await pool.execute(
        `SELECT contact_id
         FROM customer_contacts
         WHERE contact_id = ? AND user_id = ? AND status = 'ACTIVE'
         LIMIT 1`,
        [share.shared_with_contact_id, req.authUser.user_id],
      )
      if (!contacts[0]) throw httpError(403, 'You do not have permission to view this resume.')
    } else if (req.authUser.role === 'RECRUITER') {
      const [applications] = await pool.execute(
        `SELECT a.application_id
         FROM applications a
         WHERE a.application_id = ?
           AND (a.recruiter_id = ? OR EXISTS (
             SELECT 1
             FROM requirement_assignments ra
             WHERE ra.requirement_id = a.requirement_id
               AND ra.recruiter_id = ?
               AND ra.unassigned_at IS NULL
           ))
         LIMIT 1`,
        [share.application_id, req.authUser.user_id, req.authUser.user_id],
      )
      if (!applications[0]) throw httpError(403, 'This resume is not available to your recruiter account.')
    } else if (req.authUser.role !== 'ADMIN') {
      throw httpError(403, 'You do not have permission to view this resume.')
    }
    if (share.verification_status !== 'VERIFIED' || share.malware_scan_status !== 'CLEAN') {
      throw httpError(410, 'This resume is no longer available for sharing.')
    }

    const expiresAt = share.access_expires_at ? new Date(share.access_expires_at) : null
    if (
      share.status === 'EXPIRED' ||
      share.status === 'REVOKED' ||
      !expiresAt ||
      Number.isNaN(expiresAt.getTime()) ||
      expiresAt.getTime() <= Date.now()
    ) {
      if (share.status === 'SHARED' || share.status === 'VIEWED') {
        await pool.execute(
          `UPDATE resume_shares SET status = 'EXPIRED'
           WHERE share_id = ? AND status IN ('SHARED', 'VIEWED')`,
          [shareId],
        )
        await pool.execute(
          `INSERT INTO resume_share_events (share_id, event_code, actor_user_id)
           VALUES (?, 'EXPIRED', ?)`,
          [shareId, req.authUser.user_id],
        )
      }
      throw httpError(410, 'This resume share has expired. Ask the recruiter to create a new share.')
    }

    const fullPath = resolvePrivateStoragePath(share.file_path)
    let fileStats
    try {
      fileStats = await stat(fullPath)
    } catch (error) {
      if (error.code === 'ENOENT') throw httpError(404, 'The shared resume file is unavailable.')
      throw error
    }

    await pool.execute(
      `UPDATE resume_shares
       SET status = 'VIEWED', viewed_at = COALESCE(viewed_at, CURRENT_TIMESTAMP)
       WHERE share_id = ? AND status = 'SHARED'`,
      [shareId],
    )
    await pool.execute(
      `INSERT INTO resume_share_events (share_id, event_code, actor_user_id)
       VALUES (?, 'VIEWED', ?)`,
      [shareId, req.authUser.user_id],
    )

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', fileStats.size)
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(share.file_name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    )
    return createReadStream(fullPath).pipe(res)
  } catch (error) {
    return next(error)
  }
}
