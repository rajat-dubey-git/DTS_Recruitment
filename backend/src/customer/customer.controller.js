import { pool } from '../config/db.js'
import PDFDocument from 'pdfkit'

export async function getCustomerSharedCandidates(req, res, next) {
  try {
    const userId = req.authUser.user_id
    const isAdmin = req.authUser.role === 'ADMIN'

    let customerId = null
    if (!isAdmin) {
      const [contacts] = await pool.execute(
        `SELECT customer_id FROM customer_contacts
         WHERE user_id = ? AND status = 'ACTIVE'
         ORDER BY is_primary DESC LIMIT 1`,
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
        a.candidate_id,
        a.requirement_id,
        rs.access_expires_at,
        CASE WHEN rs.access_expires_at > CURRENT_TIMESTAMP AND rs.status IN ('SHARED','VIEWED') THEN 1 ELSE 0 END AS is_accessible,
        TIMESTAMPDIFF(MINUTE, CURRENT_TIMESTAMP, rs.access_expires_at) AS minutes_remaining,
        rs.status AS share_status,
        r.requirement_number AS requirement_code,
        r.job_title,
        CONCAT_WS(' ', c.first_name, c.last_name) AS candidate_name,
        c.total_experience_years,
        CONCAT_WS(', ', c.current_city, c.current_state) AS current_location,
        c.expected_ctc,
        c.notice_period_days,
        (SELECT GROUP_CONCAT(s.skill_name ORDER BY s.skill_name SEPARATOR ', ')
         FROM candidate_skills cs
         JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = c.candidate_id) AS primary_skills,
        latest_decision.decision AS customer_decision,
        latest_decision.notes AS decision_notes,
        cust.company_name
      FROM resume_shares rs
      JOIN applications a ON a.application_id = rs.application_id
      JOIN candidates c ON c.candidate_id = a.candidate_id
      JOIN job_requirements r ON r.requirement_id = a.requirement_id
      JOIN customer_contacts cc ON cc.contact_id = rs.shared_with_contact_id
      JOIN customers cust ON cust.customer_id = cc.customer_id
      LEFT JOIN customer_candidate_decisions latest_decision
        ON latest_decision.decision_id = (
          SELECT MAX(d.decision_id)
          FROM customer_candidate_decisions d
          WHERE d.share_id = rs.share_id
        )
      WHERE 1=1
    `
    const params = []

    if (!isAdmin && customerId) {
      sql += ` AND cc.customer_id = ?`
      params.push(customerId)
    }
    sql += ` AND cc.status = 'ACTIVE'`

    sql += ` ORDER BY rs.shared_at DESC`

    const [shares] = await pool.execute(sql, params)
    return res.json({ candidates: shares })
  } catch (error) {
    return next(error)
  }
}

async function getCustomerIdForUser(userId) {
  const [rows] = await pool.execute(
    `SELECT customer_id
     FROM customer_contacts
     WHERE user_id = ? AND status = 'ACTIVE'
     ORDER BY is_primary DESC
     LIMIT 1`,
    [userId],
  )
  return rows[0]?.customer_id || null
}

export async function listCustomerInvoices(req, res, next) {
  try {
    let customerId = null
    if (req.authUser.role !== 'ADMIN') {
      customerId = await getCustomerIdForUser(req.authUser.user_id)
      if (!customerId) return res.status(403).json({ message: 'No customer account is linked to this user.' })
    }

    let sql = `
      SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.invoice_date, i.due_date,
             i.service_period_start, i.service_period_end, i.subtotal, i.discount_amount,
             i.tax_total, i.total_amount, i.status,
             so.order_number, c.company_name
      FROM invoices i
      JOIN service_orders so ON so.service_order_id = i.service_order_id
      JOIN agreements a ON a.agreement_id = so.agreement_id
      JOIN customers c ON c.customer_id = a.customer_id
      WHERE 1=1
    `
    const params = []
    if (customerId) {
      sql += ' AND c.customer_id = ?'
      params.push(customerId)
    }
    sql += ' ORDER BY i.invoice_date DESC, i.invoice_id DESC'
    const [invoices] = await pool.execute(sql, params)
    return res.json({ invoices })
  } catch (error) {
    return next(error)
  }
}

export async function downloadCustomerInvoice(req, res, next) {
  try {
    const invoiceId = Number(req.params.invoiceId)
    if (!Number.isSafeInteger(invoiceId) || invoiceId < 1) {
      return res.status(400).json({ message: 'Invalid invoice ID.' })
    }

    let customerId = null
    if (req.authUser.role !== 'ADMIN') {
      customerId = await getCustomerIdForUser(req.authUser.user_id)
      if (!customerId) return res.status(403).json({ message: 'No customer account is linked to this user.' })
    }

    let sql = `
      SELECT i.*, c.company_name
      FROM invoices i
      JOIN service_orders so ON so.service_order_id = i.service_order_id
      JOIN agreements a ON a.agreement_id = so.agreement_id
      JOIN customers c ON c.customer_id = a.customer_id
      WHERE i.invoice_id = ?
    `
    const params = [invoiceId]
    if (customerId) {
      sql += ' AND c.customer_id = ?'
      params.push(customerId)
    }
    const [rows] = await pool.execute(sql, params)
    if (!rows[0]) return res.status(404).json({ message: 'Invoice not found.' })
    const invoice = rows[0]

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${String(invoice.invoice_number).replace(/[^a-zA-Z0-9._-]/g, '_')}.pdf"`)
    const document = new PDFDocument({ margin: 48 })
    document.pipe(res)
    document.fontSize(20).text('DTS Recruitment', { align: 'right' })
    document.moveDown()
    document.fontSize(16).text(`Invoice ${invoice.invoice_number}`)
    document.moveDown(0.5)
    document.fontSize(11).text(`Customer: ${invoice.company_name || '—'}`)
    document.text(`Invoice date: ${invoice.invoice_date}`)
    document.text(`Due date: ${invoice.due_date}`)
    document.text(`Status: ${invoice.status}`)
    document.moveDown()
    document.text(`Subtotal: ${invoice.subtotal}`)
    document.text(`Discount: ${invoice.discount_amount}`)
    document.text(`Tax: ${invoice.tax_total}`)
    document.moveDown()
    document.fontSize(14).text(`Total: ${invoice.total_amount}`)
    document.end()
  } catch (error) {
    return next(error)
  }
}

export async function submitCandidateDecision(req, res, next) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const shareId = Number(req.params.shareId)
    const decision = req.body?.decision
    const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim() : ''
    if (!Number.isSafeInteger(shareId) || shareId < 1) throw Object.assign(new Error('Invalid share ID.'), { statusCode: 400 })
    if (!['SHORTLIST', 'REJECT', 'HOLD'].includes(decision)) {
      throw Object.assign(new Error('Select SHORTLIST, REJECT or HOLD.'), { statusCode: 400 })
    }
    if (notes.length > 1000) throw Object.assign(new Error('Notes must be 1,000 characters or fewer.'), { statusCode: 400 })

    const [shares] = await connection.execute(
      `SELECT rs.share_id, rs.status AS share_status, rs.access_expires_at,
              a.application_id, a.status AS application_status,
              cc.customer_id, cc.status AS contact_status
       FROM resume_shares rs
       JOIN applications a ON a.application_id = rs.application_id
       JOIN customer_contacts cc ON cc.contact_id = rs.shared_with_contact_id
       WHERE rs.share_id = ?
       FOR UPDATE`,
      [shareId],
    )
    if (shares.length === 0) throw Object.assign(new Error('Shared candidate record not found.'), { statusCode: 404 })

    const share = shares[0]
    if (share.contact_status !== 'ACTIVE') {
      throw Object.assign(new Error('The customer contact for this share is no longer active.'), { statusCode: 403 })
    }
    if (req.authUser.role !== 'ADMIN') {
      const [contacts] = await connection.execute(
        `SELECT customer_id FROM customer_contacts
         WHERE user_id = ? AND customer_id = ? AND status = 'ACTIVE'`,
        [req.authUser.user_id, share.customer_id],
      )
      if (contacts.length === 0) {
        throw Object.assign(new Error('You do not have permission to act on this share.'), { statusCode: 403 })
      }
    }
    const expiry = share.access_expires_at ? new Date(share.access_expires_at).getTime() : 0
    if (!['SHARED', 'VIEWED'].includes(share.share_status)
      || !Number.isFinite(expiry) || expiry <= Date.now()) {
      throw Object.assign(new Error('This resume share has expired or is no longer active.'), { statusCode: 410 })
    }

    await connection.execute(
      `INSERT INTO customer_candidate_decisions
        (share_id, customer_id, decided_by, decision, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [shareId, share.customer_id, req.authUser.user_id, decision, notes || null],
    )
    const nextStatus = decision === 'SHORTLIST'
      && ['APPLIED', 'SCREENING'].includes(share.application_status)
      ? 'SHORTLISTED'
      : decision === 'REJECT'
        && !['SELECTED', 'REJECTED', 'WITHDRAWN'].includes(share.application_status)
        ? 'REJECTED'
        : null
    if (nextStatus && nextStatus !== share.application_status) {
      await connection.execute(
        'UPDATE applications SET status = ? WHERE application_id = ?',
        [nextStatus, share.application_id],
      )
      await connection.execute(
        `INSERT INTO application_status_history
         (application_id, old_status, new_status, changed_by, change_reason)
         VALUES (?, ?, ?, ?, ?)`,
        [
          share.application_id,
          share.application_status,
          nextStatus,
          req.authUser.user_id,
          (notes || `Customer decision: ${decision}`).slice(0, 500),
        ],
      )
    }

    await connection.commit()
    return res.json({ message: `Candidate successfully marked as ${decision}.`, decision })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}
