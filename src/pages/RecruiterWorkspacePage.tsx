import React, { useEffect, useState } from 'react'
import {
  Briefcase,
  Search,
  UserCheck,
  Share2,
  Clock,
  Eye,
  CheckCircle,
  AlertCircle,
  Users,
  FileText,
} from 'lucide-react'
import {
  Candidate,
  RecruiterRequirement,
  RequirementSubmission,
} from '../types/recruitment'
import {
  createResumeShare,
  fetchRecruiterRequirements,
  fetchRequirementSubmissions,
  searchCandidates,
  submitCandidateToRequirement,
} from '../api/recruitment'
import { DocumentPreviewModal } from '../components/DocumentPreviewModal'
import RecruiterCandidateDetailsModal from '../components/RecruiterCandidateDetailsModal'

export default function RecruiterWorkspacePage() {
  const [requirements, setRequirements] = useState<RecruiterRequirement[]>([])
  const [selectedReq, setSelectedReq] = useState<RecruiterRequirement | null>(null)
  const [submissions, setSubmissions] = useState<RequirementSubmission[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [activeTab, setActiveTab] = useState<'submissions' | 'search'>('submissions')

  // Search filters
  const [searchQuery, setSearchQuery] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [locFilter, setLocFilter] = useState('')
  const [expMin, setExpMin] = useState<number | undefined>(undefined)
  const [consentConfirmed, setConsentConfirmed] = useState(false)

  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Document modal preview
  const [previewShareId, setPreviewShareId] = useState<number | null>(null)
  const [previewCandidateName, setPreviewCandidateName] = useState('')
  const [previewExpiresAt, setPreviewExpiresAt] = useState<string | null>(null)
  const [detailCandidateId, setDetailCandidateId] = useState<number | null>(null)

  useEffect(() => {
    loadRequirements()
  }, [])

  useEffect(() => {
    if (selectedReq) {
      loadSubmissions(selectedReq.requirement_id)
      if (activeTab === 'search') {
        runCandidateSearch()
      }
    }
  }, [selectedReq, activeTab])

  useEffect(() => {
    setConsentConfirmed(false)
  }, [selectedReq?.requirement_id])

  async function loadRequirements() {
    try {
      setLoading(true)
      const data = await fetchRecruiterRequirements()
      setRequirements(data.requirements)
      if (data.requirements.length > 0 && !selectedReq) {
        setSelectedReq(data.requirements[0])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load requirements'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  async function loadSubmissions(requirementId: number) {
    try {
      const data = await fetchRequirementSubmissions(requirementId)
      setSubmissions(data.submissions)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load submissions'
      setStatusMessage({ type: 'error', text: msg })
    }
  }

  async function runCandidateSearch() {
    try {
      setLoading(true)
      const data = await searchCandidates({
        requirementId: selectedReq?.requirement_id,
        query: searchQuery || undefined,
        skill: skillFilter || undefined,
        location: locFilter || undefined,
        experienceMin: expMin,
      })
      setCandidates(data.candidates)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Candidate search failed'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handleCandidateSubmit(candidateId: number) {
    if (!selectedReq) return
    if (selectedReq.status !== 'OPEN') {
      setStatusMessage({ type: 'error', text: 'Only open requirements can receive candidate submissions.' })
      return
    }
    if (!consentConfirmed) {
      setStatusMessage({ type: 'error', text: 'Confirm candidate consent before submitting this profile.' })
      return
    }
    try {
      setLoading(true)
      const res = await submitCandidateToRequirement({
        candidateId,
        requirementId: selectedReq.requirement_id,
        consentConfirmed: true,
      })
      setStatusMessage({ type: 'success', text: res.message })
      setConsentConfirmed(false)
      await loadSubmissions(selectedReq.requirement_id)
      setActiveTab('submissions')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Submission failed'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateShare(applicationId: number) {
    if (!selectedReq) return
    try {
      setLoading(true)
      const res = await createResumeShare(applicationId)
      setStatusMessage({ type: 'success', text: res.message })
      await loadSubmissions(selectedReq.requirement_id)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate 24-hr share'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Recruiter Workspace</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage assigned customer requirements, screen candidate profiles, and dispatch 24-hour expiring resume packages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200">
            <Briefcase className="w-4 h-4" />
            {requirements.length} Active Positions
          </span>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-lg flex items-center justify-between text-sm ${
            statusMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-xs font-bold uppercase hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Left = Requirements List, Right = Details / Sourcing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Assigned Requirements */}
        <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
          <div className="p-4 border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 flex items-center justify-between">
            <span>Requirements</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{requirements.length}</span>
          </div>
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {requirements.map((req) => {
              const isSelected = selectedReq?.requirement_id === req.requirement_id
              return (
                <button
                  type="button"
                  key={req.requirement_id}
                  onClick={() => setSelectedReq(req)}
                  className={`block w-full p-4 text-left transition-colors ${
                    isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 tracking-wide uppercase">{req.requirement_code}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{req.status}</span>
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm mt-1">{req.job_title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{req.company_name}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-2">
                    <span>{req.open_positions} open position{req.open_positions > 1 ? 's' : ''}</span>
                    <span className="text-slate-600 font-medium">{req.total_submissions} submitted</span>
                  </div>
                </button>
              )
            })}
            {!loading && requirements.length === 0 && (
              <p className="p-5 text-sm text-slate-500">No requirements are assigned to your account.</p>
            )}
          </div>
        </div>

        {/* Right column: Action Workspace for Selected Requirement */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
          {selectedReq ? (
            <>
              {/* Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {selectedReq.requirement_code}
                    </span>
                    <h2 className="text-lg font-bold text-slate-800">{selectedReq.job_title}</h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customer: <span className="font-medium text-slate-700">{selectedReq.company_name}</span> | Target Profile:{' '}
                    <span className="font-medium text-slate-700">{selectedReq.job_profile_title || 'General'}</span>
                  </p>
                </div>
                {/* Tabs */}
                <div className="flex items-center bg-slate-200/80 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveTab('submissions')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'submissions' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Submissions ({submissions.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('search')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeTab === 'search' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5" />
                    Find Candidates
                  </button>
                </div>
              </div>

              <section className="border-b border-slate-200 p-5">
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div><p className="text-xs text-slate-500">Work location / mode</p><p className="font-medium text-slate-800">{selectedReq.work_location || 'Not specified'} · {selectedReq.work_mode}</p></div>
                  <div><p className="text-xs text-slate-500">Experience</p><p className="font-medium text-slate-800">{selectedReq.experience_min_years ?? 0}–{selectedReq.experience_max_years ?? 'Any'} years</p></div>
                  <div><p className="text-xs text-slate-500">Employment</p><p className="font-medium text-slate-800">{selectedReq.employment_schedule.replace('_', ' ')}{selectedReq.hours_per_week ? ` · ${selectedReq.hours_per_week} hrs/week` : ''}</p></div>
                  <div><p className="text-xs text-slate-500">Salary range</p><p className="font-medium text-slate-800">{selectedReq.salary_min ?? 'Not listed'} – {selectedReq.salary_max ?? 'Not listed'}</p></div>
                  <div><p className="text-xs text-slate-500">Target join date</p><p className="font-medium text-slate-800">{selectedReq.target_join_date ? new Date(selectedReq.target_join_date).toLocaleDateString() : 'Not specified'}</p></div>
                  <div><p className="text-xs text-slate-500">Assignment</p><p className="font-medium text-slate-800">{selectedReq.assignment_role}</p></div>
                </div>
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Full requirement description</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selectedReq.job_description || 'No description provided.'}</p>
                </div>
              </section>

              {/* Tab 1: Current Submissions & 24h Sharing */}
              {activeTab === 'submissions' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {submissions.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                      <p className="font-medium text-slate-600">No candidates submitted yet</p>
                      <p className="text-xs text-slate-400 mt-1">Switch to "Find Candidates" tab to screen and attach talent.</p>
                    </div>
                  ) : (
                    submissions.map((sub) => (
                      <div
                        key={sub.application_id}
                        className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-200 transition-all shadow-sm"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm">{sub.candidate_name}</h4>
                              <span
                                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                sub.application_status === 'SHORTLISTED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                  : sub.application_status === 'REJECTED'
                                    ? 'bg-rose-100 text-rose-800'
                                  : sub.application_status === 'INTERVIEW'
                                    ? 'bg-purple-100 text-purple-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {sub.application_status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              {sub.total_experience_years} yrs exp | Location: {sub.current_location} | Skills: {sub.primary_skills}
                            </p>
                          </div>

                          {/* Share & Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setDetailCandidateId(sub.candidate_id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5" /> Profile
                            </button>
                            {sub.share_id && sub.share_is_valid ? (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setPreviewShareId(sub.share_id)
                                    setPreviewCandidateName(sub.candidate_name)
                                    setPreviewExpiresAt(sub.access_expires_at)
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Preview
                                </button>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                  <Clock className="w-3 h-3 text-emerald-600" />
                                  Active 24h Share
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                {sub.share_id && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                                    <AlertCircle className="w-3 h-3 text-rose-600" />
                                    Expired
                                  </span>
                                )}
                                {sub.resume_verification_status === 'VERIFIED' && sub.resume_malware_scan_status === 'CLEAN' ? (
                                  <button
                                    onClick={() => handleGenerateShare(sub.application_id)}
                                    disabled={loading}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    Create 24h customer share
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-amber-700">Resume requires admin verification and a clean scan.</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Candidate Search & Submission */}
              {activeTab === 'search' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Search filters */}
                  <label className="flex items-start gap-2 p-4 text-xs text-slate-600 border-b border-slate-200 bg-amber-50">
                    <input
                      type="checkbox"
                      checked={consentConfirmed}
                      onChange={(event) => setConsentConfirmed(event.target.checked)}
                    />
                    <span>I confirm the candidate has explicitly consented to be represented for this requirement and to sharing their profile with the customer.</span>
                  </label>
                  <div className="p-4 border-b border-slate-200 bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input
                      type="text"
                      placeholder="Keyword / Name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Skills (e.g. React, Java)..."
                      value={skillFilter}
                      onChange={(e) => setSkillFilter(e.target.value)}
                      className="text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Location (e.g. Pune, Remote)..."
                      value={locFilter}
                      onChange={(e) => setLocFilter(e.target.value)}
                      className="text-xs px-3 py-2 border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Min Exp"
                        value={expMin ?? ''}
                        onChange={(e) => setExpMin(e.target.value ? Number(e.target.value) : undefined)}
                        className="text-xs px-3 py-2 border border-slate-300 rounded-md bg-white w-24 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={runCandidateSearch}
                        className="flex-1 text-xs font-semibold py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {/* Candidates Result list */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {candidates.length === 0 ? (
                      <div className="text-center py-12 text-slate-400">
                        <p className="text-sm">No candidates match current criteria.</p>
                      </div>
                    ) : (
                      candidates.map((cand) => (
                        <div
                          key={cand.candidate_id}
                          className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm hover:border-blue-200"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-slate-800 text-sm">{cand.full_name}</h4>
                              <span className="text-xs text-slate-500">{cand.candidate_code}</span>
                              {cand.match_score !== null && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                  {cand.match_score}% skill match
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              <strong>Exp:</strong> {cand.total_experience_years}y | <strong>Location:</strong> {cand.current_location} |{' '}
                              <strong>Notice:</strong> {cand.notice_period_days} days | <strong>Expected:</strong> ₹{cand.expected_ctc ?? 'N/A'} LPA
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              <strong>Skills:</strong> {cand.primary_skills}
                            </p>
                            {cand.missing_mandatory_skills.length > 0 && (
                              <p className="mt-1 text-xs text-rose-700"><strong>Missing required:</strong> {cand.missing_mandatory_skills.join(', ')}</p>
                            )}
                            {!cand.meets_experience && <p className="mt-1 text-xs text-amber-700">Outside the target experience range.</p>}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setDetailCandidateId(cand.candidate_id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              <FileText className="w-3.5 h-3.5" /> Full profile
                            </button>
                            <button
                              onClick={() => handleCandidateSubmit(cand.candidate_id)}
                              disabled={loading || !consentConfirmed || selectedReq.status !== 'OPEN'}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition shadow-sm"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Screen & Submit
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              Select a requirement on the left to begin screening and sharing.
            </div>
          )}
        </div>
      </div>

      {/* Document In-Browser Preview Modal */}
      <DocumentPreviewModal
        shareId={previewShareId}
        candidateName={previewCandidateName}
        isOpen={Boolean(previewShareId)}
        onClose={() => setPreviewShareId(null)}
        expiresAt={previewExpiresAt}
      />
      <RecruiterCandidateDetailsModal
        candidateId={detailCandidateId}
        requirementId={selectedReq?.requirement_id ?? null}
        onClose={() => setDetailCandidateId(null)}
      />
    </div>
  )
}
