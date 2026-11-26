import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  Download,
  FileCheck2,
  FileText,
  RefreshCw,
  Save,
  XCircle,
} from 'lucide-react'
import { workspaceApi } from '../../api/workspace'
import type { AgreementDetail, AgreementServiceLineInput } from '../../api/workspace'
import AgreementSampleTemplateModal from '../../components/AgreementSampleTemplateModal'

type DraftLine = {
  serviceTypeId: string
  jobProfileId: string
  employmentSchedule: 'FULL_TIME' | 'PART_TIME'
  hoursPerWeek: string
  headcount: string
  scopeDescription: string
}

function statusLabel(status: string | null) {
  if (!status) return 'Unknown'
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (l) => l.toUpperCase())
}

function feeDescription(feeType: string, feeValue: number, model: string) {
  if (model === 'CUSTOMER_PAYROLL') return `${feeValue} month(s) of agreed monthly salary`
  return `${feeValue}% of agreed annual CTC`
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

export default function AdminAgreementReviewPage() {
  const { agreementId } = useParams<{ agreementId: string }>()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<AgreementDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [showSampleTemplate, setShowSampleTemplate] = useState(false)

  // Edit terms state
  const [editing, setEditing] = useState(false)
  const [editLines, setEditLines] = useState<DraftLine[]>([])
  const [effectiveDate, setEffectiveDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [internalNote, setInternalNote] = useState('')

  // Review decision state
  const [decision, setDecision] = useState<'APPROVE_FOR_SIGNATURE' | 'REQUEST_CHANGES' | ''>('')
  const [customerComment, setCustomerComment] = useState('')
  const [internalComment, setInternalComment] = useState('')

  // Activate state
  const [activateEffectiveDate, setActivateEffectiveDate] = useState('')
  const [activateExpiryDate, setActivateExpiryDate] = useState('')

  const load = async () => {
    if (!agreementId) return
    setLoading(true)
    setError('')
    try {
      const data = await workspaceApi.adminAgreement(Number(agreementId))
      setDetail(data)
      if (data.version) {
        setInternalNote(data.version.internalReviewNote ?? '')
      }
      setEffectiveDate(data.agreement.effectiveDate ?? '')
      setExpiryDate(data.agreement.expiryDate ?? '')
      setActivateEffectiveDate(data.agreement.effectiveDate ?? '')
      setActivateExpiryDate(data.agreement.expiryDate ?? '')
      setEditLines(data.serviceLines.map((line) => ({
        serviceTypeId: String(line.service_type_id),
        jobProfileId: String(line.job_profile_id),
        employmentSchedule: line.employment_schedule,
        hoursPerWeek: line.hours_per_week != null ? String(line.hours_per_week) : '',
        headcount: String(line.headcount),
        scopeDescription: line.scope_description ?? '',
      })))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load agreement.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [agreementId])

  const saveTerms = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail?.version) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const serviceLines: AgreementServiceLineInput[] = editLines.map((line) => ({
        serviceTypeId: Number(line.serviceTypeId),
        jobProfileId: Number(line.jobProfileId),
        employmentSchedule: line.employmentSchedule,
        hoursPerWeek: line.employmentSchedule === 'PART_TIME' ? Number(line.hoursPerWeek) : null,
        headcount: Number(line.headcount),
        scopeDescription: line.scopeDescription || undefined,
      }))
      const result = await workspaceApi.saveAdminAgreementTerms(
        detail.agreement.agreementId,
        detail.version.agreementVersionId,
        {
          effectiveDate: effectiveDate || null,
          expiryDate: expiryDate || null,
          internalReviewNote: internalNote,
          serviceLines,
        },
      )
      setDetail(result)
      setEditing(false)
      setMessage('Terms saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save terms.')
    } finally {
      setBusy(false)
    }
  }

  const submitReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail?.version || !decision) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.reviewAdminAgreement(
        detail.agreement.agreementId,
        detail.version.agreementVersionId,
        {
          decision,
          customerComment: customerComment || undefined,
          internalComment: internalComment || undefined,
        },
      )
      setDetail(result)
      setDecision('')
      setCustomerComment('')
      setInternalComment('')
      setMessage(
        decision === 'APPROVE_FOR_SIGNATURE'
          ? 'Agreement approved for signature. Draft PDF generated for the customer.'
          : 'Changes requested from customer.',
      )
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to submit review decision.')
    } finally {
      setBusy(false)
    }
  }

  const activateAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!detail?.version) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.activateAdminAgreement(
        detail.agreement.agreementId,
        detail.version.agreementVersionId,
        {
          effectiveDate: activateEffectiveDate || null,
          expiryDate: activateExpiryDate || null,
        },
      )
      setDetail(result)
      setMessage('Agreement activated successfully.')
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'Unable to activate agreement.')
    } finally {
      setBusy(false)
    }
  }

  const provisionOrders = async () => {
    if (!detail) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.provisionAgreementOrders(detail.agreement.agreementId)
      setMessage(result.message)
      await load()
    } catch (provisionError) {
      setError(provisionError instanceof Error ? provisionError.message : 'Unable to provision service orders.')
    } finally {
      setBusy(false)
    }
  }

  const downloadDoc = async (kind: 'draft' | 'signed') => {
    if (!detail?.version) return
    setBusy(true)
    setError('')
    try {
      const blob = await workspaceApi.downloadAgreementDocument(
        'admin',
        detail.agreement.agreementId,
        detail.version.agreementVersionId,
        kind,
      )
      downloadBlob(blob, `${detail.agreement.agreementNumber}-v${detail.version.versionNumber}-${kind}.pdf`)
    } catch (dlError) {
      setError(dlError instanceof Error ? dlError.message : 'Unable to download document.')
    } finally {
      setBusy(false)
    }
  }

  const updateLine = (index: number, patch: Partial<DraftLine>) => {
    setEditLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))
  }

  const versionStatus = detail?.version?.status ?? null
  const canEditTerms = versionStatus === 'PENDING_ADMIN_REVIEW' || versionStatus === 'CHANGES_REQUESTED'
  const canReview = canEditTerms
  const canActivate = versionStatus === 'SIGNED_PENDING_ADMIN_ACTIVATION'
  const canDownloadSigned = detail?.version?.canDownloadSignedCopy
  const canProvisionOrders = detail?.agreement.status === 'ACTIVE' && versionStatus === 'ACTIVE'

  if (loading) {
    return (
      <div className="dashboard">
        <div className="panel database-message" role="status">Loading agreement…</div>
      </div>
    )
  }

  if (!detail && !loading) {
    return (
      <div className="dashboard">
        <div className="panel database-message">Agreement not found.</div>
        {canProvisionOrders && (
          <button
            type="button"
            className="btn btn-outline"
            disabled={busy}
            onClick={() => void provisionOrders()}
          >
            <RefreshCw size={15} /> {busy ? 'Checking…' : 'Ensure service orders'}
          </button>
        )}
        <Link className="btn btn-outline" to="/app/admin/agreements"><ArrowLeft size={15} /> Back to agreements</Link>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMIN REVIEW</div>
          <h1>{detail?.agreement.agreementNumber ?? 'Agreement Review'}</h1>
          <p>{detail?.agreement.companyName} · {detail?.agreement.title}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setShowSampleTemplate(true)}
            title="View Standard Sample Agreement Draft"
          >
            <FileText size={15} /> Sample Template
          </button>
          <Link className="btn btn-outline" to="/app/admin/agreements">
            <ArrowLeft size={15} /> All agreements
          </Link>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="agreement-success" role="status">{message}</div>}

      {detail && (
        <>
          {/* Agreement header info */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Agreement details</h3>
                <p>
                  Workflow status: <strong>{statusLabel(detail.version?.status ?? detail.agreement.status)}</strong>
                  {detail.version && <> · Version <strong>v{detail.version.versionNumber}</strong></>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {detail.version?.canDownloadDraft && (
                  <button type="button" className="btn btn-outline" onClick={() => void downloadDoc('draft')} disabled={busy}>
                    <Download size={15} /> Draft PDF
                  </button>
                )}
                {canDownloadSigned && (
                  <button type="button" className="btn btn-outline" onClick={() => void downloadDoc('signed')} disabled={busy}>
                    <FileCheck2 size={15} /> Signed PDF
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div><small>Customer</small><br /><strong>{detail.agreement.companyName}</strong></div>
              <div><small>Agreement #</small><br /><strong>{detail.agreement.agreementNumber}</strong></div>
              <div><small>Effective date</small><br /><strong>{detail.agreement.effectiveDate ?? '—'}</strong></div>
              <div><small>Expiry date</small><br /><strong>{detail.agreement.expiryDate ?? '—'}</strong></div>
              {detail.version?.internalReviewNote && (
                <div style={{ gridColumn: '1 / -1' }}><small>Internal review note</small><br /><span>{detail.version.internalReviewNote}</span></div>
              )}
            </div>
          </section>

          {/* Service lines */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Service lines</h3>
                <p>{detail.serviceLines.length} selected service(s)</p>
              </div>
              {canEditTerms && !editing && (
                <button type="button" className="btn btn-outline" onClick={() => setEditing(true)}>
                  Edit terms
                </button>
              )}
            </div>
            {editing ? (
              <form onSubmit={(event) => void saveTerms(event)}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <label>
                    Effective date
                    <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                  </label>
                  <label>
                    Expiry date
                    <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                  </label>
                </div>
                <label style={{ marginBottom: '1rem', display: 'block' }}>
                  Internal review note (admin only, not customer-visible)
                  <textarea
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    rows={3}
                    maxLength={10000}
                    style={{ width: '100%' }}
                  />
                </label>
                {editLines.map((line, index) => (
                  <div key={index} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
                    <strong>Service line {index + 1}</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                      <label>
                        Schedule
                        <select
                          value={line.employmentSchedule}
                          onChange={(e) => updateLine(index, { employmentSchedule: e.target.value as DraftLine['employmentSchedule'] })}
                        >
                          <option value="FULL_TIME">Full-time</option>
                          <option value="PART_TIME">Part-time</option>
                        </select>
                      </label>
                      {line.employmentSchedule === 'PART_TIME' && (
                        <label>
                          Hours/week *
                          <input
                            type="number"
                            min="0.5"
                            max="168"
                            step="0.5"
                            value={line.hoursPerWeek}
                            onChange={(e) => updateLine(index, { hoursPerWeek: e.target.value })}
                            required
                          />
                        </label>
                      )}
                      <label>
                        Headcount
                        <input
                          type="number"
                          min="1"
                          max="65535"
                          step="1"
                          value={line.headcount}
                          onChange={(e) => updateLine(index, { headcount: e.target.value })}
                          required
                        />
                      </label>
                      <label style={{ gridColumn: '1 / -1' }}>
                        Scope/notes (optional)
                        <textarea
                          value={line.scopeDescription}
                          onChange={(e) => updateLine(index, { scopeDescription: e.target.value })}
                          rows={2}
                          maxLength={60000}
                          style={{ width: '100%' }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    <Save size={15} /> {busy ? 'Saving…' : 'Save terms'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </form>
            ) : (
              <div className="agreement-line-list">
                {detail.serviceLines.map((line) => (
                  <article className="agreement-line-card" key={line.agreement_service_line_id}>
                    <div>
                      <strong>{line.service_name} · {line.profile_name}</strong>
                      <p>{line.employment_schedule.replace(/_/g, ' ')} · {line.headcount} position(s)
                        {line.hours_per_week ? ` · ${line.hours_per_week} hours/week` : ''}
                      </p>
                      <small>{feeDescription(line.fee_type, Number(line.fee_value), line.employment_model)}</small>
                      {line.scope_description && <p>{line.scope_description}</p>}
                    </div>
                  </article>
                ))}
                {detail.serviceLines.length === 0 && <p>No service lines recorded.</p>}
              </div>
            )}
          </section>

          {/* Admin review decision */}
          {canReview && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Review decision</h3>
                  <p>Approve for customer signature or return with change request.</p>
                </div>
              </div>
              <form onSubmit={(event) => void submitReview(event)}>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="decision"
                      value="APPROVE_FOR_SIGNATURE"
                      checked={decision === 'APPROVE_FOR_SIGNATURE'}
                      onChange={() => setDecision('APPROVE_FOR_SIGNATURE')}
                    />
                    <CheckCircle size={16} style={{ color: '#16a34a' }} /> Approve for signature
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="decision"
                      value="REQUEST_CHANGES"
                      checked={decision === 'REQUEST_CHANGES'}
                      onChange={() => setDecision('REQUEST_CHANGES')}
                    />
                    <XCircle size={16} style={{ color: '#dc2626' }} /> Request changes
                  </label>
                </div>
                {decision === 'REQUEST_CHANGES' && (
                  <label style={{ display: 'block', marginBottom: '1rem' }}>
                    Customer-visible explanation * (required when requesting changes)
                    <textarea
                      value={customerComment}
                      onChange={(e) => setCustomerComment(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      required={decision === 'REQUEST_CHANGES'}
                      style={{ width: '100%' }}
                    />
                  </label>
                )}
                <label style={{ display: 'block', marginBottom: '1rem' }}>
                  Internal comment (admin-only, not shown to customer)
                  <textarea
                    value={internalComment}
                    onChange={(e) => setInternalComment(e.target.value)}
                    rows={3}
                    maxLength={10000}
                    style={{ width: '100%' }}
                  />
                </label>
                <button
                  type="submit"
                  className={`btn ${decision === 'APPROVE_FOR_SIGNATURE' ? 'btn-primary' : 'btn-outline'}`}
                  disabled={busy || !decision || (decision === 'REQUEST_CHANGES' && !customerComment.trim())}
                >
                  {busy ? 'Submitting…' : decision === 'APPROVE_FOR_SIGNATURE' ? 'Approve for signature' : 'Request changes'}
                </button>
              </form>
            </section>
          )}

          {/* Activate signed agreement */}
          {canActivate && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h3>Activate signed agreement</h3>
                  <p>Customer has uploaded the signed PDF. Verify and activate the agreement.</p>
                </div>
              </div>
              {canDownloadSigned && (
                <div style={{ marginBottom: '1rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => void downloadDoc('signed')} disabled={busy}>
                    <FileCheck2 size={15} /> Download signed PDF to verify
                  </button>
                </div>
              )}
              <form onSubmit={(event) => void activateAgreement(event)}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <label>
                    Effective date
                    <input
                      type="date"
                      value={activateEffectiveDate}
                      onChange={(e) => setActivateEffectiveDate(e.target.value)}
                    />
                  </label>
                  <label>
                    Expiry date
                    <input
                      type="date"
                      value={activateExpiryDate}
                      onChange={(e) => setActivateExpiryDate(e.target.value)}
                    />
                  </label>
                </div>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  <CheckCircle size={15} /> {busy ? 'Activating…' : 'Activate agreement'}
                </button>
              </form>
            </section>
          )}

          {/* Event history */}
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h3>Agreement history</h3>
                <p>{detail.events.length} event(s)</p>
              </div>
            </div>
            <div className="agreement-event-list">
              {detail.events.length === 0 && <p>No events yet.</p>}
              {detail.events.map((event, index) => (
                <div className="agreement-event" key={`${event.action_code}-${event.occurred_at}-${index}`}>
                  <strong>{statusLabel(event.action_code)}</strong>
                  {event.internal_comment && (
                    <div style={{ background: '#fef9c3', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.85em' }}>
                      <em>Internal:</em> {event.internal_comment}
                    </div>
                  )}
                  <span>{event.customer_visible_comment ?? 'Status updated'}</span>
                  <small>
                    {event.actor_name ? `${event.actor_name} · ` : ''}
                    {new Date(event.occurred_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {showSampleTemplate && (
        <AgreementSampleTemplateModal onClose={() => setShowSampleTemplate(false)} />
      )}
    </div>
  )
}
