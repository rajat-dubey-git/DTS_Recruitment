import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import {
  getRecruiterRequirements,
  searchCandidates,
  getRecruiterCandidateDetails,
  streamRecruiterCandidateResume,
  submitCandidateForRequirement,
  createSecureResumeShare,
  getRequirementSubmissions,
  recordCandidateConsent,
  getRecruiterApplications,
  getRecruiterInterviews,
  scheduleRecruiterInterview,
  updateRecruiterInterviewStatus,
  updateRecruiterApplicationStatus,
} from './recruiter.controller.js'
import { createRecruiterOffer } from '../offers/offer.controller.js'
import { offerPdfUpload } from '../offers/offer.upload.js'

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
router.get('/applications', getRecruiterApplications)
router.patch('/applications/:applicationId/status', updateRecruiterApplicationStatus)
router.post('/selections/:selectionId/offers', offerPdfUpload, createRecruiterOffer)
router.get('/interviews', getRecruiterInterviews)
router.post('/interviews', scheduleRecruiterInterview)
router.patch('/interviews/:interviewId/status', updateRecruiterInterviewStatus)
router.get('/candidates', searchCandidates)
router.get('/candidates/:candidateId', getRecruiterCandidateDetails)
router.get('/candidates/:candidateId/resume', streamRecruiterCandidateResume)
router.post('/consents', recordCandidateConsent)
router.post('/submissions', submitCandidateForRequirement)
router.post('/resume-shares', createSecureResumeShare)

export default router
