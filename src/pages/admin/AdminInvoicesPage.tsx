import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { workspaceApi } from '../../api/workspace'
import type { AdminInvoice } from '../../api/workspace'
import AdminInvoiceRegister from './AdminInvoiceRegister'

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<AdminInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [issuingId, setIssuingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setInvoices(await workspaceApi.listAdminInvoices())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load invoices.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInvoices()
  }, [loadInvoices])

  const issueInvoice = async (invoice: AdminInvoice) => {
    if (!window.confirm(`Issue invoice ${invoice.invoice_number} to ${invoice.company_name}?`)) return
    setIssuingId(invoice.invoice_id)
    setError('')
    setMessage('')
    try {
      const result = await workspaceApi.issueAdminInvoice(invoice.invoice_id)
      setMessage(result.message)
      await loadInvoices()
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
          <h1>Invoices</h1>
          <p>Review the invoice register, download PDFs, and issue draft invoices to customers.</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={() => void loadInvoices()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="invoice-success-banner" role="status">{message}</div>}

      <AdminInvoiceRegister
        invoices={invoices}
        loading={loading}
        issuingId={issuingId}
        onIssue={(invoice) => void issueInvoice(invoice)}
      />
    </div>
  )
}
