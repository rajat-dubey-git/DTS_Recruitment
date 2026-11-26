export type EligibleOfferSelection = {
  selection_id: number
  application_id: number
  selected_at: string
  agreed_ctc: number | string | null
  application_number: string
  requirement_number: string
  job_title: string
  candidate_id: number
  candidate_name: string
  candidate_email: string | null
  candidate_user_id: number | null
  candidate_user_status: string | null
  company_name: string
  offer_id: number | null
  offer_reference: string | null
  offer_status: string | null
  offered_at: string | null
}

export type CandidateOffer = {
  offer_id: number
  offer_reference: string | null
  offered_ctc: number | string | null
  offered_at: string | null
  expires_at: string | null
  proposed_joining_date: string | null
  status: string
  application_number: string
  requirement_number: string
  job_title: string
  company_name: string
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Offer request failed.')
  return result as T
}

export const offerApi = {
  adminSelections: () => jsonRequest<{ selections: EligibleOfferSelection[] }>(
    '/api/admin/offers/eligible-selections',
  ),

  sendAdmin: (selectionId: number, form: FormData) => jsonRequest<{ message: string; offerId: number }>(
    `/api/admin/selections/${selectionId}/offers`,
    { method: 'POST', body: form },
  ),

  sendRecruiter: (selectionId: number, form: FormData) => jsonRequest<{ message: string; offerId: number }>(
    `/api/recruiter/selections/${selectionId}/offers`,
    { method: 'POST', body: form },
  ),

  candidateOffers: () => jsonRequest<{ offers: CandidateOffer[] }>('/api/candidate/offers'),

  respond: (offerId: number, response: 'ACCEPTED' | 'DECLINED') => jsonRequest<{ message: string }>(
    `/api/candidate/offers/${offerId}/respond`,
    { method: 'POST', body: JSON.stringify({ response }) },
  ),

  async download(offerId: number) {
    const response = await fetch(`/api/candidate/offers/${offerId}/download`, {
      credentials: 'include',
    })
    if (!response.ok) {
      let message = 'Unable to download the offer document.'
      try {
        const result = await response.json()
        if (result.message) message = result.message
      } catch {
        // Keep the download error explicit when the response is not JSON.
      }
      throw new Error(message)
    }
    return response.blob()
  },
}
