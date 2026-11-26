import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { workspaceApi } from '../api/workspace'
import type { CustomerInterview } from '../api/workspace'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

export default function CustomerInterviewsPage() {
  const [interviews, setInterviews] = useState<CustomerInterview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const interviewPage = useListPagination(interviews)

  const loadInterviews = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setInterviews(await workspaceApi.listCustomerInterviews())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your interview schedule.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInterviews()
  }, [loadInterviews])

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>Interviews</h1>
          <p>Review interview schedules for candidates shared with your organisation.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void loadInterviews()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      <section className="panel">
        {loading ? (
          <div className="customer-empty">Loading interviews…</div>
        ) : interviews.length === 0 ? (
          <div className="customer-empty"><CalendarDays size={18} /> No interviews are scheduled for candidates shared with your organisation.</div>
        ) : (
          <div className="agreement-line-list">
            {interviewPage.items.map((interview) => (
              <article className="agreement-line-card" key={interview.interview_id}>
                <div style={{ flex: 1 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{interview.candidate_name} · Round {interview.round_number}</strong>
                    <span className="agreement-status">{label(interview.status)}</span>
                  </div>
                  <p>{interview.job_title} · {interview.requirement_number} · {label(interview.interview_type)}</p>
                  <p>{dateLabel(interview.scheduled_start)} - {dateLabel(interview.scheduled_end)}</p>
                  {interview.location_or_link && <p>{interview.location_or_link}</p>}
                  <small>{interview.application_number} · Interviewer: {interview.interviewer_name || 'Not assigned'}</small>
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
