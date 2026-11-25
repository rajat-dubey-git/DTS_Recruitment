import { useEffect, useState } from 'react'
import { Download, FileText, X } from 'lucide-react'
import { fetchRecruiterCandidateDetails } from '../api/recruitment'
import type { RecruiterCandidateDetails } from '../types/recruitment'

type Props = {
  candidateId: number | null
  requirementId: number | null
  onClose: () => void
}

function formatBytes(bytes: number | null) {
  if (!bytes) return 'Size unavailable'
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function RecruiterCandidateDetailsModal({ candidateId, requirementId, onClose }: Props) {
  const [details, setDetails] = useState<RecruiterCandidateDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (candidateId === null) return
    let active = true
    setDetails(null)
    setError('')
    setLoading(true)
    fetchRecruiterCandidateDetails(candidateId, requirementId ?? undefined)
      .then((result) => {
        if (active) setDetails(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load candidate details.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [candidateId, requirementId])

  if (candidateId === null) return null
  const candidate = details?.candidate
  const resume = details?.resume
  const resumeUrl = resume?.download_url || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="candidate-details-title">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Candidate profile</p>
            <h2 id="candidate-details-title" className="mt-1 text-xl font-bold text-slate-800">
              {candidate ? `${candidate.first_name} ${candidate.last_name || ''}`.trim() : 'Candidate details'}
            </h2>
            {candidate && <p className="mt-1 text-xs text-slate-500">{candidate.candidate_code} · {candidate.status}</p>}
          </div>
          <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-200" aria-label="Close candidate details" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && <p className="text-sm text-slate-500" role="status">Loading candidate details…</p>}
          {error && <div className="form-error" role="alert">{error}</div>}
          {details && candidate && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-5">
                <section className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-800">Contact and career summary</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div><dt className="text-xs text-slate-500">Email</dt><dd className="break-all text-slate-800">{candidate.email || 'Not listed'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Mobile</dt><dd className="text-slate-800">{candidate.mobile}</dd></div>
                    <div><dt className="text-xs text-slate-500">Location</dt><dd className="text-slate-800">{[candidate.current_city, candidate.current_state].filter(Boolean).join(', ') || 'Not listed'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Experience</dt><dd className="text-slate-800">{candidate.total_experience_years ?? 'Not listed'} years</dd></div>
                    <div><dt className="text-xs text-slate-500">Current CTC</dt><dd className="text-slate-800">{candidate.current_ctc ?? 'Not listed'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Expected CTC</dt><dd className="text-slate-800">{candidate.expected_ctc ?? 'Not listed'}</dd></div>
                    <div><dt className="text-xs text-slate-500">Notice period</dt><dd className="text-slate-800">{candidate.notice_period_days ?? 'Not listed'} days</dd></div>
                  </dl>
                  {candidate.profile_summary && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">{candidate.profile_summary}</p>}
                </section>

                {details.match && (
                  <section className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-slate-800">Requirement match</h3>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                        {details.match.score === null ? 'No skill profile' : `${details.match.score}% skills`}
                      </span>
                    </div>
                    <p className={`mt-2 text-sm ${details.match.meetsExperience ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {details.match.meetsExperience ? 'Meets' : 'Does not meet'} the requirement experience range.
                    </p>
                    {details.match.matchedSkills.length > 0 && <p className="mt-2 text-sm text-slate-700">Matched: {details.match.matchedSkills.join(', ')}</p>}
                    {details.match.missingMandatorySkills.length > 0 && <p className="mt-2 text-sm text-rose-700">Missing required skills: {details.match.missingMandatorySkills.join(', ')}</p>}
                  </section>
                )}

                <section className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-800">Skills</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {details.skills.length ? details.skills.map((skill) => (
                      <span key={skill.skill_id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                        {skill.skill_name}{skill.experience_years !== null ? ` · ${skill.experience_years}y` : ''}{skill.proficiency ? ` · ${skill.proficiency.toLowerCase()}` : ''}
                      </span>
                    )) : <p className="text-sm text-slate-500">No skills listed.</p>}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-800">Education</h3>
                  <div className="mt-3 space-y-3">
                    {details.education.length ? details.education.map((education) => (
                      <div key={education.education_id} className="border-l-2 border-blue-200 pl-3">
                        <p className="text-sm font-medium text-slate-800">{education.qualification}{education.specialization ? ` · ${education.specialization}` : ''}</p>
                        <p className="text-xs text-slate-500">{education.institution || 'Institution not listed'} · {education.passing_year || 'Year not listed'}{education.grade_or_percentage ? ` · ${education.grade_or_percentage}` : ''}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No education records.</p>}
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 p-4">
                  <h3 className="font-semibold text-slate-800">Work experience</h3>
                  <div className="mt-3 space-y-3">
                    {details.experience.length ? details.experience.map((experience) => (
                      <div key={experience.experience_id} className="border-l-2 border-slate-200 pl-3">
                        <p className="text-sm font-medium text-slate-800">{experience.designation}</p>
                        <p className="text-xs text-slate-500">{experience.employer_name} · {experience.start_date?.slice(0, 10) || 'Start not listed'} – {experience.is_current ? 'Present' : experience.end_date?.slice(0, 10) || 'End not listed'}</p>
                      </div>
                    )) : <p className="text-sm text-slate-500">No work experience records.</p>}
                  </div>
                </section>
              </div>

              <section className="flex min-h-[24rem] flex-col rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-800">Resume</h3>
                    {resume && <p className="mt-1 text-xs text-slate-500">{resume.file_name} · {formatBytes(resume.file_size_bytes)}</p>}
                  </div>
                  {resume?.available && (
                    <a className="btn btn-outline" href={resumeUrl} download>
                      <Download size={15} /> Download
                    </a>
                  )}
                </div>
                {resume?.available ? (
                  <iframe className="mt-4 min-h-[28rem] flex-1 rounded border border-slate-200" title={`${candidate.first_name}'s resume`} src={resumeUrl} />
                ) : (
                  <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-lg bg-amber-50 p-6 text-center">
                    <FileText size={28} className="text-amber-700" />
                    <p className="mt-3 text-sm font-medium text-amber-900">
                      {resume
                        ? `Resume is unavailable until reviewed (${resume.verification_status}; scan ${resume.malware_scan_status}).`
                        : 'No current resume is on file.'}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">Only verified, security-cleared resumes can be opened or shared.</p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
