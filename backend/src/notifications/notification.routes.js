import { Router } from 'express'
import { requireAuth } from '../auth/auth.middleware.js'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from './notification.controller.js'

const router = Router()

router.use(requireAuth)
router.get('/', listNotifications)
router.post('/read-all', markAllNotificationsRead)
router.post('/:notificationId/read', markNotificationRead)

export default router
