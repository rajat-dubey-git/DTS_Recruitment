import { pool } from '../config/db.js'

export async function getCustomerSharedCandidates(req, res, next) {
  try {
    const userId = req.authUser.user_id
    const isAdmin = req.authUser.role === 'ADMIN'

    let customerId = null
    if (!isAdmin) {
      const [contacts] = await pool.execute(
        `SELECT customer_id FROM customer_contacts WHERE user_id = ? LIMIT 1`,
        [userId],
      )
      if (contacts.length === 0) {
        return res.status(403).json({ message: 'No customer account linked to this user.' })
      }
      customerId = contacts[0].customer_id
    }

    let sql = `
      SELECT 
        rs.share_id,
        rs.application_id,
        rs.candidate_id,
        rs.requirement_id,
        rs.access_expires_at,
        rs.is_active,
        rs.customer_decision,
        rs.decision_notes,
        rs.decision_timestamp,
        CASE WHEN rs.access_expires_at > CURRENT_TIMESTAMP AND rs.is_active = 1 THEN 1 ELSE 0 END AS is_accessible,
        TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP, rs.access_expires_at) AS minutes_remaining,
        r.requirement_code,
        r.job_title,
        c.full_name AS candidate_name,
        c.current_title,
        c.total_experience_years,
        c.current_location,
        c.primary_skills,
        c.expected_ctc,
        c.notice_period_days,
        a.screening_notes,
        cust.company_name
      FROM resume_shares rs
      JOIN applications a ON a.application_id = rs.application_id
      JOIN candidates c ON c.candidate_id = rs.candidate_id
      JOIN requirements r ON r.requirement_id = rs.requirement_id
      JOIN customers cust ON cust.customer_id = rs.customer_id
      WHERE 1=1
    `
    const params = []

    if (!isAdmin && customerId) {
      sql += ` AND rs.customer_id = ?`
      params.push(customerId)
    }

    sql += ` ORDER BY rs.created_at DESC`

    const [shares] = await pool.execute(sql, params)
    return res.json({ candidates: shares })
  } catch (error) {
    return next(error)
  }
}

export async function submitCandidateDecision(req, res, next) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const shareId = Number(req.params.shareId)
    const { decision, notes } = req.body

    if (!shareId || !decision) {
      return res.status(400).json({ message: 'Share ID and decision (SHORTLIST, REJECT, HOLD) are required.' })
    }

    const validDecisions = ['SHORTLIST', 'REJECT', 'HOLD']
    if (!validDecisions.includes(decision)) {
      return res.status(400).json({ message: 'Decision must be SHORTLIST, REJECT, or HOLD.' })
    }

    // Verify share access
    const [shares] = await connection.execute(
      `SELECT rs.*, a.application_id 
       FROM resume_shares rs
       JOIN applications a ON a.application_id = rs.application_id
       WHERE rs.share_id = ?`,
      [shareId],
    )

    if (shares.length === 0) {
      return res.status(404).json({ message: 'Shared candidate record not found.' })
    }

    const share = shares[0]

    // Verify customer owns this share if not admin
    if (req.authUser.role !== 'ADMIN') {
      const [contacts] = await connection.execute(
        `SELECT customer_id FROM customer_contacts WHERE user_id = ? AND customer_id = ?`,
        [req.authUser.user_id, share.customer_id],
      )
      if (contacts.length === 0) {
        return res.status(403).json({ message: 'You do not have permission to act on this share.' })
      }
    }

    // Update resume_shares
    await connection.execute(
      `UPDATE resume_shares
       SET customer_decision = ?, decision_notes = ?, decision_timestamp = CURRENT_TIMESTAMP
       WHERE share_id = ?`,
      [decision, notes || null, shareId],
    )

    // Map customer decision to application status
    let appStatus = 'PRESENTED'
    if (decision === 'SHORTLIST') appStatus = 'CUSTOMER_SHORTLISTED'
    if (decision === 'REJECT') appStatus = 'CUSTOMER_REJECTED'
    if (decision === 'HOLD') appStatus = 'ON_HOLD'

    await connection.execute(
      `UPDATE applications SET status = ? WHERE application_id = ?`,
      [appStatus, share.application_id],
    )

    // Log decision event
    await connection.execute(
      `INSERT INTO resume_share_events
        (share_id, event_type, actor_user_id, ip_address, user_agent, details)
       VALUES (?, 'DECISION_SUBMITTED', ?, ?, ?, ?)`,
      [shareId, req.authUser.user_id, req.ip || '127.0.0.1', req.headers['user-agent'] || '', `Customer decision: ${decision}`],
    )

    await connection.commit()
    return res.json({ message: `Candidate successfully marked as ${decision}.`, decision })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}
