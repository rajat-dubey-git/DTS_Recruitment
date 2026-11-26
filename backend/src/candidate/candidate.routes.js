import { Router } from 'express'
import { requireAuth, requireCandidate } from '../auth/auth.middleware.js'

import {
  getMyDashboard,
  getMyProfile,
  listCandidateSkillOptions,
  updateMyProfile,
  updateMyEducation,
  updateMyExperience,
  updateMySkills,
  getOpenRequirements,
  applyForRequirement,
  withdrawApplication,
  getMyApplications,
  getMyApplicationTimeline,
  uploadMyResume,
  downloadMyResume,
  getMyResume,
} from './candidate.controller.js'

import { uploadCandidateResume } from './candidate.upload.js'
import {
  downloadMyOffer,
  listMyOffers,
  respondToMyOffer,
} from '../offers/offer.controller.js'

const router = Router()

router.use(requireAuth, requireCandidate)

// Dashboard and profile
router.get('/dashboard', getMyDashboard)
router.get('/profile', getMyProfile)
router.put('/profile', updateMyProfile)
router.get('/skills', listCandidateSkillOptions)

// Education, experience and skills
router.put('/education', updateMyEducation)
router.put('/experience', updateMyExperience)
router.put('/skills', updateMySkills)

// Open jobs and applications
router.get('/requirements', getOpenRequirements)
router.post('/requirements/:requirementId/apply', applyForRequirement)

router.get('/applications', getMyApplications)
router.get('/applications/:applicationId/timeline', getMyApplicationTimeline)
router.post('/applications/:applicationId/withdraw', withdrawApplication)
router.get('/offers', listMyOffers)
router.get('/offers/:offerId/download', downloadMyOffer)
router.post('/offers/:offerId/respond', respondToMyOffer)

// Private resume document
router.post('/resume', uploadCandidateResume, uploadMyResume)
router.get('/resume', getMyResume)
router.get('/resume/download', downloadMyResume)

export default router