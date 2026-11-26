export type CandidateProfile = {
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

export type CandidateEducation = {
  education_id: number
  qualification: string
  specialization: string | null
  institution: string | null
  passing_year: number | null
  grade_or_percentage: string | null
}

export type CandidateExperience = {
  experience_id: number
  employer_name: string
  designation: string
  start_date: string | null
  end_date: string | null
  is_current: number
}

export type CandidateSkill = {
  skill_id: number
  skill_name: string
  skill_category: string | null
  experience_years?: number | string | null
  proficiency?: string | null
}

export type CandidateRequirement = {
  requirement_id: number
  requirement_number: string
  job_title: string
  job_description: string
  headcount: number
  work_mode: string
  work_location: string | null
  experience_min_years: number | string | null
  experience_max_years: number | string | null
  employment_schedule: string
  target_join_date: string | null
  salary_min: number | string | null
  salary_max: number | string | null
  hours_per_week: number | string | null
  company_name: string
  job_profile_title: string
  has_applied: number
}

export type CandidateApplication = {
  application_id: number
  application_number: string
  status: string
  source: string
  applied_at: string
  requirement_id: number
  requirement_number: string
  job_title: string
  work_location: string | null
}

export type CandidateTimelineEvent = {
  old_status: string | null
  new_status: string
  change_reason: string | null
  changed_at: string
}

export type CandidateDashboardApplication = Pick<
  CandidateApplication,
  'application_id' | 'status' | 'applied_at'
>

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/candidate${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  })
  let result: { message?: string } & Record<string, unknown> = {}
  try {
    result = await response.json()
  } catch {
    if (!response.ok) throw new Error('The server returned an unexpected response.')
  }
  if (!response.ok) throw new Error(result.message || 'Candidate request failed.')
  return result as T
}

export const candidateApi = {
  dashboard: () => request<{
    profile: CandidateProfile
    skills: string[]
    applications: CandidateDashboardApplication[]
    metrics: { applications: number; interviews: number; resumes: number }
    profileCompletion: number
    resume_status: string
  }>('/dashboard'),

  profile: () => request<{
    profile: CandidateProfile
    education: CandidateEducation[]
    experience: CandidateExperience[]
    skills: CandidateSkill[]
  }>('/profile'),

  skillOptions: () => request<{ skills: Array<{ skill_id: number; skill_name: string; skill_category: string | null }> }>('/skills'),

  updateProfile: (profile: Record<string, string | number | null>) => request<{ message: string }>('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  }),

  saveEducation: (education: {
    educationId?: number
    qualification: string
    specialization: string
    institution: string
    passingYear: string
    grade: string
  }) => request<{ message: string }>('/education', {
    method: 'PUT',
    body: JSON.stringify(education),
  }),

  saveExperience: (experience: {
    experienceId?: number
    employerName: string
    designation: string
    startDate: string
    endDate: string
    isCurrent: boolean
  }) => request<{ message: string }>('/experience', {
    method: 'PUT',
    body: JSON.stringify(experience),
  }),

  updateSkills: (skillIds: number[]) => request<{ message: string }>('/skills', {
    method: 'PUT',
    body: JSON.stringify({ skillIds }),
  }),

  requirements: (search = '', location = '') => {
    const params = new URLSearchParams()
    if (search.trim()) params.set('search', search.trim())
    if (location.trim()) params.set('location', location.trim())
    return request<{ requirements: CandidateRequirement[] }>(`/requirements?${params.toString()}`)
  },

  apply: (requirementId: number) => request<{ applicationId: number; message: string }>(
    `/requirements/${requirementId}/apply`,
    { method: 'POST' },
  ),

  applications: () => request<{ applications: CandidateApplication[] }>('/applications'),

  timeline: (applicationId: number) => request<{
    application: CandidateDashboardApplication
    history: CandidateTimelineEvent[]
  }>(`/applications/${applicationId}/timeline`),

  withdraw: (applicationId: number) => request<{ message: string }>(
    `/applications/${applicationId}/withdraw`,
    { method: 'POST' },
  ),
}
