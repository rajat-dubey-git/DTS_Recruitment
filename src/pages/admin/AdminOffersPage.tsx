import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { offerApi } from '../../api/offers'
import type { EligibleOfferSelection } from '../../api/offers'
import OfferUploadForm from '../../components/OfferUploadForm'
import PaginationControls, { useListPagination } from '../../components/PaginationControls'

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (letter) => letter.toUpperCase())
}

export default function AdminOffersPage() {
  const [selections, setSelections] = useState<EligibleOfferSelection[]>([])
  const [selectionId, setSelectionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadSelections = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await offerApi.adminSelections()
      setSelections(result.selections)
      setSelectionId((current) => result.selections.some((item) => String(item.selection_id) === current)
        ? current
        : '')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load selected candidates.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadSelections() }, [loadSelections])

  const selected = useMemo(
    () => selections.find((item) => String(item.selection_id) === selectionId) ?? null,
    [selectionId, selections],
  )
  const selectionPage = useListPagination(selections)

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMIN WORKSPACE</div>
          <h1>Offer letters</h1>
          <p>Upload an offer PDF for a selected candidate and send it to their candidate portal.</p>
        </div>
        <span className="agreement-status">{selections.length} selected candidates</span>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div><h3>Selected candidates</h3><p>Only selections can receive offers.</p></div>
            <FileText size={18} />
          </div>
          {loading ? <p className="customer-empty">Loading candidates…</p>
            : selections.length === 0 ? <p className="customer-empty">No selected candidates are ready for an offer.</p>
              : (
                <div className="offer-selection-list">
                  {selectionPage.items.map((item) => (
                    <button
                      type="button"
                      key={item.selection_id}
                      className={`offer-selection-card ${selectionId === String(item.selection_id) ? 'selected' : ''}`}
                      onClick={() => setSelectionId(String(item.selection_id))}
                    >
                      <span>
                        <strong>{item.candidate_name}</strong>
                        <small>{item.job_title} · {item.company_name}</small>
                        <small>{item.application_number} · {item.requirement_number}</small>
                      </span>
                      <span className="offer-selection-status">
                        {item.candidate_user_status === 'ACTIVE' ? (
                          item.offer_status ? statusLabel(item.offer_status) : 'Ready to send'
                        ) : 'Candidate portal unavailable'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
          <PaginationControls
            page={selectionPage.page}
            pageCount={selectionPage.pageCount}
            total={selectionPage.total}
            onPageChange={selectionPage.setPage}
          />
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div><h3>Send an offer</h3><p>Offer details are optional; the uploaded PDF is required.</p></div>
          </div>
          {!selected ? (
            <p className="customer-empty">Choose a selected candidate to prepare an offer.</p>
          ) : selected.candidate_user_status !== 'ACTIVE' ? (
            <p className="customer-form-error">This candidate needs an active portal account before an offer can be delivered.</p>
          ) : (
            <>
              <p className="offer-selected-summary">
                <strong>{selected.candidate_name}</strong> · {selected.job_title} · {selected.company_name}
              </p>
              <OfferUploadForm
                onSubmit={(form) => offerApi.sendAdmin(selected.selection_id, form)}
                onSuccess={(successMessage) => {
                  setMessage(successMessage)
                  void loadSelections()
                }}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}
