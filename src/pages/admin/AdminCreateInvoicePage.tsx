import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FilePlus2,
  FileText,
  RefreshCw,
  Receipt,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { workspaceApi } from '../../api/workspace'
import type { AdminInvoice, InvoiceableSelection } from '../../api/workspace'
import AdminInvoiceRegister from './AdminInvoiceRegister'

const amountFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function plusDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function formatAmount(value: number | string) {
  const amount = Number(value)
  return Number.isFinite(amount) ? amountFormatter.format(amount) : '—'
}

export default function AdminCreateInvoicePage() {
  const today = localDate(new Date())
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [selections, setSelections] = useState<InvoiceableSelection[]>([])
  const [placementId, setPlacementId] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(today)
  const [dueDate, setDueDate] = useState(today)
  const [description, setDescription] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [issuingId, setIssuingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const selectedCandidate = useMemo(
    () => selections.find((selection) => String(selection.placement_id) === placementId),
    [placementId, selections],
  )
  const invoiceStats = useMemo(() => {
    const drafts = invoices.filter((invoice) => invoice.status === 'DRAFT').length
    const issuedInvoices = invoices.filter((invoice) => invoice.status === 'ISSUED')
    return {
      drafts,
      issuedCount: issuedInvoices.length,
    }
  }, [invoices])
  const totalPreview = useMemo(() => {
    if (!unitPrice.trim()) return null
    const amount = Number(unitPrice)
    const rate = Number(taxRate)
    const subtotalCents = Math.round(amount * 100)
    if (!Number.isFinite(amount) || !Number.isFinite(rate)
      || amount < 0 || amount > 9999999999.99
      || rate < 0 || rate > 100
      || Math.abs(amount * 100 - subtotalCents) > 0.000001
      || Math.round(rate * 100) / 100 !== rate) {
      return null
    }
    const taxCents = Math.round(subtotalCents * Math.round(rate * 100) / 10000)
    return {
      subtotal: subtotalCents / 100,
      tax: taxCents / 100,
      total: (subtotalCents + taxCents) / 100,
    }
  }, [taxRate, unitPrice])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [invoiceRows, eligibleSelections] = await Promise.all([
        workspaceApi.listAdminInvoices(),
        workspaceApi.listInvoiceableSelections(),
      ])
      setInvoices(invoiceRows)
      setSelections(eligibleSelections)
      setPlacementId((current) => (
        eligibleSelections.some((selection) => String(selection.placement_id) === current)
          ? current
          : ''
      ))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load invoices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const chooseSelection = (value: string) => {
    setPlacementId(value)
    const selection = selections.find((item) => String(item.placement_id) === value)
    if (!selection) return
    const date = localDate(new Date())
    setInvoiceDate(date)
    setDueDate(plusDays(date, Number(selection.payment_terms_days) || 0))
    setDescription(`Placement fee - ${selection.candidate_name} - ${selection.job_title}`)
  }

  const createInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!placementId) {
      setError('Select a candidate whose application has been marked selected.')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.createAdminInvoice({
        invoiceNumber,
        placementId: Number(placementId),
        invoiceDate,
        dueDate,
        description,
        unitPrice: Number(unitPrice),
        taxRate: Number(taxRate),
      })
      setMessage(result.message)
      setInvoiceNumber('')
      setUnitPrice('')
      setTaxRate('0')
      setDescription('')
      setPlacementId('')
      await loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the invoice draft.')
    } finally {
      setSaving(false)
    }
  }

  const issueInvoice = async (invoice: AdminInvoice) => {
    if (!window.confirm(`Issue invoice ${invoice.invoice_number} to ${invoice.company_name}?`)) return
    setIssuingId(invoice.invoice_id)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.issueAdminInvoice(invoice.invoice_id)
      setMessage(result.message)
      await loadData()
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'Unable to issue this invoice.')
    } finally {
      setIssuingId(null)
    }
  }

  return (
    <div className="dashboard invoice-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FINANCE / BILLING</div>
          <h1>Create invoice</h1>
          <p>Prepare placement-fee invoices against approved customer service and agreement terms.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/admin/invoices" className="btn btn-outline">View invoices</Link>
          <button type="button" className="btn btn-outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="invoice-success-banner" role="status"><CheckCircle2 size={16} />{message}</div>}

      <section className="metric-grid invoice-metrics" aria-label="Invoice overview">
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon blue"><FileText size={18} /></span>
            <span className="invoice-metric-caption">REGISTER</span>
          </div>
          <div className="metric-value">{loading ? '—' : invoices.length}</div>
          <div className="metric-bottom"><span>Invoices in register</span></div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon orange"><Clock3 size={18} /></span>
            <span className="invoice-metric-caption">PRIVATE</span>
          </div>
          <div className="metric-value">{loading ? '—' : invoiceStats.drafts}</div>
          <div className="metric-bottom"><span>Drafts awaiting issue</span></div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon green"><CheckCircle2 size={18} /></span>
            <span className="invoice-metric-caption">ISSUED</span>
          </div>
          <div className="metric-value">{loading ? '—' : invoiceStats.issuedCount}</div>
          <div className="metric-bottom"><span>Visible to customers</span></div>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon violet"><Receipt size={18} /></span>
            <span className="invoice-metric-caption">ELIGIBLE</span>
          </div>
          <div className="metric-value">{loading ? '—' : selections.length}</div>
          <div className="metric-bottom"><span>Selected placements</span></div>
        </article>
      </section>

      <section className="panel invoice-create-panel">
        <div className="invoice-section-heading">
          <div className="invoice-section-icon"><FilePlus2 size={19} /></div>
          <div>
            <h2>Create a placement-fee draft</h2>
            <p>Select a placement, verify its agreement context, then enter approved manual pricing.</p>
          </div>
        </div>
        <div className="invoice-guidance">
          Amount and tax are entered manually from client-approved terms. The draft stays admin-only until you issue it.
        </div>
        <form onSubmit={(event) => void createInvoice(event)} className="invoice-form">
          <div className="invoice-form-grid">
            <label className="form-field invoice-field-wide">
              <span>Selected candidate and customer service *</span>
              <select required value={placementId} onChange={(event) => chooseSelection(event.target.value)}>
                <option value="">Select a candidate</option>
                {selections.map((selection) => (
                  <option key={selection.placement_id} value={selection.placement_id}>
                    {selection.candidate_name} - {selection.job_title} - {selection.company_name}
                    {' · '}{selection.service_name} · Agreement {selection.agreement_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Invoice number *</span>
              <input required maxLength={60} value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Invoice date *</span>
              <input required type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Due date *</span>
              <input required type="date" min={invoiceDate} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Placement fee amount *</span>
              <input required type="number" min="0" max="9999999999.99" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} />
            </label>
            <label className="form-field">
              <span>Tax rate (%) *</span>
              <input required type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
            </label>
            <label className="form-field invoice-field-wide">
              <span>Invoice line description *</span>
              <input required maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} />
              <small>Defaults to the selected candidate and requirement; edit if the approved terms require different wording.</small>
            </label>
          </div>
          {selectedCandidate && (
            <div className="invoice-context-card">
              <div className="invoice-context-title"><Building2 size={16} /> Customer and agreement context</div>
              <div className="invoice-context-grid">
                <div><small>Customer</small><strong>{selectedCandidate.company_name}</strong></div>
                <div><small>Agreement</small><strong>{selectedCandidate.agreement_number}</strong></div>
                <div><small>Service order</small><strong>{selectedCandidate.order_number} · {selectedCandidate.service_order_title}</strong></div>
                <div><small>Service type</small><strong>{selectedCandidate.service_name} · {label(selectedCandidate.employment_model)}</strong></div>
                <div><small>Selected candidate</small><strong>{selectedCandidate.candidate_name}</strong></div>
                <div><small>Payment terms</small><strong>{selectedCandidate.payment_terms_days} days</strong></div>
              </div>
            </div>
          )}
          <div className="invoice-form-footer">
            {totalPreview ? (
              <div className="invoice-total-preview" aria-live="polite">
                <div><span>Subtotal</span><strong>{formatAmount(totalPreview.subtotal)}</strong></div>
                <div><span>Tax</span><strong>{formatAmount(totalPreview.tax)}</strong></div>
                <div className="invoice-preview-total"><span>Draft total</span><strong>{formatAmount(totalPreview.total)}</strong></div>
              </div>
            ) : (
              <p className="invoice-preview-hint">Enter a valid fee and tax rate to preview the invoice total.</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving || loading || selections.length === 0}>
              <FilePlus2 size={15} /> {saving ? 'Creating draft…' : 'Create draft invoice'}
            </button>
          </div>
          {selections.length === 0 && !loading && (
            <p className="invoice-empty-hint">No invoiceable selections. Mark an eligible application as selected in the recruiter workspace first.</p>
          )}
        </form>
      </section>

      <AdminInvoiceRegister
        invoices={invoices}
        loading={loading}
        issuingId={issuingId}
        recentOnly
        onIssue={(invoice) => void issueInvoice(invoice)}
      />
    </div>
  )
}
