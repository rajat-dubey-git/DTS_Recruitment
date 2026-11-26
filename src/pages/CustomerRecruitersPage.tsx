import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, Users } from 'lucide-react'
import { workspaceApi } from '../api/workspace'
import type { CustomerRecruiter } from '../api/workspace'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export default function CustomerRecruitersPage() {
  const [recruiters, setRecruiters] = useState<CustomerRecruiter[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const recruiterPage = useListPagination(recruiters)

  const loadRecruiters = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRecruiters(await workspaceApi.listCustomerRecruiters())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your recruiter assignments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRecruiters()
  }, [loadRecruiters])

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>Assigned Recruiters</h1>
          <p>Recruiters currently supporting requirements for your organisation.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void loadRecruiters()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      <section className="panel">
        {loading ? (
          <div className="customer-empty">Loading recruiter assignments…</div>
        ) : recruiters.length === 0 ? (
          <div className="customer-empty"><Users size={18} /> No recruiters have been assigned to your requirements yet.</div>
        ) : (
          <div className="agreement-line-list">
            {recruiterPage.items.map((recruiter) => (
              <article className="agreement-line-card" key={recruiter.assignment_id}>
                <div style={{ flex: 1 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{recruiter.full_name}</strong>
                    <span className="agreement-status">{recruiter.assignment_role}</span>
                  </div>
                  <p>{recruiter.email}</p>
                  <p><strong>{recruiter.job_title}</strong> · {recruiter.requirement_number}</p>
                  <small>Assigned {dateLabel(recruiter.assigned_at)}</small>
                </div>
              </article>
            ))}
            <PaginationControls
              page={recruiterPage.page}
              pageCount={recruiterPage.pageCount}
              total={recruiterPage.total}
              onPageChange={recruiterPage.setPage}
            />
          </div>
        )}
      </section>
    </div>
  )
}
