import { Building2, CalendarDays, Download } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { AdminInvoice } from '../../api/workspace'
import PaginationControls, { useListPagination } from '../../components/PaginationControls'

type AdminInvoiceRegisterProps = {
  invoices: AdminInvoice[]
  loading: boolean
  issuingId: number | null
  recentOnly?: boolean
  onIssue: (invoice: AdminInvoice) => void
}

function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

function label(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

function formatAmount(value: number | string) {
  const amount = Number(value)
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    : '—'
}

export default function AdminInvoiceRegister({
  invoices,
  loading,
  issuingId,
  recentOnly = false,
  onIssue,
}: AdminInvoiceRegisterProps) {
  const visibleInvoices = recentOnly ? invoices.slice(0, 3) : invoices
  const invoicePage = useListPagination(visibleInvoices)

  return (
    <section className="panel invoice-register-panel">
      <div className="customer-toolbar">
        <div>
          <h2>{recentOnly ? 'Recently created invoices' : 'Invoice register'}</h2>
          <p>
            {recentOnly
              ? 'Showing up to 3 newest invoices. Drafts stay private until issued.'
              : `${invoices.length} invoices · Drafts stay private; issued invoices appear in the customer portal.`}
          </p>
        </div>
        {recentOnly && (
          <Link to="/app/admin/invoices" className="btn btn-outline">View all invoices</Link>
        )}
      </div>
      {loading ? (
        <div className="customer-empty">Loading invoices…</div>
      ) : invoices.length === 0 ? (
        <div className="customer-empty">No invoices have been created.</div>
      ) : (
        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Customer</th>
                <th>Agreement</th>
                <th>Service order</th>
                <th>Invoice date</th>
                <th>Due date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoicePage.items.map((invoice) => (
                <tr key={invoice.invoice_id}>
                  <td>
                    <div className="invoice-primary-cell">
                      <strong>{invoice.invoice_number}</strong>
                      <small>{invoice.item_count} {invoice.item_count === 1 ? 'line item' : 'line items'}</small>
                    </div>
                  </td>
                  <td><span className="invoice-customer-cell"><Building2 size={14} />{invoice.company_name}</span></td>
                  <td>{invoice.agreement_number}</td>
                  <td>{invoice.order_number}</td>
                  <td>{dateLabel(invoice.invoice_date)}</td>
                  <td><span className="invoice-date-cell"><CalendarDays size={13} />{dateLabel(invoice.due_date)}</span></td>
                  <td className="invoice-amount-cell">{formatAmount(invoice.total_amount)}</td>
                  <td><span className={`invoice-status-pill ${invoice.status.toLowerCase()}`}>{label(invoice.status)}</span></td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => window.open(`/api/customer/invoices/${invoice.invoice_id}/download`, '_blank', 'noopener,noreferrer')}
                      >
                        <Download size={13} /> PDF
                      </button>
                      {invoice.status === 'DRAFT' && (
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={issuingId === invoice.invoice_id}
                          onClick={() => onIssue(invoice)}
                        >
                          {issuingId === invoice.invoice_id ? 'Issuing…' : 'Issue invoice'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!recentOnly && !loading && (
        <PaginationControls
          page={invoicePage.page}
          pageCount={invoicePage.pageCount}
          total={invoicePage.total}
          onPageChange={invoicePage.setPage}
        />
      )}
    </section>
  )
}
