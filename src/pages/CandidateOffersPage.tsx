import { useCallback, useEffect, useState } from 'react'
import { Check, Download, X } from 'lucide-react'
import { offerApi } from '../api/offers'
import type { CandidateOffer } from '../api/offers'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

function money(value: number | string | null) {
  if (value === null) return 'Not stated'
  const amount = Number(value)
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : 'Not stated'
}

function dateLabel(value: string | null) {
  if (!value) return 'Not stated'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export default function CandidateOffersPage() {
  const [offers, setOffers] = useState<CandidateOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyOfferId, setBusyOfferId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const offerPage = useListPagination(offers)

  const loadOffers = useCallback(async () => {
    setError('')
    try {
      const result = await offerApi.candidateOffers()
      setOffers(result.offers)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load offers.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadOffers() }, [loadOffers])

  const download = async (offer: CandidateOffer) => {
    setBusyOfferId(offer.offer_id)
    setError('')
    try {
      const blob = await offerApi.download(offer.offer_id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${offer.offer_reference || `offer-${offer.offer_id}`}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the offer.')
    } finally {
      setBusyOfferId(null)
    }
  }

  const respond = async (offer: CandidateOffer, response: 'ACCEPTED' | 'DECLINED') => {
    const verb = response === 'ACCEPTED' ? 'accept' : 'decline'
    if (!window.confirm(`Are you sure you want to ${verb} this offer?`)) return
    setBusyOfferId(offer.offer_id)
    setError('')
    setMessage('')
    try {
      const result = await offerApi.respond(offer.offer_id, response)
      setMessage(result.message)
      await loadOffers()
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Unable to respond to the offer.')
    } finally {
      setBusyOfferId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Candidate portal</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-800">My offer letters</h1>
        <p className="mt-1 text-sm text-slate-500">Review, download, and respond to offers sent to your account.</p>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {message && <div className="database-read-only" role="status">{message}</div>}

      {loading ? <div className="panel database-message" role="status">Loading offers…</div>
        : offers.length === 0 ? (
          <div className="panel database-message">No offer letters have been sent to you yet.</div>
        ) : (
          <div className="space-y-4">
            {offerPage.items.map((offer) => (
              <article key={offer.offer_id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-slate-800">{offer.job_title}</h2>
                      <span className={`offer-status ${offer.status.toLowerCase()}`}>{offer.status.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{offer.company_name}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {offer.offer_reference || `Offer ${offer.offer_id}`} · Application {offer.application_number}
                    </p>
                    <dl className="offer-details">
                      <div><dt>Offered CTC</dt><dd>{money(offer.offered_ctc)}</dd></div>
                      <div><dt>Expires</dt><dd>{dateLabel(offer.expires_at)}</dd></div>
                      <div><dt>Proposed joining</dt><dd>{dateLabel(offer.proposed_joining_date)}</dd></div>
                    </dl>
                    <p className="offer-amount-note">Amounts are shown as stated in the offer document.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={busyOfferId !== null}
                      onClick={() => void download(offer)}
                    >
                      <Download size={15} /> Download PDF
                    </button>
                    {offer.status === 'SENT' && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busyOfferId !== null}
                          onClick={() => void respond(offer, 'ACCEPTED')}
                        >
                          <Check size={15} /> Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={busyOfferId !== null}
                          onClick={() => void respond(offer, 'DECLINED')}
                        >
                          <X size={15} /> Decline
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))}
            <PaginationControls
              page={offerPage.page}
              pageCount={offerPage.pageCount}
              total={offerPage.total}
              onPageChange={offerPage.setPage}
            />
          </div>
        )}
    </div>
  )
}
