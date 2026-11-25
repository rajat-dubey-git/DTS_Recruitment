import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import { authApi } from '../api/auth'
import { Eye, EyeOff } from 'lucide-react'

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Z]/, 'Add at least one uppercase letter.')
    .regex(/[a-z]/, 'Add at least one lowercase letter.')
    .regex(/[0-9]/, 'Add at least one number.')
    .regex(/[^A-Za-z0-9]/, 'Add at least one special character.')
    .refine((value) => new TextEncoder().encode(value).length <= 72, 'Password must be 72 UTF-8 bytes or fewer.'),
  confirmPassword: z.string(),
}).refine((values) => values.password === values.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match.',
})

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const parsed = passwordSchema.safeParse({ password, confirmPassword })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your password and try again.')
      return
    }

    setSubmitting(true)
    try {
      await authApi.acceptInvitation(token, password)
      setSuccess(true)
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Unable to set your password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <Link to="/" className="back-link">DTS Recruitment Suite</Link>
        <div className="login-message">
          <div className="brand-mark large">D</div>
          <div className="eyebrow light">ACCOUNT SECURITY</div>
          <h1>Set up your secure workspace access.</h1>
          <p>Your password is stored as a one-way hash and is never shared with the browser.</p>
        </div>
        <span className="login-copyright">© DTS Recruitment &amp; Staffing Platform</span>
      </div>
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="eyebrow">ACCOUNT SETUP</div>
          <h2>Set your password</h2>
          {success ? (
            <>
              <p className="form-intro">Your account is active. Sign in with your email and new password.</p>
              <Link className="btn btn-primary submit-btn" to="/login">Continue to sign in</Link>
            </>
          ) : !token ? (
            <>
              <p className="form-error" role="alert">This invitation link is missing its token. Ask your administrator for a new invitation.</p>
              <Link to="/login">Return to sign in</Link>
            </>
          ) : (
            <>
              <p className="form-intro">Use 8+ characters with uppercase, lowercase, number and special character.</p>
              <form onSubmit={(event) => void submit(event)} noValidate>
                <label htmlFor="new-password">New password</label>
                <div className="password-wrap">
                  <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <label htmlFor="confirm-password">Confirm password</label>
                <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
                {error && <div className="form-error" role="alert">{error}</div>}
                <button className="btn btn-primary submit-btn" disabled={submitting}>{submitting ? 'Saving…' : 'Set password'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
