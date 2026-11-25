import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Search, UserCheck, Users } from 'lucide-react'
import {
  fetchRecruiterRequirements,
  searchCandidates,
  submitCandidateToRequirement,
} from '../api/recruitment'
import type { Candidate, RecruiterRequirement } from '../types/recruitment'
import RecruiterCandidateDetailsModal from '../components/RecruiterCandidateDetailsModal'

export default function RecruiterCandidatesPage() {
  const [requirements, setRequirements] = useState<RecruiterRequirement[]>([])
  const [selectedRequirement, setSelectedRequirement] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [query, setQuery] = useState('')
  const [skill, setSkill] = useState('')
  const [location, setLocation] = useState('')
  const [experienceMin, setExperienceMin] = useState('')
  const [experienceMax, setExperienceMax] = useState('')
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [submittedIds, setSubmittedIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [busyCandidate, setBusyCandidate] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [detailCandidateId, setDetailCandidateId] = useState<number | null>(null)

  const openRequirements = requirements.filter((requirement) => requirement.status === 'OPEN')

  useEffect(() => {
    let active = true
    fetchRecruiterRequirements()
      .then(async (requirementResult) => {
        if (!active) return
        setRequirements(requirementResult.requirements)
        const firstOpen = requirementResult.requirements.find((requirement) => requirement.status === 'OPEN')
        setSelectedRequirement(firstOpen ? String(firstOpen.requirement_id) : '')
        if (firstOpen) {
          const candidateResult = await searchCandidates({ requirementId: firstOpen.requirement_id })
          if (active) setCandidates(candidateResult.candidates)
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load candidate workspace.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const runSearch = async (event?: FormEvent<HTMLFormElement>, requirementId = Number(selectedRequirement)) => {
    event?.preventDefault()
    if (!Number.isSafeInteger(requirementId) || requirementId < 1) {
      setError('Select an assigned requirement before searching candidates.')
      return
    }
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const result = await searchCandidates({
        requirementId,
        query: query.trim() || undefined,
        skill: skill.trim() || undefined,
        location: location.trim() || undefined,
        experienceMin: experienceMin === '' ? undefined : Number(experienceMin),
        experienceMax: experienceMax === '' ? undefined : Number(experienceMax),
      })
      setCandidates(result.candidates)
      setSubmittedIds(new Set())
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Candidate search failed.')
    } finally {
      setLoading(false)
    }
  }

  const submitCandidate = async (candidate: Candidate) => {
    if (!selectedRequirement) {
      setError('Select an open requirement before submitting a candidate.')
      return
    }
    if (!consentConfirmed) {
      setError('Confirm candidate consent before submitting this profile.')
      return
    }
    setBusyCandidate(candidate.candidate_id)
    setError('')
    setMessage('')
    try {
      const result = await submitCandidateToRequirement({
        candidateId: candidate.candidate_id,
        requirementId: Number(selectedRequirement),
        consentConfirmed: true,
      })
      setSubmittedIds((current) => new Set(current).add(candidate.candidate_id))
      setConsentConfirmed(false)
      setMessage(result.message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit this candidate.')
    } finally {
      setBusyCandidate(null)
    }
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">RECRUITER WORKSPACE</div>
          <h1>Candidate search</h1>
          <p>Find eligible candidates and submit consented profiles to your open requirements.</p>
        </div>
        <span className="agreement-status"><Users size={14} /> {candidates.length} results</span>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <section className="panel" style={{ marginBottom: '1rem' }}>
        <form onSubmit={(event) => void runSearch(event)}>
          <div className="customer-filters" style={{ flexWrap: 'wrap' }}>
            <label className="form-field" style={{ flex: '1 1 190px' }}>
              <span>Name or email</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label className="form-field" style={{ flex: '1 1 150px' }}>
              <span>Skill</span>
              <input value={skill} onChange={(event) => setSkill(event.target.value)} />
            </label>
            <label className="form-field" style={{ flex: '1 1 150px' }}>
              <span>Location</span>
              <input value={location} onChange={(event) => setLocation(event.target.value)} />
            </label>
            <label className="form-field" style={{ flex: '0 1 120px' }}>
              <span>Min. years</span>
              <input type="number" min="0" step="0.5" value={experienceMin} onChange={(event) => setExperienceMin(event.target.value)} />
            </label>
            <label className="form-field" style={{ flex: '0 1 120px' }}>
              <span>Max. years</span>
              <input type="number" min="0" step="0.5" value={experienceMax} onChange={(event) => setExperienceMax(event.target.value)} />
            </label>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Search size={15} /> Search
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="customer-toolbar" style={{ flexWrap: 'wrap' }}>
          <div>
            <h3>Search results</h3>
            <p>Only new and active candidate profiles are available for submission.</p>
          </div>
          <label className="form-field" style={{ minWidth: '260px' }}>
            <span>Submit to open requirement</span>
            <select
              value={selectedRequirement}
              onChange={(event) => {
                setSelectedRequirement(event.target.value)
                setSubmittedIds(new Set())
                setConsentConfirmed(false)
                if (event.target.value) void runSearch(undefined, Number(event.target.value))
                else setCandidates([])
              }}
            >
              <option value="">Select a requirement</option>
              {openRequirements.map((requirement) => (
                <option key={requirement.requirement_id} value={requirement.requirement_id}>
                  {requirement.requirement_code} — {requirement.job_title} ({requirement.company_name})
                </option>
              ))}
            </select>
          </label>
        </div>

        {openRequirements.length === 0 && (
          <div className="database-read-only">You have no open assigned requirements available for submissions.</div>
        )}

        <label className="database-read-only" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="checkbox"
            checked={consentConfirmed}
            onChange={(event) => setConsentConfirmed(event.target.checked)}
          />
          <span>I confirm the candidate has explicitly consented to representation for this requirement and to sharing their profile with the customer.</span>
        </label>

        {loading ? (
          <div className="customer-empty">Loading candidates…</div>
        ) : candidates.length === 0 ? (
          <div className="customer-empty">No candidates match the selected search criteria.</div>
        ) : (
          <div className="agreement-line-list">
            {candidates.map((candidate) => (
              <article className="agreement-line-card" key={candidate.candidate_id}>
                <div style={{ flex: 1 }}>
                  <strong>{candidate.full_name}</strong>
                  <p>{candidate.current_location || 'Location not listed'} · {candidate.total_experience_years} years experience</p>
                  <p>{candidate.total_experience_years} years · {candidate.notice_period_days} days notice · Expected: {candidate.expected_ctc ?? 'Not listed'}</p>
                  <small>{candidate.primary_skills || 'No skills listed'} · {candidate.status}</small>
                  {candidate.match_score !== null && <small> · {candidate.match_score}% skill match</small>}
                  {candidate.missing_mandatory_skills.length > 0 && <p className="form-error">Missing required skills: {candidate.missing_mandatory_skills.join(', ')}</p>}
                  {candidate.profile_summary && <p>{candidate.profile_summary}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline" onClick={() => setDetailCandidateId(candidate.candidate_id)}>
                    View full profile
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={!consentConfirmed || !selectedRequirement || busyCandidate !== null || submittedIds.has(candidate.candidate_id)}
                    onClick={() => void submitCandidate(candidate)}
                  >
                    <UserCheck size={14} />
                    {submittedIds.has(candidate.candidate_id)
                      ? 'Submitted'
                      : busyCandidate === candidate.candidate_id
                        ? 'Submitting…'
                        : 'Submit candidate'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <RecruiterCandidateDetailsModal
        candidateId={detailCandidateId}
        requirementId={selectedRequirement ? Number(selectedRequirement) : null}
        onClose={() => setDetailCandidateId(null)}
      />
    </div>
  )
}
