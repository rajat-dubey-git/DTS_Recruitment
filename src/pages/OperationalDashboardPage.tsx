import { useEffect, useState } from 'react'
import { BriefcaseBusiness, Building2, ClipboardList, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { workspaceApi } from '../api/workspace'
import type { DashboardAnalytics } from '../api/workspace'
import { useAuth } from '../context/AuthContext'

const metricIcons: Record<string, { icon: LucideIcon; tone: string }> = {
  customers: { icon: Building2, tone: 'blue' },
  activeRecruiters: { icon: Users, tone: 'violet' },
  activeJobProfiles: { icon: BriefcaseBusiness, tone: 'green' },
  openRequirements: { icon: ClipboardList, tone: 'orange' },
  totalRequirements: { icon: ClipboardList, tone: 'blue' },
  activeRequirements: { icon: ClipboardList, tone: 'green' },
  submittedRequests: { icon: ClipboardList, tone: 'orange' },
  submittedCandidates: { icon: Users, tone: 'violet' },
  upcomingInterviews: { icon: ClipboardList, tone: 'orange' },
  availableCandidates: { icon: Users, tone: 'violet' },
  placements: { icon: BriefcaseBusiness, tone: 'green' },
  candidatesInPipeline: { icon: Users, tone: 'blue' },
  applications: { icon: ClipboardList, tone: 'blue' },
  interviews: { icon: ClipboardList, tone: 'orange' },
  selections: { icon: ShieldCheck, tone: 'green' },
}

export default function OperationalDashboardPage() {
  const { user } = useAuth()
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [refreshRequest, setRefreshRequest] = useState(0)

  useEffect(() => {
    if (!user) return

    let active = true
    let requestInFlight = false

    const refresh = async (silent: boolean) => {
      if (!active || requestInFlight || document.visibilityState === 'hidden') return
      requestInFlight = true
      if (!silent) setLoading(true)
      setError('')
      try {
        const result = await workspaceApi.dashboard()
        if (active) {
          setAnalytics(result)
          setLastUpdated(result.asOf)
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard data.')
      } finally {
        requestInFlight = false
        if (active && !silent) setLoading(false)
      }
    }

    void refresh(false)
    const timer = window.setInterval(() => void refresh(true), 60_000)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void refresh(true)
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      active = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [user?.role, user?.userId, refreshRequest])

  if (!user) {
    return (
      <div className="dashboard">
        <div className="panel database-message">Sign in to view your workspace.</div>
      </div>
    )
  }

  const roleTitle = user.role === 'ADMIN'
    ? 'ADMIN OVERVIEW'
    : user.role === 'CUSTOMER'
      ? 'CUSTOMER OVERVIEW'
      : user.role === 'RECRUITER'
        ? 'RECRUITER OVERVIEW'
        : 'CANDIDATE OVERVIEW'
  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName
  const updatedLabel = lastUpdated
    ? new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(lastUpdated))
    : 'Not available'

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{roleTitle}</div>
          <h1>Welcome, {firstName}</h1>
          <p>Live operational data · Times shown in India Standard Time (IST)</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => setRefreshRequest((value) => value + 1)} disabled={loading}>
          <RefreshCw size={15} /> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {!analytics && loading && (
        <div className="panel database-message" role="status">Loading your live dashboard…</div>
      )}
      {!analytics && !loading && !error && (
        <div className="panel database-message" role="status">No dashboard data is available yet.</div>
      )}

      <div className="metric-grid">
        {(analytics?.metrics ?? []).map((item) => {
          const iconConfig = metricIcons[item.key] ?? { icon: ClipboardList, tone: 'blue' }
          const Icon = iconConfig.icon
          return (
            <article className="metric-card" key={item.key}>
              <div className="metric-top">
                <div className={`metric-icon ${iconConfig.tone}`}><Icon size={19} /></div>
              </div>
              <div className="metric-value">{loading && !analytics ? '…' : item.value.toLocaleString('en-IN')}</div>
              <div className="metric-bottom"><span>{item.label}</span></div>
            </article>
          )
        })}
      </div>

      <div className="dashboard-grid">
        {(analytics?.charts ?? []).map((chart, chartIndex) => {
          const maxValue = Math.max(1, ...chart.items.map((item) => item.value))
          return (
            <section className="panel" key={chart.key}>
              <div className="panel-heading">
                <div>
                  <h3>{chart.title}</h3>
                  <p>Current database totals</p>
                </div>
              </div>
              {chart.items.length === 0 ? (
                <div className="database-message">No records to display yet.</div>
              ) : (
                <div className="pipeline-bars">
                  {chart.items.map((item) => {
                    const width = item.value === 0 ? 0 : Math.max(3, (item.value / maxValue) * 100)
                    return (
                      <div className="bar-row" key={item.label}>
                        <div>
                          <span>{item.label.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}</span>
                          <strong>{item.value.toLocaleString('en-IN')}</strong>
                        </div>
                        <div
                          className="bar-track"
                          role="progressbar"
                          aria-label={`${chart.title}: ${item.label.replace(/_/g, ' ').toLowerCase()}`}
                          aria-valuemin={0}
                          aria-valuemax={maxValue}
                          aria-valuenow={item.value}
                        >
                          <i className={chartIndex === 0 ? 'bar-blue' : 'bar-violet'} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="panel database-read-only" role="status">
        Last updated: {updatedLabel}. Dashboard refreshes every 60 seconds while this page is visible.
      </div>
    </div>
  )
}
