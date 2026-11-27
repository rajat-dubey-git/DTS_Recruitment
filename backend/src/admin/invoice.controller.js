import { pool } from '../config/db.js'
import { calculateInvoiceTotals } from './invoice-calculation.js'
import { notifyActiveCustomerContacts } from '../notifications/notification.service.js'

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function requiredText(value, label, maxLength) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > maxLength) {
    throw httpError(400, `${label} is required and must be ${maxLength} characters or fewer.`)
  }
  return text
}

function positiveId(value, label) {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) throw httpError(400, `Select a valid ${label}.`)
  return id
}

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, `${label} must be a valid date.`)
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw httpError(400, `${label} must be a valid date.`)
  }
  return value
}

export async function listAdminInvoices(_req, res, next) {
  try {
    const [invoices] = await pool.execute(
      `SELECT i.invoice_id, i.invoice_number, i.invoice_type, i.invoice_date, i.due_date,
              i.subtotal, i.discount_amount, i.tax_total, i.total_amount, i.status,
              so.order_number, a.agreement_number, c.company_name,
              COUNT(ii.item_id) AS item_count
       FROM invoices i
       INNER JOIN service_orders so ON so.service_order_id = i.service_order_id
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       INNER JOIN customers c ON c.customer_id = a.customer_id
       LEFT JOIN invoice_items ii ON ii.invoice_id = i.invoice_id
       GROUP BY i.invoice_id, i.invoice_number, i.invoice_type, i.invoice_date, i.due_date,
                i.subtotal, i.discount_amount, i.tax_total, i.total_amount, i.status,
                so.order_number, a.agreement_number, c.company_name
       ORDER BY i.invoice_id DESC
       LIMIT 250`,
    )
    return res.json({ invoices })
  } catch (error) {
    return next(error)
  }
}

export async function listInvoiceableSelections(_req, res, next) {
  try {
    const [selections] = await pool.execute(
      `SELECT p.placement_id, s.selection_id, s.application_id, s.selected_at,
              a.application_number, r.requirement_number, r.job_title,
              so.service_order_id, so.order_number, so.title AS service_order_title,
              agreement.agreement_number,
              st.service_name, st.employment_model,
              c.customer_id, c.company_name, c.payment_terms_days,
              CONCAT_WS(' ', candidate.first_name, candidate.last_name) AS candidate_name
       FROM placements p
       INNER JOIN selections s ON s.selection_id = p.selection_id
       INNER JOIN applications a ON a.application_id = s.application_id
       INNER JOIN candidates candidate ON candidate.candidate_id = a.candidate_id
       INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN service_types st ON st.service_type_id = so.service_type_id
       INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
       INNER JOIN customers c ON c.customer_id = agreement.customer_id
       WHERE a.status = 'SELECTED'
         AND p.outcome = 'PENDING'
         AND NOT EXISTS (
           SELECT 1
           FROM invoice_items existing_item
           INNER JOIN invoices existing_invoice ON existing_invoice.invoice_id = existing_item.invoice_id
           WHERE existing_item.placement_id = p.placement_id
             AND existing_invoice.invoice_type = 'PLACEMENT_FEE'
             AND existing_invoice.status <> 'CANCELLED'
         )
       ORDER BY s.selected_at DESC, s.selection_id DESC
       LIMIT 250`,
    )
    return res.json({ selections })
  } catch (error) {
    return next(error)
  }
}

