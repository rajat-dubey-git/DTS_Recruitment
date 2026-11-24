import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import {
  readRequirementIntake,
  submitRequirementIntakeForm,
} from './requirement-intake.controller.js'

const router = Router()
const intakeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many form requests. Try again later.' },
})

router.get('/requirement-intakes/:token', intakeLimiter, readRequirementIntake)
router.post('/requirement-intakes/:token', intakeLimiter, submitRequirementIntakeForm)

export default router
