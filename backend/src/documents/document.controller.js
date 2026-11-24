import { pool } from '../config/db.js'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolvePrivateStoragePath } from '../agreements/document-storage.js'

export async function streamResumeDocument(req, res, next) {
  try {
    const shareId = Number(req.params.shareId)
    if (!shareId) return res.status(400).json({ message: 'Invalid share ID.' })

    const [rows] = await pool.execute(
      `SELECT 
        rs.share_id,
        rs.customer_id,
        rs.access_expires_at,
        rs.is_active,
        c.candidate_id,
        c.full_name,
        c.resume_path
       FROM resume_shares rs
       JOIN candidates c ON c.candidate_id = rs.candidate_id
       WHERE rs.share_id = ?`,
      [shareId],
    )

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Resume share record not found.' })
    }

    const share = rows[0]

    // Verify permission: Admin or customer contact belonging to this customer
    if (req.authUser.role !== 'ADMIN' && req.authUser.role !== 'RECRUITER') {
      const [contacts] = await pool.execute(
        `SELECT customer_id FROM customer_contacts WHERE user_id = ? AND customer_id = ?`,
        [req.authUser.user_id, share.customer_id],
      )
      if (contacts.length === 0) {
        return res.status(403).json({ message: 'Access denied.' })
      }
    }

    // Check expiry
    const now = new Date()
    const expiresAt = new Date(share.access_expires_at)
    if (now > expiresAt || !share.is_active) {
      return res.status(410).json({ 
        message: 'This resume access link has expired after 24 hours. Please contact your DTS Account Manager.',
        expired: true 
      })
    }

    // Log audit view event
    await pool.execute(
      `INSERT INTO resume_share_events
        (share_id, event_type, actor_user_id, ip_address, user_agent, details)
       VALUES (?, 'DOCUMENT_VIEWED', ?, ?, ?, 'Resume document previewed/streamed')`,
      [shareId, req.authUser.user_id, req.ip || '127.0.0.1', req.headers['user-agent'] || ''],
    )

    // Check if resume_path exists on private filesystem
    if (!share.resume_path) {
      // Return a generated text preview if no physical PDF is uploaded yet for sample candidate
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Resume - ${share.full_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 750px; margin: 0 auto; }
            .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
            h1 { margin-top: 0; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            .section { margin-top: 24px; }
            .section-title { font-weight: 700; color: #334155; text-transform: uppercase; font-size: 13px; letter-spacing: 0.05em; margin-bottom: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">CONFIDENTIAL CANDIDATE PROFILE</span>
            <h1>${share.full_name}</h1>
            <div class="section">
              <div class="section-title">Security & Validity</div>
              <p>24-Hour Secure Share Active. Expires at: <strong>${share.access_expires_at}</strong></p>
            </div>
            <div class="section">
              <div class="section-title">Candidate Details</div>
              <p>Candidate ID: #${share.candidate_id}</p>
              <p>Authorized for Customer Review under DTS Service Agreement.</p>
            </div>
          </div>
        </body>
        </html>
      `)
    }

    try {
      const fullPath = resolvePrivateStoragePath(share.resume_path)
      const fileStats = await stat(fullPath)
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Length', fileStats.size)
      res.setHeader('Content-Disposition', `inline; filename="Candidate_${share.candidate_id}_Resume.pdf"`)
      createReadStream(fullPath).pipe(res)
    } catch {
      // If file not physically on disk, render fallback profile
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Resume - ${share.full_name}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; background: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 32px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 750px; margin: 0 auto; }
            .badge { display: inline-block; background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
            h1 { margin-top: 0; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
          </style>
        </head>
        <body>
          <div class="card">
            <span class="badge">CONFIDENTIAL PROFILE PREVIEW</span>
            <h1>${share.full_name}</h1>
            <p>Candidate ID: #${share.candidate_id}</p>
            <p>Active 24-hr access window until: <strong>${share.access_expires_at}</strong></p>
            <p>File reference: <code>${share.resume_path}</code></p>
          </div>
        </body>
        </html>
      `)
    }
  } catch (error) {
    return next(error)
  }
}
