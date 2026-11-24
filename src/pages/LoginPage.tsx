import { useState } from 'react'
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../context/AuthContext'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const submit = async (values: FormValues) => {
    setError('')
    try {
      await login(values.email, values.password)
      navigate('/app/dashboard')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.')
    }
  }

  return (
    <div className="login-page">
      <div className="login-left">
        <Link to="/" className="back-link">
          <ArrowLeft size={16} /> Back to website
        </Link>
        <div className="login-message">
          <div className="brand-mark large">D</div>
          <div className="eyebrow light">DTS RECRUITMENT SUITE</div>
          <h1>Your next great hire starts with a better workflow.</h1>
          <p>One connected workspace for customers, recruiters and candidates.</p>
          <div className="login-proof">
            <ShieldCheck size={18} /> Secure role-based workspace
          </div>
        </div>
        <span className="login-copyright">© DTS Recruitment &amp; Staffing Platform</span>
      </div>

      <div className="login-right">
        <div className="login-form-wrap">
          <div className="mobile-brand brand">
            <div className="brand-mark">D</div>
            <div>
              <strong>DTS</strong>
              <small>Recruitment Suite</small>
            </div>
          </div>
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Sign in to your account</h2>
          <p className="form-intro">Enter your credentials to access your workspace.</p>

          <form onSubmit={handleSubmit(submit)} noValidate>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              placeholder="you@company.com"
              {...register('email')}
            />
            {errors.email && <small className="field-error">{errors.email.message}</small>}

            <div className="password-label">
              <label htmlFor="login-password">Password</label>
              <span>Need help? Contact your administrator.</span>
            </div>
            <div className="password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Enter your password"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && <small className="field-error">{errors.password.message}</small>}
            {error && <div className="form-error" role="alert">{error}</div>}

            <button className="btn btn-primary submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in to workspace'}
            </button>
          </form>

          <p className="secure-note">
            <ShieldCheck size={14} /> Your workspace is protected by role-based access.
          </p>
        </div>
      </div>
    </div>
  )
}
