export interface RecruiterRequirement {
  requirement_id: number
  requirement_code: string
  job_title: string
  open_positions: number
  status: string
  priority: string
  created_at: string
  customer_id: number
  company_name: string
  job_profile_title: string | null
  total_submissions: number
}

export interface Candidate {
  candidate_id: number
  full_name: string
  email: string
  phone: string
  current_title: string | null
  current_company: string | null
  total_experience_years: number
  current_location: string
  preferred_locations: string | null
  primary_skills: string
  notice_period_days: number
  current_ctc: number | null
  expected_ctc: number | null
  resume_path: string | null
  status: string
  created_at: string
}

export interface RequirementSubmission {
  application_id: number
  requirement_id: number
  candidate_id: number
  application_status: string
  submitted_at: string
  candidate_name: string
  candidate_email: string
  candidate_phone: string
  total_experience_years: number
  current_location: string
  primary_skills: string
  resume_path: string | null
  share_id: number | null
  access_token: string | null
  access_expires_at: string | null
  customer_decision: string | null
  decision_notes: string | null
  share_is_active: number | null
  share_is_valid: number
}

export interface CustomerSharedCandidate {
  share_id: number
  application_id: number
  candidate_id: number
  requirement_id: number
  access_expires_at: string
  is_active: number
  customer_decision: 'SHORTLIST' | 'REJECT' | 'HOLD' | null
  decision_notes: string | null
  decision_timestamp: string | null
  is_accessible: number
  minutes_remaining: number
  requirement_code: string
  job_title: string
  candidate_name: string
  current_title: string | null
  total_experience_years: number
  current_location: string
  primary_skills: string
  expected_ctc: number | null
  notice_period_days: number
  screening_notes: string | null
  company_name: string
}
