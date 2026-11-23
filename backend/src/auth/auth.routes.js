import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, logout, me } from './auth.controller.js'
import { requireAuth } from './auth.middleware.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Try again later.' },
})

router.post('/login', loginLimiter, login)
router.post('/logout', logout)
router.get('/me', requireAuth, me)

export default router