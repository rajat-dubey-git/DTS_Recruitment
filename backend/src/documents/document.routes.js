import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import {
  streamResumeDocument,
} from './document.controller.js'

const router = Router()

router.use(requireAuth)

// View/Download resume by shareId (enforces 24-hr expiry and permission scoping)
router.get('/resumes/:shareId', streamResumeDocument)

export default router
