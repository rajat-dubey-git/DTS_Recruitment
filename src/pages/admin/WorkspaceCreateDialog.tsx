import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { workspaceApi } from '../../api/workspace'
import type { AdminModule, CreatableModule, WorkspaceRecord } from '../../api/workspace'

type Props = {
  module: CreatableModule
  onClose: () => void
  onSaved: () => void
}

type Option = { value: string; label: string }
type Field = {
  name: string
  label: string
  type?: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select' | 'checkbox'
  required?: boolean
  maxLength?: number
  min?: number
  max?: number
  step?: number
  defaultValue?: string
  options?: Option[]
  multiple?: boolean
}

const moduleLabels: Record<CreatableModule, string> = {
  customers: 'Customer',
  skills: 'Skill',
  'service-types': 'Service type',
  'job-profiles': 'Job profile',
  agreements: 'Agreement',
  'rate-cards': 'Rate card',
  'service-orders': 'Service order',
}

const staticOptions: Record<string, Option[]> = {
  customerStatus: [
    { value: 'PROSPECT', label: 'Prospect' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ],
  profileStatus: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'ARCHIVED', label: 'Archived' },
  ],
  agreementStatus: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PENDING_SIGNATURE', label: 'Pending signature' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'TERMINATED', label: 'Terminated' },
  ],
  feeType: [
    { value: 'PERCENTAGE', label: 'Percentage' },
    { value: 'FIXED_AMOUNT', label: 'Fixed amount' },
    { value: 'SALARY_MONTHS', label: 'Salary months' },
  ],
  feeBasis: [
    { value: 'MONTHLY_SALARY', label: 'Monthly salary' },
    { value: 'ANNUAL_CTC', label: 'Annual CTC' },
    { value: 'HOURLY', label: 'Hourly' },
    { value: 'PER_PLACEMENT', label: 'Per placement' },
  ],
  billingFrequency: [
    { value: 'ONE_TIME', label: 'One time' },
    { value: 'MONTHLY', label: 'Monthly' },
    { value: 'QUARTERLY', label: 'Quarterly' },
  ],
  serviceOrderStatus: [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  ],
}

function relatedOptions(rows: WorkspaceRecord[], idKey: string, label: (row: WorkspaceRecord) => string): Option[] {
  return rows.map((row) => ({ value: String(row[idKey]), label: label(row) }))
}