export async function createAdminInvoice(req, res, next) {
  const connection = await pool.getConnection()
  try {
    const invoiceNumber = requiredText(req.body?.invoiceNumber, 'Invoice number', 60)
    const placementId = positiveId(req.body?.placementId, 'selected candidate')
    const invoiceDate = validDate(req.body?.invoiceDate, 'Invoice date')
    const dueDate = validDate(req.body?.dueDate, 'Due date')
    if (dueDate < invoiceDate) throw httpError(400, 'Due date cannot be before the invoice date.')
    const description = requiredText(req.body?.description, 'Line description', 300)
    const totals = calculateInvoiceTotals(req.body?.unitPrice, req.body?.taxRate)

    await connection.beginTransaction()
    const [rows] = await connection.execute(
      `SELECT p.placement_id, so.service_order_id
       FROM placements p
       INNER JOIN selections s ON s.selection_id = p.selection_id
       INNER JOIN applications a ON a.application_id = s.application_id
       INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       WHERE p.placement_id = ? AND p.outcome = 'PENDING' AND a.status = 'SELECTED'
       LIMIT 1
       FOR UPDATE`,
      [placementId],
    )
    if (!rows[0]) throw httpError(409, 'This candidate is no longer eligible for a placement invoice.')

    const [existingItems] = await connection.execute(
      `SELECT ii.item_id
       FROM invoice_items ii
       INNER JOIN invoices i ON i.invoice_id = ii.invoice_id
       WHERE ii.placement_id = ? AND i.invoice_type = 'PLACEMENT_FEE'
         AND i.status <> 'CANCELLED'
       LIMIT 1`,
      [placementId],
    )
    if (existingItems[0]) {
      throw httpError(409, 'A non-cancelled placement-fee invoice already exists for this selection.')
    }

    const [invoiceResult] = await connection.execute(
      `INSERT INTO invoices
        (invoice_number, service_order_id, invoice_type, invoice_date, due_date,
         subtotal, discount_amount, tax_total, total_amount, status, created_by)
       VALUES (?, ?, 'PLACEMENT_FEE', ?, ?, ?, 0, ?, ?, 'DRAFT', ?)`,
      [
        invoiceNumber,
        rows[0].service_order_id,
        invoiceDate,
        dueDate,
        totals.subtotal,
        totals.taxTotal,
        totals.total,
        req.authUser.user_id,
      ],
    )
    await connection.execute(
      `INSERT INTO invoice_items
        (invoice_id, placement_id, description, quantity, unit_price, tax_rate)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [
        invoiceResult.insertId,
        placementId,
        description,
        totals.subtotal,
        Number(req.body.taxRate).toFixed(2),
      ],
    )
    await connection.commit()
    return res.status(201).json({
      invoiceId: Number(invoiceResult.insertId),
      message: 'Draft placement invoice created. Review and issue it when ready.',
    })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function issueAdminInvoice(req, res, next) {
  const connection = await pool.getConnection()
  try {
    const invoiceId = positiveId(req.params.invoiceId, 'invoice')
    await connection.beginTransaction()
    const [invoices] = await connection.execute(
      `SELECT i.status, i.invoice_number, a.customer_id
       FROM invoices i
       INNER JOIN service_orders so ON so.service_order_id = i.service_order_id
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE i.invoice_id = ?
       LIMIT 1
       FOR UPDATE`,
      [invoiceId],
    )
    if (!invoices[0]) throw httpError(404, 'Invoice not found.')
    if (invoices[0].status !== 'DRAFT') throw httpError(409, 'Only draft invoices can be issued.')
    const [items] = await connection.execute(
      'SELECT item_id FROM invoice_items WHERE invoice_id = ? LIMIT 1',
      [invoiceId],
    )
    if (!items[0]) throw httpError(409, 'Add an invoice line before issuing this invoice.')
    await connection.execute(
      `UPDATE invoices
       SET status = 'ISSUED'
       WHERE invoice_id = ? AND status = 'DRAFT'`,
      [invoiceId],
    )
    await notifyActiveCustomerContacts(connection, Number(invoices[0].customer_id), {
      type: 'INVOICE_ISSUED',
      title: `Invoice issued: ${invoices[0].invoice_number}`,
      message: 'A new invoice is available in your customer portal.',
      targetUrl: '/app/invoices',
    })
    await connection.commit()
    return res.json({ message: 'Invoice issued to the customer.' })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}
