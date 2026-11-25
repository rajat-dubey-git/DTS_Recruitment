import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BookOpen, BriefcaseBusiness, Save, UserRound } from 'lucide-react'
import { candidateApi } from '../api/candidate'
import type {
  CandidateEducation,
  CandidateExperience,
  CandidateSkill,
} from '../api/candidate'

type ProfileData = Awaited<ReturnType<typeof candidateApi.profile>>
type SkillOption = { skill_id: number; skill_name: string; skill_category: string | null }

const emptyEducation = {
  qualification: '',
  specialization: '',
  institution: '',
  passingYear: '',
  grade: '',
}
const emptyExperience = {
  employerName: '',
  designation: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
}

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

export default function CandidateProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [skillOptions, setSkillOptions] = useState<SkillOption[]>([])
  const [profileForm, setProfileForm] = useState<Record<string, string>>({})
  const [selectedSkills, setSelectedSkills] = useState<number[]>([])
  const [educationForm, setEducationForm] = useState(emptyEducation)
  const [educationId, setEducationId] = useState<number | undefined>()
  const [experienceForm, setExperienceForm] = useState(emptyExperience)
  const [experienceId, setExperienceId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function loadProfile() {
    setError('')
    const [profileResult, skillResult] = await Promise.all([
      candidateApi.profile(),
      candidateApi.skillOptions(),
    ])
    setData(profileResult)
    setSkillOptions(skillResult.skills)
    setSelectedSkills(profileResult.skills.map((skill: CandidateSkill) => Number(skill.skill_id)))
    const profile = profileResult.profile
    setProfileForm({
      email: profile.email || '',
      mobile: profile.mobile || '',
      current_city: profile.current_city || '',
      current_state: profile.current_state || '',
      total_experience_years: profile.total_experience_years == null ? '' : String(profile.total_experience_years),
      current_ctc: profile.current_ctc == null ? '' : String(profile.current_ctc),
      expected_ctc: profile.expected_ctc == null ? '' : String(profile.expected_ctc),
      notice_period_days: profile.notice_period_days == null ? '' : String(profile.notice_period_days),
      profile_summary: profile.profile_summary || '',
    })
  }

  useEffect(() => {
    let active = true
    Promise.all([candidateApi.profile(), candidateApi.skillOptions()])
      .then(([profileResult, skillResult]) => {
        if (!active) return
        setData(profileResult)
        setSkillOptions(skillResult.skills)
        setSelectedSkills(profileResult.skills.map((skill: CandidateSkill) => Number(skill.skill_id)))
        const profile = profileResult.profile
        setProfileForm({
          email: profile.email || '',
          mobile: profile.mobile || '',
          current_city: profile.current_city || '',
          current_state: profile.current_state || '',
          total_experience_years: profile.total_experience_years == null ? '' : String(profile.total_experience_years),
          current_ctc: profile.current_ctc == null ? '' : String(profile.current_ctc),
          expected_ctc: profile.expected_ctc == null ? '' : String(profile.expected_ctc),
          notice_period_days: profile.notice_period_days == null ? '' : String(profile.notice_period_days),
          profile_summary: profile.profile_summary || '',
        })
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load candidate profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('profile')
    setError('')
    setMessage('')
    try {
      const numberValue = (value: string) => value.trim() === '' ? null : Number(value)
      await candidateApi.updateProfile({
        email: profileForm.email.trim() || null,
        mobile: profileForm.mobile.trim(),
        current_city: profileForm.current_city.trim() || null,
        current_state: profileForm.current_state.trim() || null,
        total_experience_years: numberValue(profileForm.total_experience_years),
        current_ctc: numberValue(profileForm.current_ctc),
        expected_ctc: numberValue(profileForm.expected_ctc),
        notice_period_days: numberValue(profileForm.notice_period_days),
        profile_summary: profileForm.profile_summary.trim() || null,
      })
      await loadProfile()
      setMessage('Profile details saved.')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save profile details.')
    } finally {
      setBusy('')
    }
  }

  async function saveEducation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('education')
    setError('')
    setMessage('')
    try {
      await candidateApi.saveEducation({ ...educationForm, educationId })
      setEducationForm(emptyEducation)
      setEducationId(undefined)
      await loadProfile()
      setMessage('Education details saved.')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save education details.')
    } finally {
      setBusy('')
    }
  }

  async function saveExperience(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy('experience')
    setError('')
    setMessage('')
    try {
      await candidateApi.saveExperience({ ...experienceForm, experienceId })
      setExperienceForm(emptyExperience)
      setExperienceId(undefined)
      await loadProfile()
      setMessage('Work experience saved.')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save work experience.')
    } finally {
      setBusy('')
    }
  }

  async function saveSkills() {
    setBusy('skills')
    setError('')
    setMessage('')
    try {
      await candidateApi.updateSkills(selectedSkills)
      await loadProfile()
      setMessage('Skills updated.')
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update skills.')
    } finally {
      setBusy('')
    }
  }

  if (loading) return <div className="panel database-message" role="status">Loading your profile…</div>
  if (!data) return <div className="form-error" role="alert">{error || 'No candidate profile is linked to this account.'}</div>

  const updateProfileField = (key: string, value: string) => {
    setProfileForm((current) => ({ ...current, [key]: value }))
  }
  const updateEducationField = (key: keyof typeof emptyEducation, value: string) => {
    setEducationForm((current) => ({ ...current, [key]: value }))
  }
  const updateExperienceField = (key: keyof typeof emptyExperience, value: string | boolean) => {
    setExperienceForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Candidate account</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">My profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          Update your contact details, skills, education and work experience. Your candidate ID is {data.profile.candidate_code}.
        </p>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <form onSubmit={(event) => void saveProfile(event)} className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-2">
          <UserRound size={18} className="text-blue-700" />
          <h2 className="font-semibold text-slate-800">Contact and career details</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="form-field"><span>First name</span><input value={data.profile.first_name} readOnly /></label>
          <label className="form-field"><span>Last name</span><input value={data.profile.last_name || ''} readOnly /></label>
          <label className="form-field"><span>Email</span><input type="email" value={profileForm.email || ''} onChange={(event) => updateProfileField('email', event.target.value)} /></label>
          <label className="form-field"><span>Mobile *</span><input required value={profileForm.mobile || ''} onChange={(event) => updateProfileField('mobile', event.target.value)} /></label>
          <label className="form-field"><span>City</span><input value={profileForm.current_city || ''} onChange={(event) => updateProfileField('current_city', event.target.value)} /></label>
          <label className="form-field"><span>State</span><input value={profileForm.current_state || ''} onChange={(event) => updateProfileField('current_state', event.target.value)} /></label>
          <label className="form-field"><span>Total experience (years)</span><input type="number" min="0" max="999.9" step="0.1" value={profileForm.total_experience_years || ''} onChange={(event) => updateProfileField('total_experience_years', event.target.value)} /></label>
          <label className="form-field"><span>Notice period (days)</span><input type="number" min="0" step="1" value={profileForm.notice_period_days || ''} onChange={(event) => updateProfileField('notice_period_days', event.target.value)} /></label>
          <label className="form-field"><span>Current CTC</span><input type="number" min="0" step="0.01" value={profileForm.current_ctc || ''} onChange={(event) => updateProfileField('current_ctc', event.target.value)} /></label>
          <label className="form-field"><span>Expected CTC</span><input type="number" min="0" step="0.01" value={profileForm.expected_ctc || ''} onChange={(event) => updateProfileField('expected_ctc', event.target.value)} /></label>
          <label className="form-field md:col-span-2"><span>Profile summary</span><textarea rows={4} maxLength={5000} value={profileForm.profile_summary || ''} onChange={(event) => updateProfileField('profile_summary', event.target.value)} /></label>
        </div>
        <button type="submit" className="btn btn-primary mt-5" disabled={busy !== ''}>
          <Save size={15} /> {busy === 'profile' ? 'Saving…' : 'Save profile'}
        </button>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-700" />
            <h2 className="font-semibold text-slate-800">Skills</h2>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => void saveSkills()} disabled={busy !== ''}>
            {busy === 'skills' ? 'Saving…' : 'Save skills'}
          </button>
        </div>
        {skillOptions.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {skillOptions.map((skill) => (
              <label key={skill.skill_id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedSkills.includes(skill.skill_id)}
                  onChange={(event) => setSelectedSkills((current) => (
                    event.target.checked
                      ? [...current, skill.skill_id]
                      : current.filter((id) => id !== skill.skill_id)
                  ))}
                />
                <span>{skill.skill_name}</span>
                {skill.skill_category && <span className="ml-auto text-xs text-slate-400">{skill.skill_category}</span>}
              </label>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">The skill catalog is empty. Contact an administrator.</p>}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-700" />
            <h2 className="font-semibold text-slate-800">Education</h2>
          </div>
          <div className="mb-5 space-y-3">
            {data.education.map((education: CandidateEducation) => (
              <article key={education.education_id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{education.qualification}{education.specialization ? ` · ${education.specialization}` : ''}</p>
                    <p className="text-sm text-slate-500">{education.institution || 'Institution not listed'} · {education.passing_year || 'Year not listed'}</p>
                  </div>
                  <button type="button" className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => {
                    setEducationId(education.education_id)
                    setEducationForm({
                      qualification: education.qualification,
                      specialization: education.specialization || '',
                      institution: education.institution || '',
                      passingYear: education.passing_year ? String(education.passing_year) : '',
                      grade: education.grade_or_percentage || '',
                    })
                  }}>Edit</button>
                </div>
              </article>
            ))}
            {!data.education.length && <p className="text-sm text-slate-500">No education records added.</p>}
          </div>
          <form onSubmit={(event) => void saveEducation(event)} className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">{educationId ? 'Edit education' : 'Add education'}</h3>
            <input required placeholder="Qualification" value={educationForm.qualification} onChange={(event) => updateEducationField('qualification', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Specialization" value={educationForm.specialization} onChange={(event) => updateEducationField('specialization', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input placeholder="Institution" value={educationForm.institution} onChange={(event) => updateEducationField('institution', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" min="1900" max="2100" placeholder="Passing year" value={educationForm.passingYear} onChange={(event) => updateEducationField('passingYear', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input placeholder="Grade / percentage" value={educationForm.grade} onChange={(event) => updateEducationField('grade', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy !== ''}>{busy === 'education' ? 'Saving…' : 'Save education'}</button>
              {educationId && <button type="button" className="btn btn-outline" onClick={() => { setEducationId(undefined); setEducationForm(emptyEducation) }}>Cancel edit</button>}
            </div>
          </form>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <BriefcaseBusiness size={18} className="text-blue-700" />
            <h2 className="font-semibold text-slate-800">Work experience</h2>
          </div>
          <div className="mb-5 space-y-3">
            {data.experience.map((experience: CandidateExperience) => (
              <article key={experience.experience_id} className="rounded-lg bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-800">{experience.designation}</p>
                    <p className="text-sm text-slate-500">{experience.employer_name} · {dateInput(experience.start_date)} – {experience.is_current ? 'Present' : dateInput(experience.end_date) || 'End date not listed'}</p>
                  </div>
                  <button type="button" className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => {
                    setExperienceId(experience.experience_id)
                    setExperienceForm({
                      employerName: experience.employer_name,
                      designation: experience.designation,
                      startDate: dateInput(experience.start_date),
                      endDate: dateInput(experience.end_date),
                      isCurrent: Boolean(experience.is_current),
                    })
                  }}>Edit</button>
                </div>
              </article>
            ))}
            {!data.experience.length && <p className="text-sm text-slate-500">No work experience added.</p>}
          </div>
          <form onSubmit={(event) => void saveExperience(event)} className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-700">{experienceId ? 'Edit experience' : 'Add experience'}</h3>
            <input required placeholder="Employer" value={experienceForm.employerName} onChange={(event) => updateExperienceField('employerName', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input required placeholder="Designation" value={experienceForm.designation} onChange={(event) => updateExperienceField('designation', event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <label className="form-field"><span>Start date</span><input type="date" value={experienceForm.startDate} onChange={(event) => updateExperienceField('startDate', event.target.value)} /></label>
              <label className="form-field"><span>End date</span><input type="date" value={experienceForm.endDate} disabled={experienceForm.isCurrent} onChange={(event) => updateExperienceField('endDate', event.target.value)} /></label>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={experienceForm.isCurrent} onChange={(event) => updateExperienceField('isCurrent', event.target.checked)} />
              I currently work here
            </label>
            <div className="flex gap-2">
              <button type="submit" className="btn btn-primary" disabled={busy !== ''}>{busy === 'experience' ? 'Saving…' : 'Save experience'}</button>
              {experienceId && <button type="button" className="btn btn-outline" onClick={() => { setExperienceId(undefined); setExperienceForm(emptyExperience) }}>Cancel edit</button>}
            </div>
          </form>
        </div>
      </section>
    </div>
  )
}