function getFields(module: CreatableModule, options: Record<string, Option[]>): Field[] {
  switch (module) {
    case 'customers':
      return [
        { name: 'customerCode', label: 'Customer code', required: true, maxLength: 30 },
        { name: 'companyName', label: 'Company name', required: true, maxLength: 200 },
        { name: 'industry', label: 'Industry', maxLength: 100 },
        { name: 'gstin', label: 'GSTIN', maxLength: 15 },
        { name: 'pan', label: 'PAN', maxLength: 10 },
        { name: 'paymentTermsDays', label: 'Payment terms (days)', type: 'number', min: 0, max: 365, step: 1, defaultValue: '30' },
        { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'PROSPECT', options: staticOptions.customerStatus },
      ]
    case 'skills':
      return [
        { name: 'skillName', label: 'Skill name', required: true, maxLength: 100 },
        { name: 'skillCategory', label: 'Category', maxLength: 60 },
      ]
    case 'service-types':
      return [
        { name: 'serviceCode', label: 'Service code', required: true, maxLength: 30 },
        { name: 'serviceName', label: 'Service name', required: true, maxLength: 100 },
        {
          name: 'employmentModel',
          label: 'Employment model',
          type: 'select',
          required: true,
          options: [
            { value: 'DTS_PAYROLL', label: 'DTS payroll' },
            { value: 'CUSTOMER_PAYROLL', label: 'Customer payroll' },
          ],
        },
      ]
    case 'job-profiles':
      return [
        { name: 'profileCode', label: 'Profile code', required: true, maxLength: 30 },
        { name: 'profileName', label: 'Profile name', required: true, maxLength: 150 },
        { name: 'category', label: 'Category', maxLength: 100 },
        { name: 'purpose', label: 'Purpose', type: 'textarea', required: true, maxLength: 60000 },
        { name: 'keyResponsibilities', label: 'Key responsibilities', type: 'textarea', required: true, maxLength: 60000 },
        { name: 'qualifications', label: 'Qualifications', type: 'textarea', maxLength: 60000 },
        { name: 'reportingTo', label: 'Reporting to', maxLength: 150 },
        { name: 'experienceMin', label: 'Minimum experience (years)', type: 'number', min: 0, max: 999.9, step: 0.1 },
        { name: 'experienceMax', label: 'Maximum experience (years)', type: 'number', min: 0, max: 999.9, step: 0.1 },
        { name: 'skillIds', label: 'Associated skills', type: 'select', multiple: true, options: options.skills },
        { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'DRAFT', options: staticOptions.profileStatus },
      ]
    case 'agreements':
      return [
        { name: 'agreementNumber', label: 'Agreement number', required: true, maxLength: 50 },
        { name: 'customerId', label: 'Customer', type: 'select', required: true, options: options.customers },
        { name: 'title', label: 'Title', required: true, maxLength: 200 },
        { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'DRAFT', options: staticOptions.agreementStatus },
        { name: 'effectiveDate', label: 'Effective date', type: 'date' },
        { name: 'expiryDate', label: 'Expiry date', type: 'date' },
        { name: 'signedDate', label: 'Signed date', type: 'date' },
        { name: 'autoRenew', label: 'Auto-renew', type: 'checkbox' },
      ]
    case 'rate-cards':
      return [
        { name: 'agreementId', label: 'Agreement', type: 'select', required: true, options: options.agreements },
        { name: 'serviceTypeId', label: 'Service type', type: 'select', required: true, options: options.serviceTypes },
        { name: 'jobProfileId', label: 'Job profile', type: 'select', required: true, options: options.jobProfiles },
        { name: 'feeType', label: 'Fee type', type: 'select', required: true, options: staticOptions.feeType },
        { name: 'feeBasis', label: 'Fee basis', type: 'select', required: true, options: staticOptions.feeBasis },
        { name: 'feeValue', label: 'Fee value', type: 'number', required: true, min: 0, step: 0.01 },
        { name: 'billingFrequency', label: 'Billing frequency', type: 'select', required: true, options: staticOptions.billingFrequency },
        { name: 'replacementDays', label: 'Replacement period (days)', type: 'number', min: 0, max: 65535, step: 1 },
        { name: 'effectiveFrom', label: 'Effective from', type: 'date', required: true },
        { name: 'effectiveTo', label: 'Effective to', type: 'date' },
      ]
    case 'service-orders':
      return [
        { name: 'orderNumber', label: 'Order number', required: true, maxLength: 50 },
        { name: 'agreementId', label: 'Agreement', type: 'select', required: true, options: options.agreements },
        { name: 'serviceTypeId', label: 'Service type', type: 'select', required: true, options: options.serviceTypes },
        { name: 'customerReference', label: 'Customer reference', maxLength: 100 },
        { name: 'title', label: 'Title', required: true, maxLength: 200 },
        { name: 'scopeDescription', label: 'Scope description', type: 'textarea', maxLength: 60000 },
        { name: 'startDate', label: 'Start date', type: 'date' },
        { name: 'endDate', label: 'End date', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'DRAFT', options: staticOptions.serviceOrderStatus },
      ]
  }
}

