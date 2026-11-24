import { Candidate, CustomerSharedCandidate, RecruiterRequirement, RequirementSubmission } from '../types/recruitment'

const API_BASE = '/api'

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.message || 'Request failed')
  }
  return data
}

export async function fetchRecruiterRequirements(): Promise<{ requirements: RecruiterRequirement[] }> {
  const res = await fetch(`${API_BASE}/recruiter/requirements`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  return handleResponse(res)
}

export async function fetchRequirementSubmissions(requirementId: number): Promise<{ submissions: RequirementSubmission[] }> {
  const res = await fetch(`${API_BASE}/recruiter/requirements/${requirementId}/submissions`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  return handleResponse(res)
}

export async function searchCandidates(params: {
  query?: string
  skill?: string
  location?: string
  experienceMin?: number
  experienceMax?: number
}): Promise<{ candidates: Candidate[] }> {
  const searchParams = new URLSearchParams()
  if (params.query) searchParams.set('query', params.query)
  if (params.skill) searchParams.set('skill', params.skill)
  if (params.location) searchParams.set('location', params.location)
  if (params.experienceMin) searchParams.set('experienceMin', String(params.experienceMin))
  if (params.experienceMax) searchParams.set('experienceMax', String(params.experienceMax))

  const res = await fetch(`${API_BASE}/recruiter/candidates?${searchParams.toString()}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  return handleResponse(res)
}

export async function submitCandidateToRequirement(payload: {
  candidateId: number
  requirementId: number
  screeningNotes?: string
}): Promise<{ applicationId: number; message: string }> {
  const res = await fetch(`${API_BASE}/recruiter/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  return handleResponse(res)
}

export async function createResumeShare(applicationId: number): Promise<{ shareId: number; accessToken: string; message: string }> {
  const res = await fetch(`${API_BASE}/recruiter/resume-shares`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ applicationId }),
  })
  return handleResponse(res)
}

export async function fetchCustomerSharedCandidates(): Promise<{ candidates: CustomerSharedCandidate[] }> {
  const res = await fetch(`${API_BASE}/customer/candidates`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })
  return handleResponse(res)
}

export async function submitCandidateDecision(
  shareId: number,
  decision: 'SHORTLIST' | 'REJECT' | 'HOLD',
  notes?: string
): Promise<{ message: string; decision: string }> {
  const res = await fetch(`${API_BASE}/customer/candidates/${shareId}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ decision, notes }),
  })
  return handleResponse(res)
}
