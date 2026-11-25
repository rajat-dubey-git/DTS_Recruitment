import { Router } from 'express'
import { createInvitation } from './user.controller.js'
import {
  downloadAdminCandidateDocument,
  getAdminCandidateDetails,
  listAdminCandidates,
  reviewAdminCandidateDocument,
} from './candidate.controller.js'
import {
  getDashboardSummary,
  getRequirementCreationOptions,
  getRequirementAssignmentOptions,
  assignRequirementRecruiter,
  approveServiceOrder,
  convertRequirementIntakeRecord,
  createWorkspaceRecord,
  getRequirementIntakeOptions,
  listAgreements,
  listCustomers,
  listCustomerAddresses,
  listCustomerContacts,
  listJobProfiles,
  listRateCards,
  listRecruiters,
  listRequirements,
  listRequirementIntakes,
  listServiceOrders,
  listServiceTypes,
  listSkills,
  listUsers,
  sendCustomerRequirementIntake,
  updateWorkspaceRecord,
} from './workspace.controller.js'
import { requireAdmin, requireAuth } from '../auth/auth.middleware.js'

const router = Router()

router.use(requireAuth, requireAdmin)

router.get('/dashboard', getDashboardSummary)
router.get('/candidates', listAdminCandidates)
router.get('/candidates/:candidateId', getAdminCandidateDetails)
router.get('/candidates/:candidateId/documents/:documentId/download', downloadAdminCandidateDocument)
router.patch('/candidates/:candidateId/documents/:documentId/review', reviewAdminCandidateDocument)
router.get('/customers', listCustomers)
router.get('/customer-addresses', listCustomerAddresses)
router.get('/customer-contacts', listCustomerContacts)
router.get('/recruiters', listRecruiters)
router.get('/users', listUsers)
router.get('/skills', listSkills)
router.get('/service-types', listServiceTypes)
router.get('/job-profiles', listJobProfiles)
router.get('/agreements', listAgreements)
router.get('/rate-cards', listRateCards)
router.get('/service-orders', listServiceOrders)
router.get('/requirements', listRequirements)
router.get('/requirements/options', getRequirementCreationOptions)
router.get('/requirements/:requirementId/assignment-options', getRequirementAssignmentOptions)
router.post('/requirements/:requirementId/assign', assignRequirementRecruiter)
router.get('/requirement-intakes', listRequirementIntakes)
router.get('/requirement-intakes/:intakeId/options', getRequirementIntakeOptions)
router.post('/requirement-intakes/:intakeId/convert', convertRequirementIntakeRecord)
router.post('/service-orders/:serviceOrderId/approve', approveServiceOrder)
router.post('/users/invitations', createInvitation)
router.post('/customers/:customerId/requirement-intakes', sendCustomerRequirementIntake)
router.post('/:module', createWorkspaceRecord)
router.put('/:module/:id', updateWorkspaceRecord)

export default router