export default function WorkspaceCreateDialog({ module, onClose, onSaved }: Props) {
  const [options, setOptions] = useState<Record<string, Option[]>>({})
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const requests: Array<[string, AdminModule]> = []
    if (module === 'job-profiles') requests.push(['skills', 'skills'])
    if (module === 'agreements') requests.push(['customers', 'customers'])
    if (module === 'rate-cards') requests.push(
      ['agreements', 'agreements'],
      ['serviceTypes', 'service-types'],
      ['jobProfiles', 'job-profiles'],
    )
    if (module === 'service-orders') requests.push(
      ['agreements', 'agreements'],
      ['serviceTypes', 'service-types'],
    )

    setLoadingOptions(requests.length > 0)
    Promise.all(requests.map(async ([key, listModule]) => {
      const page = await workspaceApi.list(listModule, { limit: 100, offset: 0, search: '' })
      const idKeys: Partial<Record<AdminModule, string>> = {
        skills: 'skill_id',
        customers: 'customer_id',
        agreements: 'agreement_id',
        'service-types': 'service_type_id',
        'job-profiles': 'job_profile_id',
      }
      const idKey = idKeys[listModule]
      if (!idKey) throw new Error(`No ID field is configured for ${listModule}.`)
      const values = relatedOptions(page.rows, idKey, (row) => {
        if (listModule === 'customers') return `${row.customer_code} — ${row.company_name}`
        if (listModule === 'agreements') return `${row.agreement_number} — ${row.company_name}`
        if (listModule === 'service-types') return `${row.service_code} — ${row.service_name}`
        if (listModule === 'job-profiles') return `${row.profile_code} — ${row.profile_name}`
        return String(row.skill_name)
      })
      return [key, values] as const
    }))
      .then((entries) => {
        if (active) setOptions(Object.fromEntries(entries))
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load form options.')
      })
      .finally(() => {
        if (active) setLoadingOptions(false)
      })
    return () => { active = false }
  }, [module])

  const fields = getFields(module, options)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    const values: Record<string, unknown> = {}
    for (const field of fields) {
      if (field.type === 'checkbox') {
        values[field.name] = formData.get(field.name) === 'on'
      } else if (field.multiple) {
        values[field.name] = formData.getAll(field.name)
      } else {
        values[field.name] = String(formData.get(field.name) ?? '')
      }
    }

    try {
      await workspaceApi.createRecord(module, values)
      onSaved()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create this record.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="customer-modal-overlay">
      <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="create-record-title">
        <div className="customer-modal-heading">
          <div>
            <h2 id="create-record-title">Create {moduleLabels[module]}</h2>
            <p>Save a validated record to the recruitment database.</p>
          </div>
          <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        {loadingOptions && <p className="database-read-only">Loading related records…</p>}
        <form onSubmit={(event) => void submit(event)}>
          {fields.map((field) => (
            <label key={field.name} className={field.type === 'checkbox' ? 'database-checkbox-field' : undefined}>
              {field.type === 'checkbox' ? (
                <>
                  <input type="checkbox" name={field.name} />
                  {field.label}
                </>
              ) : (
                <>
                  {field.label}{field.required ? ' *' : ''}
                  {field.type === 'textarea' ? (
                    <textarea name={field.name} required={field.required} maxLength={field.maxLength} rows={4} />
                  ) : field.type === 'select' ? (
                    <select
                      name={field.name}
                      required={field.required}
                      multiple={field.multiple}
                      defaultValue={field.multiple ? [] : field.defaultValue ?? ''}
                      size={field.multiple ? 4 : undefined}
                    >
                      {!field.multiple && <option value="">Select…</option>}
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.name}
                      type={field.type ?? 'text'}
                      required={field.required}
                      maxLength={field.maxLength}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      defaultValue={field.defaultValue}
                    />
                  )}
                  {field.multiple && <small>Hold Ctrl (Windows) or Command (Mac) to select multiple skills.</small>}
                </>
              )}
            </label>
          ))}
          {error && <div className="customer-form-error" role="alert">{error}</div>}
          <div className="customer-modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || loadingOptions || fields.some((field) => field.type === 'select' && field.required && !(field.options?.length))}
            >
              {busy ? 'Saving…' : `Create ${moduleLabels[module]}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
