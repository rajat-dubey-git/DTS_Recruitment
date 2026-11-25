import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Clock, RotateCcw } from 'lucide-react'
import { candidateApi } from '../api/candidate'
import type { CandidateApplication, CandidateTimelineEvent } from '../api/candidate'

const withdrawableStatuses = new Set(['APPLIED', 'SCREENING', 'SHORTLISTED'])

export default function CandidateApplicationsPage() {
  const [applications, setApplications] = useState<CandidateApplication[]>([])
  const [timelines, setTimelines] = useState<Record<number, CandidateTimelineEvent[]>>({})
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busyApplication, setBusyApplication] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadApplications() {
    const result = await candidateApi.applications()
    setApplications(result.applications)
  }

  useEffect(() => {
    let active = true
    candidateApi.applications()
      .then((result) => {
        if (active) setApplications(result.applications)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load applications.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function toggleTimeline(applicationId: number) {
    setError('')
    if (expanded.has(applicationId)) {
      setExpanded((current) => {
        const next = new Set(current)
        next.delete(applicationId)
        return next
      })
      return
    }
    try {
      const result = await candidateApi.timeline(applicationId)
      setTimelines((current) => ({ ...current, [applicationId]: result.history }))
      setExpanded((current) => new Set(current).add(applicationId))
    } catch (timelineError: unknown) {
      setError(timelineError instanceof Error ? timelineError.message : 'Unable to load the application timeline.')
    }
  }

  async function withdraw(application: CandidateApplication) {
    if (!window.confirm(`Withdraw application for ${application.job_title}?`)) return
    setBusyApplication(application.application_id)
    setError('')
    setMessage('')
    try {
      const result = await candidateApi.withdraw(application.application_id)
      await loadApplications()
      setTimelines((current) => ({ ...current, [application.application_id]: [] }))
      if (expanded.has(application.application_id)) {
        const timeline = await candidateApi.timeline(application.application_id)
        setTimelines((current) => ({ ...current, [application.application_id]: timeline.history }))
      }
      setMessage(result.message)
    } catch (withdrawError: unknown) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Unable to withdraw this application.')
    } finally {
      setBusyApplication(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Application activity</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">My applications</h1>
          <p className="mt-1 text-sm text-slate-500">Follow each application’s progress or withdraw an active application.</p>
        </div>
        <Link className="btn btn-primary" to="/app/candidate/requirements">Browse requirements</Link>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      {loading ? <div className="panel database-message" role="status">Loading applications…</div>
        : applications.length === 0 ? (
          <div className="panel database-message">
            You have no applications yet. <Link className="font-semibold text-blue-700 hover:underline" to="/app/candidate/requirements">Browse open requirements</Link>.
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((application) => (
              <article key={application.application_id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-800">{application.job_title}</h2>
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{application.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{application.requirement_number} · {application.work_location || 'Location not listed'}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Application {application.application_number} · Submitted {new Date(application.applied_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline" onClick={() => void toggleTimeline(application.application_id)}>
                      <Activity size={15} /> {expanded.has(application.application_id) ? 'Hide timeline' : 'View timeline'}
                    </button>
                    {withdrawableStatuses.has(application.status) && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={busyApplication !== null}
                        onClick={() => void withdraw(application)}
                      >
                        <RotateCcw size={15} /> {busyApplication === application.application_id ? 'Withdrawing…' : 'Withdraw'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded.has(application.application_id) && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Clock size={15} /> Status history</h3>
                    <div className="mt-3 space-y-3">
                      {(timelines[application.application_id] || []).map((event, index) => (
                        <div key={`${event.changed_at}-${index}`} className="flex gap-3 text-sm">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          <div>
                            <p className="font-medium text-slate-700">
                              {event.old_status ? `${event.old_status} → ` : ''}{event.new_status}
                            </p>
                            <p className="text-xs text-slate-500">{new Date(event.changed_at).toLocaleString()}</p>
                            {event.change_reason && <p className="mt-1 text-xs text-slate-500">{event.change_reason}</p>}
                          </div>
                        </div>
                      ))}
                      {!timelines[application.application_id]?.length && (
                        <p className="text-sm text-slate-500">No status updates are available yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
    </div>
  )
}
