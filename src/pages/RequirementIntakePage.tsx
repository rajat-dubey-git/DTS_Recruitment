import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { workspaceApi } from '../api/workspace'
import type { RequirementIntakeForm } from '../api/workspace'

export default function RequirementIntakePage() {
  const { token = '' } = useParams()
  const [intake, setIntake] = useState<RequirementIntakeForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let active = true
    workspaceApi.getPublicRequirementIntake(token)
      .then((result) => {
        if (active) setIntake(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'This form link is invalid or expired.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [token])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await workspaceApi.submitPublicRequirementIntake(token, {
        jobTitle: form.get('jobTitle'),
        jobDescription: form.get('jobDescription'),
        headcount: form.get('headcount'),
        workMode: form.get('workMode'),
        workLocation: form.get('workLocation'),
        experienceMinYears: form.get('experienceMinYears'),
        experienceMaxYears: form.get('experienceMaxYears'),
        salaryMin: form.get('salaryMin'),
        salaryMax: form.get('salaryMax'),
        employmentSchedule: form.get('employmentSchedule'),
        hoursPerWeek: form.get('hoursPerWeek'),
        targetJoinDate: form.get('targetJoinDate'),
      })
      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the requirement form.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="public-intake-page">
      <section className="public-intake-card">
        <div className="eyebrow">DTS RECRUITMENT</div>
        {loading ? <h1>Loading requirement form…</h1> : null}
        {!loading && error && !intake && (
          <>
            <h1>Form unavailable</h1>
            <p>{error}</p>
            <Link to="/" className="btn btn-outline">Return to DTS Recruitment</Link>
          </>
        )}
        {!loading && intake && !submitted && (
          <>
            <h1>Hiring requirement</h1>
            <p className="public-intake-intro">Submit your hiring needs for <strong>{intake.companyName}</strong>. Our team will review the details before creating a requirement.</p>
            <form onSubmit={(event) => void submit(event)}>
              <label>Job title *<input name="jobTitle" maxLength={150} required /></label>
              <label>Job description and responsibilities *<textarea name="jobDescription" maxLength={60000} rows={6} required /></label>
              <div className="public-intake-grid">
                <label>Headcount *<input name="headcount" type="number" min={1} max={65535} step={1} required /></label>
                <label>Work mode *
                  <select name="workMode" required defaultValue="">
                    <option value="">Select…</option>
                    <option value="ONSITE">On-site</option>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>
                </label>
              </div>
              <label>Work location<input name="workLocation" maxLength={150} /></label>
              <div className="public-intake-grid">
                <label>Minimum experience (years)<input name="experienceMinYears" type="number" min={0} max={999.9} step={0.1} /></label>
                <label>Maximum experience (years)<input name="experienceMaxYears" type="number" min={0} max={999.9} step={0.1} /></label>
              </div>
              <div className="public-intake-grid">
                <label>Minimum salary<input name="salaryMin" type="number" min={0} max={9999999999.99} step={0.01} /></label>
                <label>Maximum salary<input name="salaryMax" type="number" min={0} max={9999999999.99} step={0.01} /></label>
              </div>
              <div className="public-intake-grid">
                <label>Employment schedule *
                  <select name="employmentSchedule" required defaultValue="">
                    <option value="">Select…</option>
                    <option value="FULL_TIME">Full-time</option>
                    <option value="PART_TIME">Part-time</option>
                  </select>
                </label>
                <label>Hours per week<input name="hoursPerWeek" type="number" min={0.01} max={168} step={0.01} /></label>
              </div>
              <label>Target joining date<input name="targetJoinDate" type="date" /></label>
              {error && <div className="customer-form-error" role="alert">{error}</div>}
              <button type="submit" className="btn btn-primary public-intake-submit" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit requirement'}
              </button>
            </form>
          </>
        )}
        {submitted && (
          <>
            <h1>Requirement submitted</h1>
            <p>Your hiring request has been sent to the DTS team for review. It will be linked to the applicable service order and job profile before becoming an internal requirement.</p>
          </>
        )}
      </section>
    </main>
  )
}
