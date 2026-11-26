import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Search } from 'lucide-react'
import { fetchRecruiterApplications, updateRecruiterApplicationStatus } from '../api/recruitment'
import { offerApi } from '../api/offers'
import OfferUploadForm from '../components/OfferUploadForm'
import PaginationControls, { useListPagination } from '../components/PaginationControls'
import type { RecruiterApplication } from '../types/recruitment'

const statuses = ['APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN']
const nextStatuses: Record<string, string[]> = {
  APPLIED: ['SCREENING', 'REJECTED'],
  SCREENING: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['INTERVIEW', 'REJECTED'],
  INTERVIEW: ['SELECTED', 'REJECTED'],
}

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function RecruiterApplicationsPage() {
  const [applications, setApplications] = useState<RecruiterApplication[]>([])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [nextStatus, setNextStatus] = useState<Record<number, string>>({})
  const [savingApplicationId, setSavingApplicationId] = useState<number | null>(null)

  const loadApplications = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await fetchRecruiterApplications(query)
      setApplications(result.applications)
      setLoaded(true)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load applications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadApplications()
  }, [])

  const visibleApplications = applications.filter((application) => !statusFilter || application.status === statusFilter)
  const applicationPage = useListPagination(visibleApplications, `${query}:${statusFilter}`)

  const updateStatus = async (applicationId: number) => {
    const status = nextStatus[applicationId]
    if (!status) return
    setSavingApplicationId(applicationId)
    setError('')
    try {
      await updateRecruiterApplicationStatus(applicationId, status, 'Updated from the recruiter applications workspace.')
      setNextStatus((current) => {
        const next = { ...current }
        delete next[applicationId]
        return next
      })
      await loadApplications()
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update application status.')
    } finally {
      setSavingApplicationId(null)
    }
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECRUITER WORKSPACE</div>
          <h1>Applications</h1>
          <p>Review candidate submissions across your assigned requirements.</p>
        </div>
        <span className="agreement-status">{visibleApplications.length} applications</span>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <section className="panel">
        <form className="customer-toolbar" onSubmit={(event) => void loadApplications(event)}>
          <div className="customer-search">
            <Search size={16} />
            <input
              aria-label="Search applications"
              placeholder="Search candidates, requirements, customers..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            aria-label="Filter by application status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Loading…' : 'Search'}
          </button>
        </form>

        {loading ? (
          <div className="customer-empty">Loading applications…</div>
        ) : !loaded ? (
          <div className="customer-empty">Search to load your applications.</div>
        ) : visibleApplications.length === 0 ? (
          <div className="customer-empty">No applications match these filters.</div>
        ) : (
          <div className="agreement-line-list">
            {applicationPage.items.map((application) => (
              <article className="agreement-line-card" key={application.application_id}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <strong>{application.candidate_name}</strong>
                    <span className="agreement-status">{label(application.status)}</span>
                  </div>
                  <p>{application.candidate_email} · {application.candidate_mobile || 'No phone listed'}</p>
                  <p><strong>{application.job_title}</strong> · {application.company_name}</p>
                  <small>{application.application_number} · {application.requirement_number} · Submitted {dateLabel(application.applied_at)}</small>
                  {application.recruiter_name && <small> · Recruiter: {application.recruiter_name}</small>}
                  {application.status === 'SELECTED' && application.selection_id !== null && (
                    <details className="recruiter-offer-details">
                      <summary>Upload offer letter</summary>
                      <OfferUploadForm
                        onSubmit={(form) => offerApi.sendRecruiter(application.selection_id!, form)}
                        onSuccess={(successMessage) => {
                          setMessage(successMessage)
                          void loadApplications()
                        }}
                      />
                    </details>
                  )}
                  {(nextStatuses[application.status] ?? []).length > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                      <select
                        aria-label={`Next status for ${application.application_number}`}
                        value={nextStatus[application.application_id] ?? ''}
                        onChange={(event) => setNextStatus((current) => ({
                          ...current,
                          [application.application_id]: event.target.value,
                        }))}
                      >
                        <option value="">Move to…</option>
                        {nextStatuses[application.status].map((status) => (
                          <option key={status} value={status}>{label(status)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-outline"
                        disabled={!nextStatus[application.application_id] || savingApplicationId === application.application_id}
                        onClick={() => void updateStatus(application.application_id)}
                      >
                        {savingApplicationId === application.application_id ? 'Saving…' : 'Update status'}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            <PaginationControls
              page={applicationPage.page}
              pageCount={applicationPage.pageCount}
              total={applicationPage.total}
              onPageChange={applicationPage.setPage}
            />
          </div>
        )}
      </section>
    </div>
  )
}
