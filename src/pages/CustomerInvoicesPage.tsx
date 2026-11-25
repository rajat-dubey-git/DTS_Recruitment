import { useEffect, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { workspaceApi } from '../api/workspace'

export default function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const result = await workspaceApi.listCustomerInvoices()
        if (active) setInvoices(Array.isArray(result) ? result : [])
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Error loading invoices.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const query = search.trim().toLowerCase()
  const filteredInvoices = invoices.filter((inv) =>
    (inv.invoice_number?.toLowerCase()?.includes(query) ?? false) ||
    (inv.date?.toLowerCase()?.includes(query) ?? false) ||
    (inv.total_amount?.toString()?.toLowerCase()?.includes(query) ?? false) ||
    (inv.status?.toLowerCase()?.includes(query) ?? false)
  )

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>My Invoices</h1>
          <p>View and download invoices for your company.</p>
        </div>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3>Invoices</h3>
            <p>{filteredInvoices.length} records</p>
          </div>
          <div className="customer-search">
            <Search size={16} />
            <input
              aria-label="Search invoices"
              placeholder="Search invoices..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Date</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredInvoices.map((invoice, index) => (
                <tr key={invoice.invoice_id ?? invoice.invoice_number ?? index}>
                  <td>{invoice.invoice_number ?? '—'}</td>
                  <td>{invoice.date ?? '—'}</td>
                  <td>{invoice.due_date ?? '—'}</td>
                  <td>{invoice.total_amount ?? '—'}</td>
                  <td>{invoice.status ?? '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                      onClick={() => {
                      if (invoice.invoice_id) {
                        window.open(`/api/customer/invoices/${invoice.invoice_id}/download`, '_blank', 'noopener,noreferrer')
                      }
                      }}
                    >
                      <Download size={13} /> Download
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <strong>No invoices found</strong>
                      <span>
                        {invoices.length === 0
                          ? 'Invoices will appear here after agreement approval.'
                          : 'Try adjusting your search query.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <span>Loading invoices…</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}