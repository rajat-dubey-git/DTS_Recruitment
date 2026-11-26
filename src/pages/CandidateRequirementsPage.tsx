import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BriefcaseBusiness, MapPin, Search } from 'lucide-react'
import { candidateApi } from '../api/candidate'
import type { CandidateRequirement } from '../api/candidate'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

export default function CandidateRequirementsPage() {
  const [requirements, setRequirements] = useState<CandidateRequirement[]>([])
  const [search, setSearch] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyRequirement, setBusyRequirement] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const requirementPage = useListPagination(requirements, `${search}:${location}`)

  async function loadRequirements(searchTerm = search, locationTerm = location) {
    setError('')
    const result = await candidateApi.requirements(searchTerm, locationTerm)
    setRequirements(result.requirements)
  }

  useEffect(() => {
    let active = true
    candidateApi.requirements()
      .then((result) => {
        if (active) setRequirements(result.requirements)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load open requirements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function searchRequirements(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      await loadRequirements(search, location)
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : 'Requirement search failed.')
    } finally {
      setLoading(false)
    }
  }

  async function apply(requirement: CandidateRequirement) {
    setBusyRequirement(requirement.requirement_id)
    setError('')
    setMessage('')
    try {
      const result = await candidateApi.apply(requirement.requirement_id)
      setRequirements((current) => current.map((item) => item.requirement_id === requirement.requirement_id
        ? { ...item, has_applied: 1 }
        : item))
      setMessage(result.message)
    } catch (applyError: unknown) {
      setError(applyError instanceof Error ? applyError.message : 'Unable to submit your application.')
    } finally {
      setBusyRequirement(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Opportunities</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">Open requirements</h1>
        <p className="mt-1 text-sm text-slate-500">Explore active roles and apply directly through your candidate account.</p>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <form onSubmit={(event) => void searchRequirements(event)} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto]">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            aria-label="Search roles"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
            placeholder="Job title, profile or keyword"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="relative">
          <MapPin size={16} className="absolute left-3 top-3 text-slate-400" />
          <input
            aria-label="Filter by location"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
            placeholder="Location or customer"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          <Search size={15} /> {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {loading ? <div className="panel database-message" role="status">Loading open positions…</div>
        : requirements.length === 0 ? (
          <div className="panel database-message">No open requirements match your search.</div>
        ) : (
          <div className="space-y-4">
            {requirementPage.items.map((requirement) => (
              <article key={requirement.requirement_id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{requirement.requirement_number}</span>
                      <span className="text-xs text-slate-500">{requirement.company_name}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-slate-800">{requirement.job_title}</h2>
                    <p className="mt-1 text-sm text-slate-500">{requirement.job_profile_title}</p>
                  </div>
                  <button
                    type="button"
                    className={requirement.has_applied ? 'btn btn-outline' : 'btn btn-primary'}
                    disabled={Boolean(requirement.has_applied) || busyRequirement !== null}
                    onClick={() => void apply(requirement)}
                  >
                    <BriefcaseBusiness size={15} />
                    {requirement.has_applied
                      ? 'Already applied'
                      : busyRequirement === requirement.requirement_id ? 'Applying…' : 'Apply'}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{requirement.work_mode}</span>
                  {requirement.work_location && <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{requirement.work_location}</span>}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                    {requirement.experience_min_years ?? 0}–{requirement.experience_max_years ?? 'Any'} years
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{requirement.employment_schedule.replace('_', ' ')}</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{requirement.headcount} opening{requirement.headcount === 1 ? '' : 's'}</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{requirement.job_description}</p>
                {(requirement.salary_min !== null || requirement.salary_max !== null) && (
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Salary range: {requirement.salary_min ?? 'Not listed'} – {requirement.salary_max ?? 'Not listed'}
                  </p>
                )}
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
    </div>
  )
}
