import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import PDFDocument from 'pdfkit'
import { pool } from '../src/config/db.js'
import { createDraftPdf, fileMetadata } from '../src/agreements/document-storage.js'
import { signCustomerAgreement } from '../src/agreements/agreement.service.js'

test('customer electronic signature records consent and generates a signed PDF', async () => {
  const privateRoot = await mkdtemp(path.join(os.tmpdir(), 'dts-agreement-signature-'))
  const originalStoragePath = process.env.PRIVATE_FILE_STORAGE_PATH
  const originalExecute = pool.execute
  const originalGetConnection = pool.getConnection
  const agreementId = 41
  const versionId = 92
  const user = { user_id: 17, email: 'contact@example.com' }
  process.env.PRIVATE_FILE_STORAGE_PATH = privateRoot
  let draft
  try {
    draft = await createDraftPdf(agreementId, 1, () => {
      const document = new PDFDocument()
      document.text('Approved agreement terms')
      return document
    })
  } catch (error) {
    if (originalStoragePath === undefined) delete process.env.PRIVATE_FILE_STORAGE_PATH
    else process.env.PRIVATE_FILE_STORAGE_PATH = originalStoragePath
    await rm(privateRoot, { recursive: true, force: true })
    throw error
  }
  const version = {
    agreement_version_id: versionId,
    agreement_id: agreementId,
    version_number: 1,
    status: 'PENDING_CUSTOMER_SIGNATURE',
    draft_document_path: draft.storageKey,
    draft_sha256: draft.sha256,
    signed_document_path: null,
    signed_uploaded_at: null,
    customer_id: 8,
    agreement_number: 'DTS-AGR-TEST',
    title: 'Recruitment services',
    effective_date: null,
    expiry_date: null,
    company_name: 'Example Customer',
  }
  const lines = [{
    agreement_service_line_id: 1,
    service_type_id: 3,
    service_name: 'Recruitment',
    employment_model: 'DTS_PAYROLL',
    profile_name: 'Engineer',
    employment_schedule: 'FULL_TIME',
    hours_per_week: null,
    headcount: 1,
    fee_type: 'PERCENTAGE',
    fee_basis: 'ANNUAL_CTC',
    fee_value: 10,
    currency: 'INR',
    scope_description: null,
  }]
  const recordedEvents = []
  let committed = false
  let signedUpdate
  const connection = {
    async beginTransaction() {},
    async commit() { committed = true },
    async rollback() {},
    release() {},
    async execute(sql, params = []) {
      if (sql.includes('FOR UPDATE')) return [[version], []]
      if (sql.includes('FROM customer_contacts cc')) return [[{ customer_id: 8 }], []]
      if (sql.includes('SELECT l.agreement_service_line_id')) return [lines, []]
      if (sql.includes('UPDATE agreement_versions')) {
        signedUpdate = params
        Object.assign(version, {
          status: params[0],
          signed_document_path: params[1],
          signed_sha256: params[2],
          customer_signed_by: params[3],
          customer_signature_name: params[4],
          customer_signature_method: 'TYPED_NAME',
          signed_uploaded_at: new Date().toISOString(),
        })
        return [{ affectedRows: 1 }, []]
      }
      if (sql.includes('INSERT INTO agreement_events')) {
        recordedEvents.push({
          action_code: 'ELECTRONIC_SIGNATURE_CAPTURED',
          customer_visible_comment: params[5],
          occurred_at: new Date().toISOString(),
        })
        return [{ affectedRows: 1 }, []]
      }
      if (sql.includes("WHERE role = 'ADMIN'")) return [[], []]
      if (sql.includes('FROM agreements a')) {
        return [[{
          agreement_id: agreementId,
          agreement_number: 'DTS-AGR-TEST',
          customer_id: 8,
          company_name: 'Example Customer',
          title: 'Recruitment services',
          status: 'PENDING_SIGNATURE',
          effective_date: null,
          expiry_date: null,
          signed_date: null,
        }], []]
      }
      if (sql.includes('FROM agreement_versions')) return [[version], []]
      if (sql.includes('FROM agreement_events')) return [recordedEvents, []]
      assert.fail(`Unexpected agreement query: ${sql}`)
    },
  }

  process.env.PRIVATE_FILE_STORAGE_PATH = privateRoot
  pool.getConnection = async () => connection
  pool.execute = async (sql) => {
    if (sql.includes('FROM customer_contacts cc')) return [[{ customer_id: 8 }], []]
    if (sql.includes('SELECT customer_id FROM agreements')) return [[{ customer_id: 8 }], []]
    assert.fail(`Unexpected pool query: ${sql}`)
  }

  try {
    const result = await signCustomerAgreement(user, agreementId, versionId, {
      fullName: 'Alex Customer',
      acceptedElectronicSignature: true,
    })

    assert.equal(committed, true)
    assert.equal(result.version.status, 'SIGNED_PENDING_ADMIN_ACTIVATION')
    assert.equal(result.version.canDownloadSignedCopy, true)
    assert.equal(result.version.customerSignatureName, undefined)
    assert.equal(signedUpdate[3], user.user_id)
    assert.equal(signedUpdate[4], 'Alex Customer')
    assert.notEqual(signedUpdate[1], draft.storageKey)
    assert.equal(recordedEvents[0].action_code, 'ELECTRONIC_SIGNATURE_CAPTURED')
    assert.match(recordedEvents[0].customer_visible_comment, /consent recorded/)

    const signedPath = path.join(privateRoot, signedUpdate[1])
    const signedPdf = await readFile(signedPath)
    assert.equal(signedPdf.toString('ascii', 0, 5), '%PDF-')
    assert.equal((await fileMetadata(signedPath)).sha256, signedUpdate[2])
  } finally {
    pool.execute = originalExecute
    pool.getConnection = originalGetConnection
    if (originalStoragePath === undefined) delete process.env.PRIVATE_FILE_STORAGE_PATH
    else process.env.PRIVATE_FILE_STORAGE_PATH = originalStoragePath
    await rm(privateRoot, { recursive: true, force: true })
  }
})

test('customer cannot sign without electronic-signature consent or a name', async () => {
  await assert.rejects(
    signCustomerAgreement(
      { user_id: 17, email: 'contact@example.com' },
      41,
      92,
      { fullName: 'Alex Customer', acceptedElectronicSignature: false },
    ),
    { message: 'Confirm that you agree to sign this agreement electronically.' },
  )

  await assert.rejects(
    signCustomerAgreement(
      { user_id: 17, email: 'contact@example.com' },
      41,
      92,
      { fullName: '   ', acceptedElectronicSignature: true },
    ),
    { message: 'Enter your full legal name to sign this agreement.' },
  )
})
