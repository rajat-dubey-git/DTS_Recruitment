import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Download, FileCheck2, FileText, Plus, Send, Trash2, Upload } from 'lucide-react'
import { workspaceApi } from '../api/workspace'
import type {
  AgreementCatalog,
  AgreementDetail,
  AgreementListItem,
  AgreementServiceLineInput,
} from '../api/workspace'

type DraftLine = {
  serviceTypeId: string
  jobProfileId: string
  employmentSchedule: 'FULL_TIME' | 'PART_TIME'
  hoursPerWeek: string
  headcount: string
  scopeDescription: string
}

function blankLine(catalog: AgreementCatalog | null): DraftLine {
  return {
    serviceTypeId: catalog?.serviceTypes[0] ? String(catalog.serviceTypes[0].service_type_id) : '',
    jobProfileId: catalog?.jobProfiles[0] ? String(catalog.jobProfiles[0].job_profile_id) : '',
    employmentSchedule: 'FULL_TIME',
    hoursPerWeek: '',
    headcount: '1',
    scopeDescription: '',
  }
}

function statusLabel(status: string | null) {
  if (!status) return 'Legacy agreement'
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function feeDescription(model: 'DTS_PAYROLL' | 'CUSTOMER_PAYROLL', feeValue?: number) {
  return model === 'CUSTOMER_PAYROLL'
    ? `${feeValue ?? 1} month(s) of agreed monthly salary`
    : `${feeValue ?? 10}% of agreed annual CTC`
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function AgreementDetailPanel({
  agreementId,
  onChanged,
}: {
  agreementId: number
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<AgreementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [changeRequest, setChangeRequest] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    workspaceApi.customerAgreement(agreementId).then((result) => {
      if (active) setDetail(result)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load agreement details.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [agreementId])

  const download = async (kind: 'draft' | 'signed') => {
    if (!detail?.version) return
    setBusy(true)
    setError('')
    try {
      const blob = await workspaceApi.downloadAgreementDocument(
        'customer',
        agreementId,
        detail.version.agreementVersionId,
        kind,
      )
      downloadBlob(blob, `${detail.agreement.agreementNumber}-v${detail.version.versionNumber}-${kind}.pdf`)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the document.')
    } finally {
      setBusy(false)
    }
  }

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail?.version) return
    const form = event.currentTarget
    const input = form.elements.namedItem('signedPdf')
    const file = input instanceof HTMLInputElement ? input.files?.[0] : undefined
    if (!file) {
      setError('Choose the signed PDF to upload.')
      return
    }
    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Upload a PDF file only.')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('PDF must not exceed 50 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await workspaceApi.uploadSignedAgreement(
        agreementId,
        detail.version.agreementVersionId,
        file,
      )
      setDetail(result)
      form.reset()
      onChanged()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the signed agreement.')
    } finally {
      setBusy(false)
    }
  }

  const requestChanges = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail?.version) return
    setBusy(true)
    setError('')
    try {
      const result = await workspaceApi.requestAgreementChanges(
        agreementId,
        detail.version.agreementVersionId,
        changeRequest,
      )
      setDetail(result)
      setChangeRequest('')
      onChanged()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request changes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="agreement-detail panel">
      <div className="agreement-detail-heading">
        <div>
          <div className="eyebrow">AGREEMENT DETAILS</div>
          <h2>{loading ? 'Loading agreement…' : detail?.agreement.agreementNumber}</h2>
        </div>
        {detail?.version && <span className="agreement-status">{statusLabel(detail.version.status)}</span>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {!loading && detail && (
        <>
          {detail.version?.changeReason && (
            <div className="agreement-note">
              <strong>Changes requested</strong>
              <p>{detail.version.changeReason}</p>
            </div>
          )}
          <div className="agreement-line-list">
            {detail.serviceLines.map((line) => (
              <article className="agreement-line-card" key={line.agreement_service_line_id}>
                <div>
                  <strong>{line.service_name} · {line.profile_name}</strong>
                  <p>{line.employment_schedule.replace(/_/g, ' ')} · {line.headcount} position(s)
                    {line.hours_per_week ? ` · ${line.hours_per_week} hours/week` : ''}
                  </p>
                  <small>{feeDescription(line.employment_model, Number(line.fee_value))}</small>
                  {line.scope_description && <p>{line.scope_description}</p>}
                </div>
              </article>
            ))}
            {detail.serviceLines.length === 0 && <p>No service lines are available for this agreement.</p>}
          </div>

          {detail.version?.canDownloadDraft && (
            <button type="button" className="btn btn-outline" onClick={() => void download('draft')} disabled={busy}>
              <Download size={15} /> Download draft PDF
            </button>
          )}
          {detail.version?.canDownloadSignedCopy && (
            <button type="button" className="btn btn-outline" onClick={() => void download('signed')} disabled={busy}>
              <FileCheck2 size={15} /> Download signed copy
            </button>
          )}

          {detail.version?.status === 'PENDING_CUSTOMER_SIGNATURE' && (
            <>
              <form className="agreement-upload-form" onSubmit={(event) => void upload(event)}>
                <label htmlFor="signedPdf">Signed agreement PDF (maximum 50 MB)</label>
                <input id="signedPdf" name="signedPdf" type="file" accept=".pdf,application/pdf" required />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  <Upload size={15} /> {busy ? 'Uploading…' : 'Upload signed PDF'}
                </button>
              </form>
              <form className="agreement-change-form" onSubmit={(event) => void requestChanges(event)}>
                <label htmlFor="agreementChangeRequest">Need a correction before signing?</label>
                <textarea
                  id="agreementChangeRequest"
                  value={changeRequest}
                  onChange={(event) => setChangeRequest(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  required
                />
                <button type="submit" className="btn btn-outline" disabled={busy || !changeRequest.trim()}>
                  Request changes
                </button>
              </form>
            </>
          )}

          <div className="agreement-event-list">
            <h3>History</h3>
            {detail.events.map((event, index) => (
              <div className="agreement-event" key={`${event.action_code}-${event.occurred_at}-${index}`}>
                <strong>{statusLabel(event.action_code)}</strong>
                <span>{event.customer_visible_comment ?? 'Status updated'}</span>
                <small>{new Date(event.occurred_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</small>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}

export default function CustomerAgreementsPage() {
  const [catalog, setCatalog] = useState<AgreementCatalog | null>(null)
  const [agreements, setAgreements] = useState<AgreementListItem[]>([])
  const [lines, setLines] = useState<DraftLine[]>([])
  const [customerId, setCustomerId] = useState('')
  const [selectedAgreementId, setSelectedAgreementId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const requestKey = useRef<string | null>(null)

  const loadData = async () => {
    const [catalogResult, agreementRows] = await Promise.all([
      workspaceApi.agreementCatalog(),
      workspaceApi.listCustomerAgreements(),
    ])
    setCatalog(catalogResult)
    setAgreements(agreementRows)
    setCustomerId((current) => current || String(catalogResult.customers[0]?.customer_id ?? ''))
    setLines((current) => current.length ? current : [blankLine(catalogResult)])
  }

  useEffect(() => {
    let active = true
    Promise.all([workspaceApi.agreementCatalog(), workspaceApi.listCustomerAgreements()])
      .then(([catalogResult, agreementRows]) => {
        if (!active) return
        setCatalog(catalogResult)
        setAgreements(agreementRows)
        setCustomerId(String(catalogResult.customers[0]?.customer_id ?? ''))
        setLines([blankLine(catalogResult)])
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load agreements.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setLines((current) => current.map((line, lineIndex) => (
      lineIndex === index ? { ...line, ...patch } : line
    )))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!customerId) {
      setError('Your account is not associated with a customer company. Contact the administrator.')
      return
    }
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      requestKey.current ??= crypto.randomUUID()
      const serviceLines: AgreementServiceLineInput[] = lines.map((line) => ({
        serviceTypeId: Number(line.serviceTypeId),
        jobProfileId: Number(line.jobProfileId),
        employmentSchedule: line.employmentSchedule,
        hoursPerWeek: line.employmentSchedule === 'PART_TIME' ? Number(line.hoursPerWeek) : null,
        headcount: Number(line.headcount),
        scopeDescription: line.scopeDescription || undefined,
      }))
      const created = await workspaceApi.createCustomerAgreement({
        customerId: Number(customerId),
        requestKey: requestKey.current,
        serviceLines,
      })
      requestKey.current = null
      setMessage(`Agreement ${created.agreement.agreementNumber} was submitted for administrator review.`)
      setSelectedAgreementId(created.agreement.agreementId)
      setLines([blankLine(catalog)])
      await loadData()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your service selection.')
    } finally {
      setSubmitting(false)
    }
  }

  const refreshList = () => {
    void workspaceApi.listCustomerAgreements().then(setAgreements).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh agreements.')
    })
  }

  const downloadListDocument = async (agreement: AgreementListItem, kind: 'draft' | 'signed') => {
    if (!agreement.agreement_version_id) return
    setError('')
    try {
      const blob = await workspaceApi.downloadAgreementDocument(
        'customer',
        agreement.agreement_id,
        agreement.agreement_version_id,
        kind,
      )
      downloadBlob(blob, `${agreement.agreement_number}-v${agreement.version_number}-${kind}.pdf`)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the PDF.')
    }
  }

  const addLine = () => setLines((current) => [...current, blankLine(catalog)])
  const removeLine = (index: number) => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))

  return (
    <div className="agreement-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER AGREEMENTS</div>
          <h1>Services and agreements</h1>
          <p>Choose your services, review the draft, then sign and upload the approved PDF.</p>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="agreement-success" role="status">{message}</div>}
      {loading && <div className="panel database-message" role="status">Loading agreement workspace…</div>}
      {!loading && catalog?.customers.length === 0 && (
        <div className="panel database-message">Your account is not connected to a customer company. Contact the administrator.</div>
      )}

      {!loading && catalog && catalog.customers.length > 0 && (
        <form className="panel agreement-request-form" onSubmit={(event) => void submit(event)}>
          <div className="agreement-section-heading">
            <div>
              <h2>Request services</h2>
              <p>Multiple service selections will be combined in one agreement.</p>
            </div>
            <FileText size={22} />
          </div>
          <label>
            Customer company
            <select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
              {catalog.customers.map((customer) => (
                <option key={customer.customer_id} value={customer.customer_id}>{customer.company_name}</option>
              ))}
            </select>
          </label>

          {lines.map((line, index) => {
            const service = catalog.serviceTypes.find((item) => String(item.service_type_id) === line.serviceTypeId)
            return (
              <div className="agreement-draft-line" key={index}>
                <div className="agreement-draft-line-heading">
                  <strong>Service {index + 1}</strong>
                  {lines.length > 1 && (
                    <button type="button" className="agreement-icon-button" onClick={() => removeLine(index)} aria-label={`Remove service ${index + 1}`}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="agreement-field-grid">
                  <label>
                    Service
                    <select
                      value={line.serviceTypeId}
                      onChange={(event) => updateLine(index, { serviceTypeId: event.target.value })}
                      required
                    >
                      {catalog.serviceTypes.map((option) => (
                        <option key={option.service_type_id} value={option.service_type_id}>{option.service_name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Job profile
                    <select
                      value={line.jobProfileId}
                      onChange={(event) => updateLine(index, { jobProfileId: event.target.value })}
                      required
                    >
                      {catalog.jobProfiles.map((profile) => (
                        <option key={profile.job_profile_id} value={profile.job_profile_id}>{profile.profile_name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Schedule
                    <select
                      value={line.employmentSchedule}
                      onChange={(event) => updateLine(index, {
                        employmentSchedule: event.target.value as DraftLine['employmentSchedule'],
                      })}
                    >
                      <option value="FULL_TIME">Full-time</option>
                      <option value="PART_TIME">Part-time</option>
                    </select>
                  </label>
                  <label>
                    Weekly hours {line.employmentSchedule === 'PART_TIME' ? '*' : '(optional)'}
                    <input
                      type="number"
                      min="0.5"
                      max="168"
                      step="0.5"
                      required={line.employmentSchedule === 'PART_TIME'}
                      value={line.hoursPerWeek}
                      onChange={(event) => updateLine(index, { hoursPerWeek: event.target.value })}
                    />
                  </label>
                  <label>
                    Headcount
                    <input
                      type="number"
                      min="1"
                      max="65535"
                      step="1"
                      value={line.headcount}
                      onChange={(event) => updateLine(index, { headcount: event.target.value })}
                      required
                    />
                  </label>
                  <label className="agreement-scope-field">
                    Scope or notes (optional)
                    <textarea
                      value={line.scopeDescription}
                      maxLength={60000}
                      rows={2}
                      onChange={(event) => updateLine(index, { scopeDescription: event.target.value })}
                    />
                  </label>
                </div>
                <div className="agreement-fee-note">
                  Indicative fee basis: {service
                    ? feeDescription(service.employment_model)
                    : 'Set by the service model'}
                </div>
              </div>
            )
          })}

          <div className="agreement-form-actions">
            <button type="button" className="btn btn-outline" onClick={addLine}>
              <Plus size={15} /> Add another service
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !catalog.serviceTypes.length || !catalog.jobProfiles.length}>
              <Send size={15} /> {submitting ? 'Submitting…' : 'Submit for admin review'}
            </button>
          </div>
          <p className="agreement-disclaimer">
            This is a sample workflow. Fees, salary/CTC definitions, taxes, and final legal terms are confirmed by the administrator before signature.
          </p>
        </form>
      )}

      <section className="panel agreement-list-panel">
        <div className="agreement-section-heading">
          <div>
            <h2>Your agreements</h2>
            <p>Only agreements for your customer company are shown.</p>
          </div>
        </div>
        {agreements.length === 0 && !loading && <div className="agreement-empty">No agreements yet.</div>}
        {agreements.map((agreement) => (
          <article className={`agreement-list-row ${selectedAgreementId === agreement.agreement_id ? 'selected' : ''}`} key={agreement.agreement_id}>
            <button type="button" className="agreement-row-main" onClick={() => setSelectedAgreementId(
              selectedAgreementId === agreement.agreement_id ? null : agreement.agreement_id,
            )}>
              <div>
                <strong>{agreement.agreement_number}</strong>
                <span>{agreement.company_name} · {agreement.title}</span>
              </div>
              <span className="agreement-status">{statusLabel(agreement.version_status ?? agreement.status)}</span>
            </button>
            <div className="agreement-row-actions">
              {agreement.has_draft_document && agreement.agreement_version_id && (
                <button type="button" className="btn btn-outline" onClick={() => void downloadListDocument(agreement, 'draft')}>
                  <Download size={14} /> Draft PDF
                </button>
              )}
              {agreement.has_signed_document && agreement.agreement_version_id && (
                <button type="button" className="btn btn-outline" onClick={() => void downloadListDocument(agreement, 'signed')}>
                  <Download size={14} /> Signed PDF
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {selectedAgreementId !== null && (
        <AgreementDetailPanel
          agreementId={selectedAgreementId}
          onChanged={refreshList}
        />
      )}
    </div>
  )
}
