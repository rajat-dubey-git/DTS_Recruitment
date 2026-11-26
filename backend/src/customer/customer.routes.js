import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import {
  getCustomerRequirements,
  createCustomerRequirement,
  listCustomerJobProfiles,
  listCustomerRecruiters,
  listCustomerInterviews,
  getCustomerSharedCandidates,
  submitCandidateDecision,
  listCustomerInvoices,
  downloadCustomerInvoice,
} from './customer.controller.js'

const router = Router()

router.use(requireAuth)

// Middleware to ensure customer or admin access
router.use((req, res, next) => {
  if (req.authUser.role !== 'CUSTOMER' && req.authUser.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Customer access required.' })
  }
  next()
})

router.get('/requirements', getCustomerRequirements)
router.post('/requirements', createCustomerRequirement)
router.get('/job-profiles', listCustomerJobProfiles)
router.get('/recruiters', listCustomerRecruiters)
router.get('/interviews', listCustomerInterviews)
router.get('/candidates', getCustomerSharedCandidates)
router.post('/candidates/:shareId/decision', submitCandidateDecision)
router.get('/invoices', listCustomerInvoices)
router.get('/invoices/:invoiceId/download', downloadCustomerInvoice)

export default router
