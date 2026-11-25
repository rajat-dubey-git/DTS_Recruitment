import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import {
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

router.get('/candidates', getCustomerSharedCandidates)
router.post('/candidates/:shareId/decision', submitCandidateDecision)
router.get('/invoices', listCustomerInvoices)
router.get('/invoices/:invoiceId/download', downloadCustomerInvoice)

export default router
