import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import authRoutes from './auth/auth.routes.js'
import adminRoutes from './admin/admin.routes.js'
import invitationRoutes from './auth/invitation.routes.js'
import requirementIntakeRoutes from './public/requirement-intake.routes.js'
import dashboardRoutes from './dashboard/dashboard.routes.js'
import agreementRoutes from './agreements/agreement.routes.js'

const app = express()
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.use(helmet())
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Origin is not allowed by CORS.'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/agreements', agreementRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/auth/invitations', invitationRoutes)
app.use('/api/public', requirementIntakeRoutes)

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found.' })
})

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error)
  const databaseErrors = {
    ER_DUP_ENTRY: { status: 409, message: 'A record with the same unique value already exists.' },
    ER_NO_REFERENCED_ROW_2: { status: 409, message: 'A referenced record does not exist.' },
    ER_ROW_IS_REFERENCED_2: { status: 409, message: 'This record is still referenced by another record.' },
    ER_BAD_NULL_ERROR: { status: 400, message: 'A required field cannot be empty.' },
    ER_NO_DEFAULT_FOR_FIELD: { status: 400, message: 'A required field is missing.' },
    ER_DATA_TOO_LONG: { status: 400, message: 'A value exceeds the maximum field length.' },
    ER_TRUNCATED_WRONG_VALUE: { status: 400, message: 'A value has an invalid format.' },
    ER_WARN_DATA_OUT_OF_RANGE: { status: 400, message: 'A numeric value is outside the allowed range.' },
    ER_CHECK_CONSTRAINT_VIOLATED: { status: 400, message: 'A database validation rule was not satisfied.' },
  }
  const databaseError = databaseErrors[error.code]
  const isMulterError = error.name === 'MulterError'
  const status = error.statusCode
    ?? (isMulterError ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : databaseError?.status)
    ?? 500

  if (status >= 500) console.error(error)
  res.status(status).json({
    message: error.statusCode
      ? error.message
      : isMulterError
        ? (error.code === 'LIMIT_FILE_SIZE' ? 'PDF must not exceed 50 MB.' : 'Unable to process the uploaded file.')
      : databaseError?.message ?? 'Internal server error.',
  })
})

export default app