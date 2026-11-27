import { Router } from 'express'
import { requireAdmin, requireAuth } from '../auth/auth.middleware.js'
import {
  activateAdminAgreement,
  createCustomerAgreementRequest,
  downloadAdminAgreementSample,
  downloadAdminSignedCopy,
  downloadAdminAgreement,
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
  provisionAdminAgreementOrders,
  signCustomerAgreement,
} from './agreement.controller.js'

const router = Router()

function requireCustomer(req, res, next) {
  if (req.authUser?.role !== 'CUSTOMER') {
    return res.status(403).json({ message: 'Customer access is required.' })
  }
  return next()
}

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
  '/customer/:agreementId/versions/:versionId/sign',
  requireCustomer,
  signCustomerAgreement,
)
router.post(
  '/customer/:agreementId/versions/:versionId/request-changes',
  requireCustomer,
  requestCustomerChanges,
)

router.get('/admin', requireAdmin, readAdminAgreements)
router.get('/admin/sample.pdf', requireAdmin, downloadAdminAgreementSample)
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
  '/admin/:agreementId/versions/:versionId/draft.pdf',
  requireAdmin,
  downloadAdminAgreement,
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
router.post(
  '/admin/:agreementId/provision-orders',
  requireAdmin,
  provisionAdminAgreementOrders,
)

export default router
