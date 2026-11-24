import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import {
  getRecruiterRequirements,
  searchCandidates,
  submitCandidateForRequirement,
  createSecureResumeShare,
  getRequirementSubmissions,
  recordCandidateConsent,
} from './recruiter.controller.js'

const router = Router()

// All routes require authenticated user
router.use(requireAuth)

// Middleware to ensure recruiter or admin access
router.use((req, res, next) => {
  if (req.authUser.role !== 'RECRUITER' && req.authUser.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Recruiter or Admin access required.' })
  }
  next()
})

router.get('/requirements', getRecruiterRequirements)
router.get('/requirements/:requirementId/submissions', getRequirementSubmissions)
router.get('/candidates', searchCandidates)
router.post('/consents', recordCandidateConsent)
router.post('/submissions', submitCandidateForRequirement)
router.post('/resume-shares', createSecureResumeShare)

export default router
