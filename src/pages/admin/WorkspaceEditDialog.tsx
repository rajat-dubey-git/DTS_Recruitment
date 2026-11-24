import { useState } from 'react'
import type { FormEvent } from 'react'
import { workspaceApi } from '../../api/workspace'
import type { AdminModule, WorkspaceRecord } from '../../api/workspace'

interface Props {
  module: AdminModule
  record: WorkspaceRecord
  onClose: () => void
  onSaved: () => void
}

function getRecordId(module: AdminModule, record: WorkspaceRecord): number {
  const id =
    record.customer_id ??
    record.user_id ??
    record.skill_id ??
    record.service_type_id ??
    record.job_profile_id ??
    record.agreement_id ??
    record.rate_card_id ??
    record.service_order_id ??
    record.requirement_id ??
    record.contact_id ??
    record.address_id ??
    record.intake_id
  return Number(id)
}

export default function WorkspaceEditDialog({ module, record, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState<Record<string, unknown>>({ ...record })

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')

    const recordId = getRecordId(module, record)
    if (!recordId) {
      setError('Cannot determine record ID.')
      setBusy(false)
      return
    }

    try {
      await workspaceApi.updateRecord(module, recordId, formData)
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update record.')
    } finally {
      setBusy(false)
    }
  }

  const formatTitle = module.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="customer-modal-overlay">
      <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="edit-dialog-title">
        <div className="customer-modal-heading">
          <div>
            <h2 id="edit-dialog-title">Edit {formatTitle}</h2>
            <p>Admin Full Control: update attributes and operational status directly.</p>
          </div>
          <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {/* CUSTOMERS */}
          {module === 'customers' && (
            <>
              <label>
                Company Name *
                <input
                  value={String(formData.company_name ?? '')}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Customer Code *
                <input
                  value={String(formData.customer_code ?? '')}
                  onChange={(e) => updateField('customer_code', e.target.value)}
                  maxLength={30}
                  required
                />
              </label>
              <label>
                Industry
                <input
                  value={String(formData.industry ?? '')}
                  onChange={(e) => updateField('industry', e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Status *
                <select
                  value={String(formData.status ?? 'ACTIVE')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="PROSPECT">Prospect</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
              <label>
                Payment Terms (Days)
                <input
                  type="number"
                  min="0"
                  max="365"
                  value={Number(formData.payment_terms_days ?? 30)}
                  onChange={(e) => updateField('payment_terms_days', e.target.value)}
                />
              </label>
            </>
          )}

          {/* USERS & RECRUITERS */}
          {(module === 'users' || module === 'recruiters') && (
            <>
              <label>
                Full Name *
                <input
                  value={String(formData.full_name ?? '')}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Mobile Number
                <input
                  value={String(formData.mobile ?? '')}
                  onChange={(e) => updateField('mobile', e.target.value)}
                  maxLength={20}
                />
              </label>
              <label>
                Role *
                <select
                  value={String(formData.role ?? 'RECRUITER')}
                  onChange={(e) => updateField('role', e.target.value)}
                  required
                >
                  <option value="ADMIN">Admin</option>
                  <option value="RECRUITER">Recruiter</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="CANDIDATE">Candidate</option>
                </select>
              </label>
              <label>
                Account Status *
                <select
                  value={String(formData.status ?? 'ACTIVE')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="INVITED">Invited</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </label>
            </>
          )}

          {/* SKILLS */}
          {module === 'skills' && (
            <>
              <label>
                Skill Name *
                <input
                  value={String(formData.skill_name ?? '')}
                  onChange={(e) => updateField('skill_name', e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Skill Category
                <input
                  value={String(formData.skill_category ?? '')}
                  onChange={(e) => updateField('skill_category', e.target.value)}
                  maxLength={60}
                />
              </label>
            </>
          )}

          {/* SERVICE TYPES */}
          {module === 'service-types' && (
            <>
              <label>
                Service Code *
                <input
                  value={String(formData.service_code ?? '')}
                  onChange={(e) => updateField('service_code', e.target.value)}
                  maxLength={30}
                  required
                />
              </label>
              <label>
                Service Name *
                <input
                  value={String(formData.service_name ?? '')}
                  onChange={(e) => updateField('service_name', e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Employment Model *
                <select
                  value={String(formData.employment_model ?? 'CUSTOMER_PAYROLL')}
                  onChange={(e) => updateField('employment_model', e.target.value)}
                  required
                >
                  <option value="CUSTOMER_PAYROLL">Customer Payroll</option>
                  <option value="DTS_PAYROLL">DTS Payroll</option>
                </select>
              </label>
            </>
          )}

          {/* JOB PROFILES */}
          {module === 'job-profiles' && (
            <>
              <label>
                Profile Code *
                <input
                  value={String(formData.profile_code ?? '')}
                  onChange={(e) => updateField('profile_code', e.target.value)}
                  maxLength={30}
                  required
                />
              </label>
              <label>
                Profile Name *
                <input
                  value={String(formData.profile_name ?? '')}
                  onChange={(e) => updateField('profile_name', e.target.value)}
                  maxLength={150}
                  required
                />
              </label>
              <label>
                Category
                <input
                  value={String(formData.category ?? '')}
                  onChange={(e) => updateField('category', e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Status *
                <select
                  value={String(formData.status ?? 'ACTIVE')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
              <label>
                Min Experience (years)
                <input
                  type="number"
                  step="0.5"
                  value={Number(formData.default_experience_min ?? 0)}
                  onChange={(e) => updateField('default_experience_min', e.target.value)}
                />
              </label>
              <label>
                Max Experience (years)
                <input
                  type="number"
                  step="0.5"
                  value={Number(formData.default_experience_max ?? 0)}
                  onChange={(e) => updateField('default_experience_max', e.target.value)}
                />
              </label>
            </>
          )}

          {/* AGREEMENTS */}
          {module === 'agreements' && (
            <>
              <label>
                Title *
                <input
                  value={String(formData.title ?? '')}
                  onChange={(e) => updateField('title', e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Status *
                <select
                  value={String(formData.status ?? 'DRAFT')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_SIGNATURE">Pending Signature</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="TERMINATED">Terminated</option>
                </select>
              </label>
              <label>
                Effective Date
                <input
                  type="date"
                  value={String(formData.effective_date ?? '').slice(0, 10)}
                  onChange={(e) => updateField('effective_date', e.target.value)}
                />
              </label>
              <label>
                Expiry Date
                <input
                  type="date"
                  value={String(formData.expiry_date ?? '').slice(0, 10)}
                  onChange={(e) => updateField('expiry_date', e.target.value)}
                />
              </label>
            </>
          )}

          {/* RATE CARDS */}
          {module === 'rate-cards' && (
            <>
              <label>
                Fee Type *
                <select
                  value={String(formData.fee_type ?? 'PERCENTAGE')}
                  onChange={(e) => updateField('fee_type', e.target.value)}
                  required
                >
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED_AMOUNT">Fixed Amount</option>
                  <option value="SALARY_MONTHS">Salary Months</option>
                </select>
              </label>
              <label>
                Fee Basis *
                <select
                  value={String(formData.fee_basis ?? 'ANNUAL_CTC')}
                  onChange={(e) => updateField('fee_basis', e.target.value)}
                  required
                >
                  <option value="MONTHLY_SALARY">Monthly Salary</option>
                  <option value="ANNUAL_CTC">Annual CTC</option>
                  <option value="HOURLY">Hourly</option>
                  <option value="PER_PLACEMENT">Per Placement</option>
                </select>
              </label>
              <label>
                Fee Value *
                <input
                  type="number"
                  step="0.01"
                  value={Number(formData.fee_value ?? 0)}
                  onChange={(e) => updateField('fee_value', e.target.value)}
                  required
                />
              </label>
              <label>
                Billing Frequency *
                <select
                  value={String(formData.billing_frequency ?? 'ONE_TIME')}
                  onChange={(e) => updateField('billing_frequency', e.target.value)}
                  required
                >
                  <option value="ONE_TIME">One-time</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                </select>
              </label>
            </>
          )}

          {/* SERVICE ORDERS */}
          {module === 'service-orders' && (
            <>
              <label>
                Title *
                <input
                  value={String(formData.title ?? '')}
                  onChange={(e) => updateField('title', e.target.value)}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Status *
                <select
                  value={String(formData.status ?? 'DRAFT')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label>
                Start Date
                <input
                  type="date"
                  value={String(formData.start_date ?? '').slice(0, 10)}
                  onChange={(e) => updateField('start_date', e.target.value)}
                />
              </label>
              <label>
                End Date
                <input
                  type="date"
                  value={String(formData.end_date ?? '').slice(0, 10)}
                  onChange={(e) => updateField('end_date', e.target.value)}
                />
              </label>
            </>
          )}

          {/* REQUIREMENTS */}
          {module === 'requirements' && (
            <>
              <label>
                Job Title *
                <input
                  value={String(formData.job_title ?? '')}
                  onChange={(e) => updateField('job_title', e.target.value)}
                  maxLength={150}
                  required
                />
              </label>
              <label>
                Status *
                <select
                  value={String(formData.status ?? 'OPEN')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="OPEN">Open</option>
                  <option value="ON_HOLD">On Hold</option>
                  <option value="FILLED">Filled</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label>
                Headcount *
                <input
                  type="number"
                  min="1"
                  value={Number(formData.headcount ?? 1)}
                  onChange={(e) => updateField('headcount', e.target.value)}
                  required
                />
              </label>
              <label>
                Work Mode *
                <select
                  value={String(formData.work_mode ?? 'HYBRID')}
                  onChange={(e) => updateField('work_mode', e.target.value)}
                  required
                >
                  <option value="ONSITE">Onsite</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </label>
            </>
          )}

          {/* CUSTOMER CONTACTS */}
          {module === 'customer-contacts' && (
            <>
              <label>
                Designation
                <input
                  value={String(formData.designation ?? '')}
                  onChange={(e) => updateField('designation', e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Contact Type *
                <select
                  value={String(formData.contact_type ?? 'HIRING')}
                  onChange={(e) => updateField('contact_type', e.target.value)}
                  required
                >
                  <option value="PRIMARY">Primary</option>
                  <option value="BILLING">Billing</option>
                  <option value="HIRING">Hiring</option>
                  <option value="ESCALATION">Escalation</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Status *
                <select
                  value={String(formData.status ?? 'ACTIVE')}
                  onChange={(e) => updateField('status', e.target.value)}
                  required
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </>
          )}

          {/* CUSTOMER ADDRESSES */}
          {module === 'customer-addresses' && (
            <>
              <label>
                Address Type *
                <select
                  value={String(formData.address_type ?? 'SERVICE')}
                  onChange={(e) => updateField('address_type', e.target.value)}
                  required
                >
                  <option value="REGISTERED">Registered</option>
                  <option value="BILLING">Billing</option>
                  <option value="SERVICE">Service</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label>
                Address Line *
                <input
                  value={String(formData.address_line ?? '')}
                  onChange={(e) => updateField('address_line', e.target.value)}
                  maxLength={255}
                  required
                />
              </label>
              <label>
                City *
                <input
                  value={String(formData.city ?? '')}
                  onChange={(e) => updateField('city', e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                State *
                <input
                  value={String(formData.state ?? '')}
                  onChange={(e) => updateField('state', e.target.value)}
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Postal Code
                <input
                  value={String(formData.postal_code ?? '')}
                  onChange={(e) => updateField('postal_code', e.target.value)}
                  maxLength={20}
                />
              </label>
            </>
          )}

          {error && <div className="customer-form-error" role="alert">{error}</div>}

          <div className="customer-modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving changes…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
