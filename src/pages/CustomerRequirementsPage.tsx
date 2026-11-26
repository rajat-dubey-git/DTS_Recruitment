import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BriefcaseBusiness, Plus, RefreshCw } from 'lucide-react'
import { workspaceApi } from '../api/workspace'
import type {
  CustomerRequirement,
  CustomerRequirementInput,
  CustomerRequirementRequest,
} from '../api/workspace'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

const initialForm: CustomerRequirementInput = {
  jobTitle: '',
  skills: [],
  jobDescription: '',
  headcount: 1,
  workMode: 'ONSITE',
  workLocation: '',
  experienceMinYears: null,
  experienceMaxYears: null,
  salaryMin: null,
  salaryMax: null,
  employmentSchedule: 'FULL_TIME',
  hoursPerWeek: null,
  targetJoinDate: null,
}

function dateLabel(value: string | null) {
  if (!value) return 'Not submitted'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function label(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase()) : '—'
}

function optionalNumber(value: string) {
  return value === '' ? null : Number(value)
}

export default function CustomerRequirementsPage() {
  const [requests, setRequests] = useState<CustomerRequirementRequest[]>([])
  const [requirements, setRequirements] = useState<CustomerRequirement[]>([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [skillsText, setSkillsText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const requestPage = useListPagination(requests)
  const requirementPage = useListPagination(requirements)

  const loadRequirements = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await workspaceApi.listCustomerRequirements()
      setRequests(result.requests)
      setRequirements(result.requirements)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load your requirements.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRequirements()
  }, [loadRequirements])

  const updateForm = <K extends keyof CustomerRequirementInput>(
    key: K,
    value: CustomerRequirementInput[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  const submitRequirement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.createCustomerRequirement({
        ...form,
        skills: skillsText.split(/[,\n]/).map((skill) => skill.trim()).filter(Boolean),
      })
      setMessage(result.message)
      setForm(initialForm)
      setSkillsText('')
      setShowCreate(false)
      await loadRequirements()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your requirement.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>My Requirements</h1>
          <p>Submit hiring needs and track the requirements being handled for your organisation.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-outline" onClick={() => void loadRequirements()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate((current) => !current)}>
            <Plus size={15} /> New requirement
          </button>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      {showCreate && (
        <section className="panel">
          <h2>Submit a hiring requirement</h2>
          <p className="text-sm text-slate-500">The DTS team will review this request before activating recruitment.</p>
          <form onSubmit={(event) => void submitRequirement(event)} className="space-y-4">
            <div className="customer-filters" style={{ flexWrap: 'wrap' }}>
              <label className="form-field" style={{ flex: '1 1 260px' }}>
                <span>Job title *</span>
                <input required maxLength={150} value={form.jobTitle} onChange={(event) => updateForm('jobTitle', event.target.value)} />
              </label>
              <label className="form-field" style={{ flex: '0 1 150px' }}>
                <span>Headcount *</span>
                <input required type="number" min="1" max="65535" step="1" value={form.headcount} onChange={(event) => updateForm('headcount', Number(event.target.value))} />
              </label>
              <label className="form-field" style={{ flex: '1 1 170px' }}>
                <span>Work mode *</span>
                <select value={form.workMode} onChange={(event) => updateForm('workMode', event.target.value as CustomerRequirementInput['workMode'])}>
                  <option value="ONSITE">On-site</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="REMOTE">Remote</option>
                </select>
              </label>
              <label className="form-field" style={{ flex: '1 1 220px' }}>
                <span>Work location</span>
                <input maxLength={150} value={form.workLocation} onChange={(event) => updateForm('workLocation', event.target.value)} />
              </label>
              <label className="form-field" style={{ flex: '1 1 170px' }}>
                <span>Schedule *</span>
                <select
                  value={form.employmentSchedule}
                  onChange={(event) => {
                    const schedule = event.target.value as CustomerRequirementInput['employmentSchedule']
                    setForm((current) => ({
                      ...current,
                      employmentSchedule: schedule,
                      hoursPerWeek: schedule === 'FULL_TIME' ? null : current.hoursPerWeek,
                    }))
                  }}
                >
                  <option value="FULL_TIME">Full time</option>
                  <option value="PART_TIME">Part time</option>
                </select>
              </label>
              {form.employmentSchedule === 'PART_TIME' && (
                <label className="form-field" style={{ flex: '0 1 150px' }}>
                  <span>Hours per week *</span>
                  <input required type="number" min="0.01" max="168" step="0.25" value={form.hoursPerWeek ?? ''} onChange={(event) => updateForm('hoursPerWeek', optionalNumber(event.target.value))} />
                </label>
              )}
              <label className="form-field" style={{ flex: '0 1 150px' }}>
                <span>Minimum experience (years)</span>
                <input type="number" min="0" max="999.9" step="0.1" value={form.experienceMinYears ?? ''} onChange={(event) => updateForm('experienceMinYears', optionalNumber(event.target.value))} />
              </label>
              <label className="form-field" style={{ flex: '0 1 150px' }}>
                <span>Maximum experience (years)</span>
                <input type="number" min="0" max="999.9" step="0.1" value={form.experienceMaxYears ?? ''} onChange={(event) => updateForm('experienceMaxYears', optionalNumber(event.target.value))} />
              </label>
              <label className="form-field" style={{ flex: '0 1 170px' }}>
                <span>Minimum salary</span>
                <input type="number" min="0" step="0.01" value={form.salaryMin ?? ''} onChange={(event) => updateForm('salaryMin', optionalNumber(event.target.value))} />
              </label>
              <label className="form-field" style={{ flex: '0 1 170px' }}>
                <span>Maximum salary</span>
                <input type="number" min="0" step="0.01" value={form.salaryMax ?? ''} onChange={(event) => updateForm('salaryMax', optionalNumber(event.target.value))} />
              </label>
              <label className="form-field" style={{ flex: '1 1 180px' }}>
                <span>Target join date</span>
                <input type="date" value={form.targetJoinDate ?? ''} onChange={(event) => updateForm('targetJoinDate', event.target.value || null)} />
              </label>
            </div>
            <label className="form-field">
              <span>Required skills (separate with commas or new lines)</span>
              <textarea rows={2} value={skillsText} onChange={(event) => setSkillsText(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Job description *</span>
              <textarea required maxLength={60000} rows={6} value={form.jobDescription} onChange={(event) => updateForm('jobDescription', event.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Submitting…' : 'Submit for review'}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)} disabled={saving}>Cancel</button>
            </div>
          </form>
        </section>
      )}

      <section className="panel">
        <div className="customer-toolbar">
          <div>
            <h2>Submitted requests</h2>
            <p>Customer requests remain pending until reviewed and mapped to an approved service order.</p>
          </div>
          <span className="agreement-status">{requests.length} requests</span>
        </div>
        {loading ? (
          <div className="customer-empty">Loading requests…</div>
        ) : requests.length === 0 ? (
          <div className="customer-empty">You have not submitted any hiring requests yet.</div>
        ) : (
          <div className="agreement-line-list">
            {requestPage.items.map((request) => (
              <article className="agreement-line-card" key={request.intake_id}>
                <div style={{ flex: 1 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{request.job_title || 'Requirement form link'}</strong>
                    <span className="agreement-status">{label(request.status)}</span>
                  </div>
                  <p>{request.headcount ? `${request.headcount} position(s)` : 'No details submitted'} · {label(request.work_mode)} · {label(request.employment_schedule)}</p>
                  {request.skills_requested.length > 0 && <small>Required skills: {request.skills_requested.join(', ')}</small>}
                  <small>Submitted {dateLabel(request.submitted_at)} · Request #{request.intake_id}</small>
                  {request.requirement_number && (
                    <p>Recruitment requirement: {request.requirement_number} · {label(request.requirement_status)}</p>
                  )}
                </div>
              </article>
            ))}
            <PaginationControls
              page={requestPage.page}
              pageCount={requestPage.pageCount}
              total={requestPage.total}
              onPageChange={requestPage.setPage}
            />
          </div>
        )}
      </section>

      <section className="panel">
        <div className="customer-toolbar">
          <div>
            <h2>Recruitment in progress</h2>
            <p>Requirements linked to your organisation's service orders.</p>
          </div>
          <span className="agreement-status">{requirements.length} requirements</span>
        </div>
        {loading ? (
          <div className="customer-empty">Loading requirements…</div>
        ) : requirements.length === 0 ? (
          <div className="customer-empty"><BriefcaseBusiness size={18} /> No recruitment requirements are active yet.</div>
        ) : (
          <div className="agreement-line-list">
            {requirementPage.items.map((requirement) => (
              <article className="agreement-line-card" key={requirement.requirement_id}>
                <div style={{ flex: 1 }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>{requirement.job_title}</strong>
                    <span className="agreement-status">{label(requirement.status)}</span>
                  </div>
                  <p>{requirement.requirement_number} · {requirement.headcount} position(s) · {label(requirement.work_mode)} · {label(requirement.employment_schedule)}</p>
                  <small>Service order {requirement.order_number} · Created {dateLabel(requirement.created_at)}</small>
                  {requirement.work_location && <small> · {requirement.work_location}</small>}
                </div>
              </article>
            ))}
            <PaginationControls
              page={requirementPage.page}
              pageCount={requirementPage.pageCount}
              total={requirementPage.total}
              onPageChange={requirementPage.setPage}
            />
          </div>
        )}
      </section>
    </div>
  )
}
