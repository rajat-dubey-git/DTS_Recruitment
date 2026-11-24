import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { completeInvitation } from '../admin/user.controller.js'

const router = Router()

const invitationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many invitation attempts. Try again later.' },
})

router.post('/accept', invitationLimiter, completeInvitation)

export default router