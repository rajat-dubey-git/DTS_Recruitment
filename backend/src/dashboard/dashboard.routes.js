import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import { readDashboardAnalytics } from './dashboard.controller.js'

const router = Router()

router.get('/analytics', requireAuth, readDashboardAnalytics)

export default router
