import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, Search, ShieldCheck, UserRound } from 'lucide-react'

type AdminCandidate = {
  candidate_id: number
  candidate_code: string
  first_name: string
  last_name: string | null
  email: string | null
  mobile: string
  current_city: string | null
  current_state: string | null
  total_experience_years: number | string | null
  status: string
  application_count: number
  current_resume_id: number | null
  resume_verification_status: string | null
  resume_malware_scan_status: string | null
}

type CandidateDocument = {
  document_id: number
  file_name: string
  uploaded_at: string
  file_size_bytes: number | null
  verification_status: string
  malware_scan_status: string
  is_current: number
}

type CandidateDetails = {
  candidate: AdminCandidate & {
    date_of_birth: string | null
    current_ctc: number | string | null
    expected_ctc: number | string | null
    notice_period_days: number | null
    profile_summary: string | null
  }
  education: Array<{ education_id: number; qualification: string; specialization: string | null; institution: string | null; passing_year: number | null; grade_or_percentage: string | null }>
  experience: Array<{ experience_id: number; employer_name: string; designation: string; start_date: string | null; end_date: string | null; is_current: number }>
  skills: Array<{ skill_id: number; skill_name: string; skill_category: string | null; experience_years: number | null; proficiency: string | null }>
  documents: CandidateDocument[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Candidate admin request failed.')
  return result
}

function documentState(candidate: AdminCandidate) {
  if (!candidate.current_resume_id) return 'No current resume'
  return `Verification ${candidate.resume_verification_status || 'unknown'} · Scan ${candidate.resume_malware_scan_status || 'unknown'}`
}

export default function AdminCandidatesPage() {
  const [candidates, setCandidates] = useState<AdminCandidate[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [details, setDetails] = useState<CandidateDetails | null>(null)
  const [reviewDocumentId, setReviewDocumentId] = useState<number | null>(null)
  const [verificationStatus, setVerificationStatus] = useState<'VERIFIED' | 'REJECTED'>('VERIFIED')
  const [malwareScanStatus, setMalwareScanStatus] = useState<'CLEAN' | 'REJECTED' | 'ERROR'>('CLEAN')
  const [scanConfirmed, setScanConfirmed] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadCandidates(searchTerm = query) {
    const params = new URLSearchParams()
    if (searchTerm.trim()) params.set('search', searchTerm.trim())
    const result = await request<{ candidates: AdminCandidate[] }>(`/api/admin/candidates?${params.toString()}`)
    setCandidates(result.candidates)
  }

  async function loadDetails(candidateId: number) {
    const result = await request<CandidateDetails>(`/api/admin/candidates/${candidateId}`)
    setDetails(result)
    setSelectedId(candidateId)
    const currentResume = result.documents.find((document) => document.is_current === 1)
    setReviewDocumentId(currentResume?.document_id ?? null)
    setVerificationStatus(currentResume?.verification_status === 'REJECTED' ? 'REJECTED' : 'VERIFIED')
    setMalwareScanStatus(currentResume?.malware_scan_status === 'REJECTED' ? 'REJECTED' : 'CLEAN')
    setScanConfirmed(false)
  }

  useEffect(() => {
    let active = true
    request<{ candidates: AdminCandidate[] }>('/api/admin/candidates')
      .then((result) => {
        if (active) setCandidates(result.candidates)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load candidate records.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function searchCandidates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await loadCandidates()
    } catch (searchError: unknown) {
      setError(searchError instanceof Error ? searchError.message : 'Candidate search failed.')
    } finally {
      setLoading(false)
    }
  }

  async function reviewDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedId === null || reviewDocumentId === null) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await request<{ message: string }>(
        `/api/admin/candidates/${selectedId}/documents/${reviewDocumentId}/review`,
        {
          method: 'PATCH',
          body: JSON.stringify({ verificationStatus, malwareScanStatus, scanConfirmed }),
        },
      )
      await Promise.all([loadDetails(selectedId), loadCandidates()])
      setMessage(result.message)
    } catch (reviewError: unknown) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to save resume review.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Administrator workspace</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">Candidates and resume review</h1>
        <p className="mt-1 text-sm text-slate-500">Review candidate profiles and record document verification and malware-scan outcomes.</p>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <form onSubmit={(event) => void searchCandidates(event)} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, candidate ID, email or mobile" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={loading}><Search size={15} /> Search</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="space-y-3">
          {loading && <div className="panel database-message" role="status">Loading candidates…</div>}
          {!loading && candidates.length === 0 && <div className="panel database-message">No candidate records match this search.</div>}
          {candidates.map((candidate) => (
            <button
              type="button"
              key={candidate.candidate_id}
              onClick={() => {
                setError('')
                setMessage('')
                setBusy(true)
                loadDetails(candidate.candidate_id)
                  .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : 'Unable to load candidate details.'))
                  .finally(() => setBusy(false))
              }}
              className={`w-full rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-blue-300 ${selectedId === candidate.candidate_id ? 'border-blue-500 ring-1 ring-blue-200' : 'border-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{candidate.first_name} {candidate.last_name || ''}</p>
                  <p className="mt-1 text-xs text-slate-500">{candidate.candidate_code} · {candidate.status}</p>
                  <p className="mt-2 text-xs text-slate-600">{candidate.email || candidate.mobile} · {candidate.current_city || 'Location not listed'}</p>
                </div>
                <span className="text-right text-[11px] text-slate-500">{documentState(candidate)}</span>
              </div>
            </button>
          ))}
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
          {!details ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center text-slate-500">
              <UserRound size={28} />
              <p className="mt-3 text-sm">Select a candidate to review their full profile and documents.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{details.candidate.first_name} {details.candidate.last_name || ''}</h2>
                <p className="text-sm text-slate-500">{details.candidate.candidate_code} · {details.candidate.email || 'No email'} · {details.candidate.mobile}</p>
                <p className="mt-2 text-sm text-slate-700">{details.candidate.profile_summary || 'No profile summary.'}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-800">Skills</h3>
                  <p className="mt-2 text-sm text-slate-600">{details.skills.map((skill) => skill.skill_name).join(', ') || 'No skills listed.'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <h3 className="font-semibold text-slate-800">Education</h3>
                  <div className="mt-2 space-y-2 text-sm text-slate-600">
                    {details.education.map((record) => <p key={record.education_id}>{record.qualification}{record.specialization ? ` · ${record.specialization}` : ''} · {record.institution || 'Institution not listed'}</p>)}
                    {!details.education.length && <p>No education records.</p>}
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-700" />
                  <h3 className="font-semibold text-slate-800">Resume documents</h3>
                </div>
                {details.documents.length ? (
                  <div className="mt-3 space-y-3">
                    {details.documents.map((document) => (
                      <div key={document.document_id} className={`rounded-lg border p-3 ${reviewDocumentId === document.document_id ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-800">{document.file_name}{document.is_current ? ' · Current' : ''}</p>
                            <p className="text-xs text-slate-500">{document.verification_status} · Security scan {document.malware_scan_status} · {new Date(document.uploaded_at).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2">
                            <a className="btn btn-outline" href={`/api/admin/candidates/${selectedId}/documents/${document.document_id}/download`}>
                              <Download size={14} /> Download for review
                            </a>
                            <button type="button" className="btn btn-outline" onClick={() => {
                              setReviewDocumentId(document.document_id)
                              setVerificationStatus(document.verification_status === 'REJECTED' ? 'REJECTED' : 'VERIFIED')
                              setMalwareScanStatus(document.malware_scan_status === 'REJECTED' ? 'REJECTED' : 'CLEAN')
                              setScanConfirmed(false)
                            }}>Review</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-3 text-sm text-slate-500">No resume documents are on file.</p>}

                {reviewDocumentId !== null && details.documents.some((document) => document.document_id === reviewDocumentId) && (
                  <form onSubmit={(event) => void reviewDocument(event)} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                    <h4 className="text-sm font-semibold text-slate-800">Record resume review</h4>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="form-field">
                        <span>Document verification</span>
                        <select value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as 'VERIFIED' | 'REJECTED')}>
                          <option value="VERIFIED">Verified</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </label>
                      <label className="form-field">
                        <span>Malware scan result</span>
                        <select value={malwareScanStatus} onChange={(event) => setMalwareScanStatus(event.target.value as 'CLEAN' | 'REJECTED' | 'ERROR')}>
                          <option value="CLEAN">Clean</option>
                          <option value="REJECTED">Rejected</option>
                          <option value="ERROR">Scan error</option>
                        </select>
                      </label>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      Download the file and scan it with approved security software before recording a result. The application does not perform malware scanning itself.
                    </div>
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={scanConfirmed} onChange={(event) => setScanConfirmed(event.target.checked)} />
                      <span>I confirm I reviewed this document and completed the malware scan using approved security software.</span>
                    </label>
                    <button type="submit" className="btn btn-primary" disabled={busy || !scanConfirmed}>
                      {busy ? 'Saving review…' : 'Save review'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
