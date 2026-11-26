import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarDays, Clock } from 'lucide-react'
import {
  fetchRecruiterApplications,
  fetchRecruiterInterviews,
  scheduleRecruiterInterview,
  updateRecruiterInterviewStatus,
} from '../api/recruitment'
import type { RecruiterApplication, RecruiterInterview } from '../types/recruitment'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

function localDateTimeAfter(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function RecruiterInterviewsPage() {
  const [interviews, setInterviews] = useState<RecruiterInterview[]>([])
  const [applications, setApplications] = useState<RecruiterApplication[]>([])
  const [applicationId, setApplicationId] = useState('')
  const [interviewType, setInterviewType] = useState<'PHONE' | 'VIDEO' | 'IN_PERSON'>('VIDEO')
  const [scheduledStart, setScheduledStart] = useState(() => localDateTimeAfter(1))
  const [scheduledEnd, setScheduledEnd] = useState(() => localDateTimeAfter(2))
  const [locationOrLink, setLocationOrLink] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [nextStatus, setNextStatus] = useState<Record<number, 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | ''>>({})
  const [savingInterviewId, setSavingInterviewId] = useState<number | null>(null)
  const interviewPage = useListPagination(interviews)

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [interviewResult, applicationResult] = await Promise.all([
        fetchRecruiterInterviews(),
        fetchRecruiterApplications(),
      ])
      setInterviews(interviewResult.interviews)
      const eligibleApplications = applicationResult.applications.filter(
        (application) => !['SELECTED', 'REJECTED', 'WITHDRAWN'].includes(application.status),
      )
      setApplications(eligibleApplications)
      setApplicationId((current) => current || String(eligibleApplications[0]?.application_id ?? ''))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load interview information.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const schedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!applicationId) {
      setError('Select an application before scheduling an interview.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await scheduleRecruiterInterview({
        applicationId: Number(applicationId),
        interviewType,
        scheduledStart,
        scheduledEnd,
        locationOrLink,
      })
      setMessage(result.message)
      setScheduledStart(localDateTimeAfter(1))
      setScheduledEnd(localDateTimeAfter(2))
      setLocationOrLink('')
      await loadData()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to schedule the interview.')
    } finally {
      setSaving(false)
    }
  }

  const updateInterview = async (interviewId: number) => {
    const status = nextStatus[interviewId]
    if (!status) return
    setSavingInterviewId(interviewId)
    setError('')
    setMessage('')
    try {
      const result = await updateRecruiterInterviewStatus(interviewId, status)
      setMessage(result.message)
      setNextStatus((current) => {
        const next = { ...current }
        delete next[interviewId]
        return next
      })
      await loadData()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update the interview.')
    } finally {
      setSavingInterviewId(null)
    }
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECRUITER WORKSPACE</div>
          <h1>Interviews</h1>
          <p>Schedule and review interviews for applications you own or requirements assigned to you.</p>
        </div>
        <span className="agreement-status"><CalendarDays size={14} /> {interviews.length} interviews</span>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <h3>Schedule an interview</h3>
        <form onSubmit={(event) => void schedule(event)}>
          <label className="form-field">
            <span>Application</span>
            <select value={applicationId} onChange={(event) => setApplicationId(event.target.value)} required>
              <option value="">Select an application</option>
              {applications.map((application) => (
                <option key={application.application_id} value={application.application_id}>
                  {application.application_number} — {application.candidate_name} · {application.job_title}
                </option>
              ))}
            </select>
          </label>
          <div className="customer-filters" style={{ flexWrap: 'wrap' }}>
            <label className="form-field" style={{ flex: '1 1 160px' }}>
              <span>Interview type</span>
              <select value={interviewType} onChange={(event) => setInterviewType(event.target.value as typeof interviewType)}>
                <option value="VIDEO">Video</option>
                <option value="PHONE">Phone</option>
                <option value="IN_PERSON">In person</option>
              </select>
            </label>
            <label className="form-field" style={{ flex: '1 1 190px' }}>
              <span>Start</span>
              <input type="datetime-local" value={scheduledStart} onChange={(event) => setScheduledStart(event.target.value)} required />
            </label>
            <label className="form-field" style={{ flex: '1 1 190px' }}>
              <span>End</span>
              <input type="datetime-local" value={scheduledEnd} onChange={(event) => setScheduledEnd(event.target.value)} required />
            </label>
            <label className="form-field" style={{ flex: '1 1 220px' }}>
              <span>Location or meeting link</span>
              <input maxLength={500} value={locationOrLink} onChange={(event) => setLocationOrLink(event.target.value)} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving || loading || applications.length === 0}>
            <CalendarDays size={15} /> {saving ? 'Scheduling…' : 'Schedule interview'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="customer-toolbar">
          <div>
            <h3>Interview schedule</h3>
            <p>Most recent scheduled dates appear first.</p>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => void loadData()} disabled={loading}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="customer-empty">Loading interviews…</div>
        ) : interviews.length === 0 ? (
          <div className="customer-empty">No interviews have been scheduled for your applications.</div>
        ) : (
          <div className="agreement-line-list">
            {interviewPage.items.map((interview) => (
              <article className="agreement-line-card" key={interview.interview_id}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <strong>{interview.candidate_name} · Round {interview.round_number}</strong>
                    <span className="agreement-status">{interview.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p>{interview.job_title} · {interview.company_name} · {interview.interview_type.replace(/_/g, ' ')}</p>
                  <small>
                    <Clock size={12} /> {dateLabel(interview.scheduled_start)} – {dateLabel(interview.scheduled_end)}
                  </small>
                  {interview.location_or_link && <p>{interview.location_or_link}</p>}
                  <small>{interview.application_number} · Interviewer: {interview.interviewer_name || 'Not assigned'}</small>
                  {interview.status === 'SCHEDULED' && (
                    <div className="customer-filters" style={{ marginTop: '0.75rem', alignItems: 'end' }}>
                      <label className="form-field">
                        <span>Record outcome</span>
                        <select
                          value={nextStatus[interview.interview_id] ?? ''}
                          onChange={(event) => setNextStatus((current) => ({
                            ...current,
                            [interview.interview_id]: event.target.value as 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | '',
                          }))}
                        >
                          <option value="">Select outcome</option>
                          <option value="COMPLETED">Completed</option>
                          <option value="NO_SHOW">No show</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={!nextStatus[interview.interview_id] || savingInterviewId === interview.interview_id}
                        onClick={() => void updateInterview(interview.interview_id)}
                      >
                        {savingInterviewId === interview.interview_id ? 'Saving…' : 'Save outcome'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            <PaginationControls
              page={interviewPage.page}
              pageCount={interviewPage.pageCount}
              total={interviewPage.total}
              onPageChange={interviewPage.setPage}
            />
          </div>
        )}
      </section>
    </div>
  )
}
