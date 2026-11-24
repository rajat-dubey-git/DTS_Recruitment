import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { workspaceApi } from '../../api/workspace'
import type { RequirementIntakeOptions } from '../../api/workspace'

type Props = {
  intakeId: number
  onClose: () => void
  onConverted: () => void
}

export default function RequirementConversionDialog({ intakeId, onClose, onConverted }: Props) {
  const [options, setOptions] = useState<RequirementIntakeOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    workspaceApi.requirementIntakeOptions(intakeId)
      .then((result) => {
        if (active) setOptions(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load conversion options.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [intakeId])

  const convert = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await workspaceApi.convertRequirementIntake(intakeId, {
        jobProfileId: Number(form.get('jobProfileId')),
        serviceOrderId: Number(form.get('serviceOrderId')),
      })
      onConverted()
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : 'Unable to convert this request.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="customer-modal-overlay">
      <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="convert-requirement-title">
        <div className="customer-modal-heading">
          <div>
            <h2 id="convert-requirement-title">Review and create requirement</h2>
            <p>Map this customer submission to an active job profile and an approved service order.</p>
          </div>
          <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {loading && <p className="database-read-only">Loading available profiles and service orders…</p>}
        {!loading && options && (
          <form onSubmit={(event) => void convert(event)}>
            <section className="requirement-review">
              <h3>{options.request.jobTitle} — {options.request.companyName}</h3>
              <p>{options.request.jobDescription}</p>
              <dl>
                <div><dt>Headcount</dt><dd>{options.request.headcount}</dd></div>
                <div><dt>Work mode</dt><dd>{options.request.workMode}</dd></div>
                <div><dt>Location</dt><dd>{options.request.workLocation || 'Not specified'}</dd></div>
                <div><dt>Experience</dt><dd>{options.request.experienceMinYears ?? '—'} to {options.request.experienceMaxYears ?? '—'} years</dd></div>
                <div><dt>Salary range</dt><dd>{options.request.salaryMin ?? '—'} to {options.request.salaryMax ?? '—'}</dd></div>
                <div><dt>Schedule</dt><dd>{options.request.employmentSchedule}{options.request.hoursPerWeek ? `, ${options.request.hoursPerWeek} hours/week` : ''}</dd></div>
                <div><dt>Target join date</dt><dd>{options.request.targetJoinDate || 'Not specified'}</dd></div>
              </dl>
            </section>
            <label>
              Active job profile *
              <select name="jobProfileId" required defaultValue="">
                <option value="">Select a job profile…</option>
                {options.jobProfiles.map((profile) => (
                  <option key={profile.job_profile_id} value={profile.job_profile_id}>
                    {profile.profile_code} — {profile.profile_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Approved service order for this customer *
              <select name="serviceOrderId" required defaultValue="">
                <option value="">Select a service order…</option>
                {options.serviceOrders.map((order) => (
                  <option key={order.service_order_id} value={order.service_order_id}>
                    {order.order_number} — {order.title} ({order.agreement_number})
                  </option>
                ))}
              </select>
            </label>
            {options.jobProfiles.length === 0 && <p className="customer-form-error">Create and activate a job profile before converting this request.</p>}
            {options.serviceOrders.length === 0 && <p className="customer-form-error">This customer has no approved or in-progress service order.</p>}
            {error && <div className="customer-form-error" role="alert">{error}</div>}
            <div className="customer-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={busy || options.jobProfiles.length === 0 || options.serviceOrders.length === 0}
              >
                {busy ? 'Converting…' : 'Create requirement'}
              </button>
            </div>
          </form>
        )}
        {!loading && error && !options && (
          <>
            <div className="customer-form-error" role="alert">{error}</div>
            <div className="customer-modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Close</button></div>
          </>
        )}
      </div>
    </div>
  )
}
