import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import multer from 'multer'
import { requireAdmin, requireAuth } from '../auth/auth.middleware.js'
import {
  activateAdminAgreement,
  createCustomerAgreementRequest,
  downloadAdminSignedCopy,
  downloadCustomerDraft,
  downloadCustomerSignedCopy,
  readAdminAgreement,
  readAdminAgreements,
  readCustomerAgreement,
  readCustomerAgreements,
  readCustomerCatalog,
  requestCustomerChanges,
  reviewAdminAgreement,
  updateAdminAgreementTerms,
  uploadCustomerSignedCopy,
} from './agreement.controller.js'
import { ensurePrivateStorageDirectory } from './document-storage.js'

const router = Router()
const maximumPdfSize = 50 * 1024 * 1024

function requireCustomer(req, res, next) {
  if (req.authUser?.role !== 'CUSTOMER') {
    return res.status(403).json({ message: 'Customer access is required.' })
  }
  return next()
}

function uploadError(message) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

const signedPdfUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      ensurePrivateStorageDirectory('tmp').then(
        (directory) => callback(null, directory),
        (error) => callback(error),
      )
    },
    filename(_req, _file, callback) {
      callback(null, `${randomUUID()}.upload`)
    },
  }),
  limits: { fileSize: maximumPdfSize, files: 1 },
  fileFilter(_req, file, callback) {
    if (file.mimetype !== 'application/pdf' || !/\.pdf$/i.test(file.originalname)) {
      return callback(uploadError('Upload a PDF file only.'))
    }
    return callback(null, true)
  },
})

router.use(requireAuth)

router.get('/customer/catalog', requireCustomer, readCustomerCatalog)
router.get('/customer', requireCustomer, readCustomerAgreements)
router.post('/customer', requireCustomer, createCustomerAgreementRequest)
router.get('/customer/:agreementId', requireCustomer, readCustomerAgreement)
router.get(
  '/customer/:agreementId/versions/:versionId/draft.pdf',
  requireCustomer,
  downloadCustomerDraft,
)
router.get(
  '/customer/:agreementId/versions/:versionId/signed.pdf',
  requireCustomer,
  downloadCustomerSignedCopy,
)
router.post(
  '/customer/:agreementId/versions/:versionId/signed-copy',
  requireCustomer,
  signedPdfUpload.single('signedPdf'),
  uploadCustomerSignedCopy,
)
router.post(
  '/customer/:agreementId/versions/:versionId/request-changes',
  requireCustomer,
  requestCustomerChanges,
)

router.get('/admin', requireAdmin, readAdminAgreements)
router.get('/admin/:agreementId', requireAdmin, readAdminAgreement)
router.put(
  '/admin/:agreementId/versions/:versionId/terms',
  requireAdmin,
  updateAdminAgreementTerms,
)
router.post(
  '/admin/:agreementId/versions/:versionId/review',
  requireAdmin,
  reviewAdminAgreement,
)
router.get(
  '/admin/:agreementId/versions/:versionId/signed.pdf',
  requireAdmin,
  downloadAdminSignedCopy,
)
router.post(
  '/admin/:agreementId/versions/:versionId/activate',
  requireAdmin,
  activateAdminAgreement,
)

export default router
