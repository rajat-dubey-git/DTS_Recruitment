export interface RecruiterRequirement {
  requirement_id: number
  requirement_code: string
  job_title: string
  job_description: string
  open_positions: number
  status: string
  work_mode: 'ONSITE' | 'REMOTE' | 'HYBRID'
  work_location: string | null
  experience_min_years: number | string | null
  experience_max_years: number | string | null
  employment_schedule: 'FULL_TIME' | 'PART_TIME'
  hours_per_week: number | string | null
  salary_min: number | string | null
  salary_max: number | string | null
  target_join_date: string | null
  created_at: string
  customer_id: number
  company_name: string
  job_profile_title: string | null
  assignment_role: 'LEAD' | 'SUPPORT' | 'ADMIN'
  total_submissions: number
}

export interface Candidate {
  candidate_id: number
  candidate_code: string
  full_name: string
  total_experience_years: number | string | null
  current_location: string
  current_ctc: number | string | null
  expected_ctc: number | string | null
  notice_period_days: number | null
  profile_summary: string | null
  primary_skills: string | null
  resume_verification_status: string | null
  resume_malware_scan_status: string | null
  matched_skills: string[]
  missing_mandatory_skills: string[]
  required_skill_count: number
  matched_skill_count: number
  match_score: number | null
  meets_experience: boolean
  status: string
  created_at: string
}

export interface RecruiterCandidateDetails {
  candidate: {
    candidate_id: number
    candidate_code: string
    first_name: string
    last_name: string | null
    email: string | null
    mobile: string
    current_city: string | null
    current_state: string | null
    total_experience_years: number | string | null
    current_ctc: number | string | null
    expected_ctc: number | string | null
    notice_period_days: number | null
    profile_summary: string | null
    status: string
  }
  education: Array<{
    education_id: number
    qualification: string
    specialization: string | null
    institution: string | null
    passing_year: number | null
    grade_or_percentage: string | null
  }>
  experience: Array<{
    experience_id: number
    employer_name: string
    designation: string
    start_date: string | null
    end_date: string | null
    is_current: number
  }>
  skills: Array<{
    skill_id: number
    skill_name: string
    skill_category: string | null
    experience_years: number | string | null
    proficiency: string | null
  }>
  match: {
    requiredSkillCount: number
    matchedSkillCount: number
    matchedSkills: string[]
    missingMandatorySkills: string[]
    score: number | null
    meetsExperience: boolean
  } | null
  resume: {
    document_id: number
    file_name: string
    uploaded_at: string
    file_size_bytes: number | null
    verification_status: string
    malware_scan_status: string
    available: boolean
    download_url: string
  } | null
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
  total_experience_years: number | string | null
  current_location: string | null
  primary_skills: string | null
  resume_verification_status: string | null
  resume_malware_scan_status: string | null
  share_id: number | null
  access_expires_at: string | null
  share_status: string | null
  share_is_valid: number
}

export interface RecruiterApplication {
  application_id: number
  application_number: string
  status: string
  applied_at: string
  requirement_id: number
  candidate_id: number
  selection_id: number | null
  candidate_name: string
  candidate_email: string
  candidate_mobile: string | null
  requirement_number: string
  job_title: string
  company_name: string
  recruiter_name: string | null
}

export interface RecruiterInterview {
  interview_id: number
  application_id: number
  round_number: number
  interview_type: 'PHONE' | 'VIDEO' | 'IN_PERSON'
  scheduled_start: string
  scheduled_end: string
  location_or_link: string | null
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RESCHEDULED'
  application_number: string
  application_status: string
  candidate_name: string
  requirement_number: string
  job_title: string
  company_name: string
  interviewer_name: string | null
}

export interface CustomerSharedCandidate {
  share_id: number
  application_id: number
  candidate_id: number
  requirement_id: number
  access_expires_at: string | null
  share_status: 'SHARED' | 'VIEWED' | 'EXPIRED' | 'REVOKED'
  customer_decision: 'SHORTLIST' | 'REJECT' | 'HOLD' | null
  decision_notes: string | null
  is_accessible: number
  minutes_remaining: number
  requirement_code: string
  job_title: string
  candidate_name: string
  total_experience_years: number | string | null
  current_location: string | null
  primary_skills: string | null
  expected_ctc: number | string | null
  notice_period_days: number | null
  company_name: string
}
