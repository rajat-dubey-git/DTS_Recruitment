import assert from 'node:assert/strict'
import test from 'node:test'
import { createAgreementSampleDocument } from '../src/agreements/agreement.service.js'

test('renders the agreement sample as a PDF using the draft document renderer', async () => {
  const document = createAgreementSampleDocument()
  const chunks = []
  const output = new Promise((resolve, reject) => {
    document.on('data', (chunk) => chunks.push(chunk))
    document.once('error', reject)
    document.once('end', () => resolve(Buffer.concat(chunks)))
  })

  document.end()
  const pdf = await output

  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-')
  assert.ok(pdf.length > 500)
})
