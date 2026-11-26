import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import PDFDocument from 'pdfkit'
import {
  ensurePrivateStorageDirectory,
  removePrivateFile,
} from '../agreements/document-storage.js'

function amount(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed)
    ? parsed.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00'
}

function dateLabel(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-IN')
}

function drawTableHeader(document, columns, widths, startX, y) {
  document.rect(startX, y, widths.reduce((total, width) => total + width, 0), 26)
    .fill('#eff6ff')
  let x = startX
  columns.forEach((column, index) => {
    document.font('Helvetica-Bold').fontSize(7).fillColor('#334155')
      .text(column, x + 5, y + 8, { width: widths[index] - 10, align: index === 0 ? 'left' : 'right' })
    x += widths[index]
  })
  return y + 26
}

export function buildInvoiceDocument(invoice, items) {
  const document = new PDFDocument({ size: 'A4', margin: 42 })
  const margin = 42
  const pageWidth = document.page.width - margin * 2
  const widths = [0.34, 0.07, 0.13, 0.09, 0.13, 0.10, 0.14].map((share) => pageWidth * share)
  const columns = ['Description', 'Qty', 'Unit price', 'Tax %', 'Taxable', 'Tax', 'Total']

  document.rect(0, 0, document.page.width, 118).fill('#172b4d')
  document.font('Helvetica-Bold').fontSize(18).fillColor('#ffffff')
    .text('DTS RECRUITMENT', margin, 37, { characterSpacing: 0.8 })
  document.font('Helvetica').fontSize(9).fillColor('#cbd5e1')
    .text('Recruitment services', margin, 65)
  document.font('Helvetica-Bold').fontSize(20).fillColor('#ffffff')
    .text('INVOICE', document.page.width - margin - 150, 40, { width: 150, align: 'right' })
  document.font('Helvetica').fontSize(9).fillColor('#cbd5e1')
    .text(String(invoice.invoice_number ?? ''), document.page.width - margin - 210, 70, { width: 210, align: 'right' })

  const detailsTop = 142
  document.font('Helvetica-Bold').fontSize(8).fillColor('#64748b').text('BILL TO', margin, detailsTop)
  document.font('Helvetica-Bold').fontSize(12).fillColor('#172b4d')
    .text(String(invoice.company_name || 'Customer'), margin, detailsTop + 17, { width: pageWidth * 0.55 })
  document.font('Helvetica').fontSize(9).fillColor('#475569')
    .text(`Agreement: ${invoice.agreement_number || '—'}`, margin, detailsTop + 39)
    .text(`Service order: ${invoice.order_number || '—'}`, margin, detailsTop + 54)

  const metaX = margin + pageWidth * 0.62
  const metaWidth = pageWidth * 0.38
  const metadata = [
    ['Invoice date', dateLabel(invoice.invoice_date)],
    ['Due date', dateLabel(invoice.due_date)],
    ['Status', String(invoice.status || '—').replace(/_/g, ' ')],
  ]
  metadata.forEach(([label, value], index) => {
    const y = detailsTop + index * 23
    document.font('Helvetica').fontSize(8).fillColor('#64748b').text(label, metaX, y, { width: metaWidth * 0.48 })
    document.font('Helvetica-Bold').fontSize(8).fillColor('#172b4d')
      .text(value, metaX + metaWidth * 0.48, y, { width: metaWidth * 0.52, align: 'right' })
  })

  if (invoice.service_period_start || invoice.service_period_end) {
    document.font('Helvetica').fontSize(8).fillColor('#64748b')
      .text(`Service period: ${dateLabel(invoice.service_period_start)} to ${dateLabel(invoice.service_period_end)}`, margin, 223)
  }

  let y = drawTableHeader(document, columns, widths, margin, 245)
  for (const [index, item] of items.entries()) {
    const description = String(item.description || 'Service')
    document.font('Helvetica').fontSize(8)
    const descriptionHeight = document.heightOfString(description, { width: widths[0] - 12 })
    const rowHeight = Math.max(32, descriptionHeight + 12)
    if (y + rowHeight > document.page.height - 125) {
      document.addPage()
      y = drawTableHeader(document, columns, widths, margin, margin)
    }

    if (index % 2 === 1) {
      document.rect(margin, y, pageWidth, rowHeight).fill('#f8fafc')
    }
    let x = margin
    const values = [
      description,
      String(item.quantity ?? ''),
      amount(item.unit_price),
      `${amount(item.tax_rate).replace(/\.00$/, '')}%`,
      amount(item.taxable_value),
      amount(item.tax_amount),
      amount(item.line_total),
    ]
    values.forEach((value, columnIndex) => {
      document.font('Helvetica').fontSize(8).fillColor('#334155')
        .text(value, x + 5, y + 8, {
          width: widths[columnIndex] - 10,
          height: rowHeight - 8,
          align: columnIndex === 0 ? 'left' : 'right',
          ellipsis: true,
        })
      x += widths[columnIndex]
    })
    document.moveTo(margin, y + rowHeight).lineTo(margin + pageWidth, y + rowHeight)
      .strokeColor('#e2e8f0').lineWidth(0.5).stroke()
    y += rowHeight
  }

  const summaryTop = y + 22
  if (summaryTop > document.page.height - 130) {
    document.addPage()
    y = margin
  }
  const summaryY = summaryTop > document.page.height - 130 ? margin : summaryTop
  const summaryX = margin + pageWidth * 0.58
  const summaryWidth = pageWidth * 0.42
  const summaryRows = [
    ['Subtotal', amount(invoice.subtotal)],
    ['Discount', amount(invoice.discount_amount)],
    ['Tax', amount(invoice.tax_total)],
  ]
  summaryRows.forEach(([label, value], index) => {
    const rowY = summaryY + index * 20
    document.font('Helvetica').fontSize(9).fillColor('#64748b').text(label, summaryX, rowY)
    document.font('Helvetica').fontSize(9).fillColor('#334155')
      .text(value, summaryX, rowY, { width: summaryWidth, align: 'right' })
  })
  const totalY = summaryY + 68
  document.roundedRect(summaryX - 10, totalY - 5, summaryWidth + 10, 34, 5).fill('#eff6ff')
  document.font('Helvetica-Bold').fontSize(10).fillColor('#172b4d').text('TOTAL DUE', summaryX, totalY + 5)
  document.font('Helvetica-Bold').fontSize(12).fillColor('#1d4ed8')
    .text(amount(invoice.total_amount), summaryX, totalY + 4, { width: summaryWidth, align: 'right' })

  document.font('Helvetica').fontSize(7).fillColor('#94a3b8')
    .text('Amounts are shown as recorded in the invoice. Please contact your DTS representative with billing questions.', margin, document.page.height - 49, {
      width: pageWidth,
      align: 'center',
    })
  return document
}

export async function storeInvoiceDocument(invoice, items) {
  const directory = await ensurePrivateStorageDirectory('invoice')
  const invoiceNumber = String(invoice.invoice_number ?? 'invoice')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${invoiceNumber}-${randomUUID()}.pdf`
  const absolutePath = path.join(directory, fileName)
  const document = buildInvoiceDocument(invoice, items)
  const output = createWriteStream(absolutePath, { flags: 'wx' })
  const writing = pipeline(document, output)
  document.end()

  try {
    await writing
    return { absolutePath, fileName }
  } catch (error) {
    await removePrivateFile(absolutePath)
    throw error
  }
}
