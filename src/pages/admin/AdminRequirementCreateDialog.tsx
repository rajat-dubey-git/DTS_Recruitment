import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { workspaceApi } from '../../api/workspace'
import type { RequirementCreationOptions } from '../../api/workspace'

type Props = {
  onClose: () => void
  onSaved: () => void
}

export default function AdminRequirementCreateDialog({ onClose, onSaved }: Props) {
  const [options, setOptions] = useState<RequirementCreationOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    workspaceApi.requirementCreationOptions()
      .then((result) => {
        if (active) setOptions(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load requirement options.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const values = Object.fromEntries(form.entries())

    try {
      await workspaceApi.createRequirement(values)
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create the requirement.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="customer-modal-overlay">
      <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-requirement-title">
        <div className="customer-modal-heading">
          <div>
            <h2 id="admin-requirement-title">Add customer requirement</h2>
            <p>Requirements start as pending approval and must use an active profile and approved service order.</p>
          </div>
          <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {loading && <p className="database-read-only">Loading active profiles and approved service orders…</p>}
        {!loading && options && (
          <form onSubmit={(event) => void submit(event)}>
            <label>
              Requirement number *
              <input name="requirementNumber" maxLength={50} required />
            </label>
            <label>
              Customer service order *
              <select name="serviceOrderId" required defaultValue="">
                <option value="">Select a service order…</option>
                {options.serviceOrders.map((order) => (
                  <option key={order.service_order_id} value={order.service_order_id}>
                    {order.company_name} — {order.order_number}: {order.title} ({order.agreement_number})
                  </option>
                ))}
              </select>
            </label>
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
            <label>Job title *<input name="jobTitle" maxLength={150} required /></label>
            <label>Job description and responsibilities *<textarea name="jobDescription" maxLength={60000} rows={4} required /></label>
            <div className="public-intake-grid">
              <label>Headcount *<input name="headcount" type="number" min={1} max={65535} step={1} required /></label>
              <label>
                Work mode *
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
              <label>
                Employment schedule *
                <select name="employmentSchedule" required defaultValue="">
                  <option value="">Select…</option>
                  <option value="FULL_TIME">Full-time</option>
                  <option value="PART_TIME">Part-time</option>
                </select>
              </label>
              <label>Hours per week<input name="hoursPerWeek" type="number" min={0.01} max={168} step={0.01} /></label>
            </div>
            <label>Target joining date<input name="targetJoinDate" type="date" /></label>
            {options.jobProfiles.length === 0 && <p className="customer-form-error">Create and activate a job profile before adding a requirement.</p>}
            {options.serviceOrders.length === 0 && <p className="customer-form-error">An approved or in-progress service order is required.</p>}
            {error && <div className="customer-form-error" role="alert">{error}</div>}
            <div className="customer-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || options.jobProfiles.length === 0 || options.serviceOrders.length === 0}>
                {busy ? 'Saving…' : 'Add requirement'}
              </button>
            </div>
          </form>
        )}
        {!loading && !options && (
          <>
            {error && <div className="customer-form-error" role="alert">{error}</div>}
            <div className="customer-modal-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
