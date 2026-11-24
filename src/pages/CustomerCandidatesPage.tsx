import React, { useEffect, useState } from 'react'
import {
  Users,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Clock,
  Eye,
  Building,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import { CustomerSharedCandidate } from '../types/recruitment'
import { fetchCustomerSharedCandidates, submitCandidateDecision } from '../api/recruitment'
import { DocumentPreviewModal } from '../components/DocumentPreviewModal'

export default function CustomerCandidatesPage() {
  const [candidates, setCandidates] = useState<CustomerSharedCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Decision Modal State
  const [decisionModal, setDecisionModal] = useState<{
    shareId: number
    candidateName: string
    action: 'SHORTLIST' | 'REJECT' | 'HOLD'
  } | null>(null)
  const [decisionNotes, setDecisionNotes] = useState('')

  // Preview Modal
  const [previewShareId, setPreviewShareId] = useState<number | null>(null)
  const [previewCandidateName, setPreviewCandidateName] = useState('')
  const [previewExpiresAt, setPreviewExpiresAt] = useState<string | null>(null)

  useEffect(() => {
    loadSharedCandidates()
  }, [])

  async function loadSharedCandidates() {
    try {
      setLoading(true)
      const data = await fetchCustomerSharedCandidates()
      setCandidates(data.candidates)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load candidates'
      setStatusMessage({ type: 'error', text: msg })
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmDecision() {
    if (!decisionModal) return
    try {
      setLoading(true)
      const res = await submitCandidateDecision(
        decisionModal.shareId,
        decisionModal.action,
        decisionNotes || undefined
      )
      setStatusMessage({ type: 'success', text: res.message })
      setDecisionModal(null)
      setDecisionNotes('')
      await loadSharedCandidates()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Decision recording failed'
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
          <h1 className="text-2xl font-bold text-slate-800">Candidate Profiles</h1>
          <p className="text-sm text-slate-500 mt-1">
            Review vetted candidate submissions from DTS Consulting, preview watermarked resumes, and record decisions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200">
            <Users className="w-4 h-4" />
            {candidates.length} Profiles Presented
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

      {/* Candidate Cards Grid */}
      {candidates.length === 0 && !loading ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Users className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <h3 className="text-slate-700 font-semibold">No candidates under review</h3>
          <p className="text-xs text-slate-400 mt-1">
            Your DTS recruitment team will present verified candidate profiles here as they are screened.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {candidates.map((cand) => {
            const isExpired = !cand.is_accessible

            return (
              <div
                key={cand.share_id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                {/* Header */}
                <div className="p-5 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 flex items-center gap-1">
                      <Building className="w-3 h-3" />
                      {cand.requirement_code}
                    </span>

                    {/* Expiration Badge */}
                    {isExpired ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Expired (24h)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(cand.minutes_remaining / 60)}h {cand.minutes_remaining % 60}m left
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mt-2">{cand.candidate_name}</h3>
                  <p className="text-xs text-slate-500 font-medium">{cand.job_title}</p>
                </div>

                {/* Details */}
                <div className="p-5 space-y-3 flex-1 text-xs text-slate-600">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Experience</span>
                      <strong className="text-slate-800">{cand.total_experience_years} Years</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Location</span>
                      <strong className="text-slate-800">{cand.current_location}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Notice Period</span>
                      <strong className="text-slate-800">{cand.notice_period_days} Days</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Expected CTC</span>
                      <strong className="text-slate-800">₹{cand.expected_ctc ?? 'N/A'} LPA</strong>
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Core Skills</span>
                    <p className="font-medium text-slate-700 truncate">{cand.primary_skills}</p>
                  </div>

                  {cand.screening_notes && (
                    <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Recruiter Assessment
                      </span>
                      <p className="text-slate-600 italic text-[11px] mt-0.5">"{cand.screening_notes}"</p>
                    </div>
                  )}

                  {/* Customer current decision status */}
                  {cand.customer_decision && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Status: </span>
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-xs ${
                          cand.customer_decision === 'SHORTLIST'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cand.customer_decision === 'REJECT'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {cand.customer_decision}
                      </span>
                      {cand.decision_notes && (
                        <p className="text-[11px] text-slate-500 mt-1 italic">Notes: {cand.decision_notes}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
                  <button
                    onClick={() => {
                      setPreviewShareId(cand.share_id)
                      setPreviewCandidateName(cand.candidate_name)
                      setPreviewExpiresAt(cand.access_expires_at)
                    }}
                    disabled={isExpired}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-blue-700 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Preview Resume & Profile
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() =>
                        setDecisionModal({
                          shareId: cand.share_id,
                          candidateName: cand.candidate_name,
                          action: 'SHORTLIST',
                        })
                      }
                      className="py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition inline-flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Shortlist
                    </button>
                    <button
                      onClick={() =>
                        setDecisionModal({
                          shareId: cand.share_id,
                          candidateName: cand.candidate_name,
                          action: 'HOLD',
                        })
                      }
                      className="py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition inline-flex items-center justify-center gap-1"
                    >
                      <PauseCircle className="w-3 h-3" />
                      Hold
                    </button>
                    <button
                      onClick={() =>
                        setDecisionModal({
                          shareId: cand.share_id,
                          candidateName: cand.candidate_name,
                          action: 'REJECT',
                        })
                      }
                      className="py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition inline-flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Decision Dialog */}
      {decisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              Confirm Decision: {decisionModal.action}
            </h3>
            <p className="text-sm text-slate-600">
              Candidate: <strong>{decisionModal.candidateName}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Feedback / Notes for Recruiter</label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Optional notes or interview availability..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDecisionModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                disabled={loading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Confirm Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document In-Browser Preview Modal */}
      <DocumentPreviewModal
        shareId={previewShareId}
        candidateName={previewCandidateName}
        isOpen={Boolean(previewShareId)}
        onClose={() => setPreviewShareId(null)}
        expiresAt={previewExpiresAt}
      />
    </div>
  )
}
