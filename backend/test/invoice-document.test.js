import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  buildInvoiceDocument,
  storeInvoiceDocument,
} from '../src/customer/invoice-document.js'

test('invoice document renders a downloadable PDF with invoice details', async () => {
  const document = buildInvoiceDocument({
    invoice_number: 'INV-TEST-1',
    invoice_date: '2026-03-01',
    due_date: '2026-03-31',
    status: 'ISSUED',
    company_name: 'Example Customer',
    agreement_number: 'AGR-TEST-1',
    order_number: 'SO-TEST-1',
    subtotal: 1200,
    discount_amount: 0,
    tax_total: 216,
    total_amount: 1416,
  }, [{
    description: 'Recruitment service',
    quantity: 1,
    unit_price: 1200,
    tax_rate: 18,
    taxable_value: 1200,
    tax_amount: 216,
    line_total: 1416,
  }])
  const chunks = []
  document.on('data', (chunk) => chunks.push(chunk))
  const ended = once(document, 'end')
  document.end()
  await ended

  const pdf = Buffer.concat(chunks)
  assert.equal(pdf.toString('ascii', 0, 5), '%PDF-')
  assert.ok(pdf.length > 1000)
})

test('stores generated invoice PDFs in the private invoice directory', async () => {
  const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'dts-private-storage-'))
  const originalStoragePath = process.env.PRIVATE_FILE_STORAGE_PATH
  process.env.PRIVATE_FILE_STORAGE_PATH = privateRoot

  try {
    const archived = await storeInvoiceDocument({
      invoice_number: 'INV-TEST-2',
      invoice_date: '2026-03-01',
      due_date: '2026-03-31',
      status: 'ISSUED',
      company_name: 'Example Customer',
      agreement_number: 'AGR-TEST-1',
      order_number: 'SO-TEST-1',
      subtotal: 1200,
      discount_amount: 0,
      tax_total: 216,
      total_amount: 1416,
    }, [{
      description: 'Recruitment service',
      quantity: 1,
      unit_price: 1200,
      tax_rate: 18,
      taxable_value: 1200,
      tax_amount: 216,
      line_total: 1416,
    }])

    assert.equal(path.dirname(archived.absolutePath), path.join(privateRoot, 'invoice'))
    assert.match(archived.fileName, /^INV-TEST-2-[a-f0-9-]+\.pdf$/)
    const pdf = await readFile(archived.absolutePath)
    assert.equal(pdf.toString('ascii', 0, 5), '%PDF-')
  } finally {
    if (originalStoragePath === undefined) {
      delete process.env.PRIVATE_FILE_STORAGE_PATH
    } else {
      process.env.PRIVATE_FILE_STORAGE_PATH = originalStoragePath
    }
    await rm(privateRoot, { recursive: true, force: true })
  }
})
