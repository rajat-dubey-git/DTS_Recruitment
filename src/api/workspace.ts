import axios from 'axios'
import { http } from './http'

export type DashboardAnalytics = {
  role: 'ADMIN' | 'CUSTOMER' | 'RECRUITER' | 'CANDIDATE'
  asOf: string
  timezone: string
  currency: string
  metrics: Array<{
    key: string
    label: string
    value: number
  }>
  charts: Array<{
    key: string
    title: string
    items: Array<{
      label: string
      value: number
    }>
  }>
}

export type WorkspaceRecord = Record<string, string | number | null>

export type WorkspacePage = {
  rows: WorkspaceRecord[]
  total: number
  limit: number
  offset: number
  filterOptions?: Record<string, Array<string | number>>
}

export type AdminModule =
  | 'customers'
  | 'customer-addresses'
  | 'customer-contacts'
  | 'recruiters'
  | 'users'
  | 'skills'
  | 'service-types'
  | 'job-profiles'
  | 'agreements'
  | 'rate-cards'
  | 'service-orders'
  | 'requirements'
  | 'requirement-intakes'

export type CreatableModule =
  | 'customers'
  | 'skills'
  | 'service-types'
  | 'job-profiles'
  | 'agreements'
  | 'rate-cards'
  | 'service-orders'

export type RequirementIntakeOptions = {
  request: {
    companyName: string
    jobTitle: string
    skills: string[]
    jobDescription: string
    headcount: number
    workMode: string
    workLocation: string | null
    experienceMinYears: number | null
    experienceMaxYears: number | null
    salaryMin: number | null
    salaryMax: number | null
    employmentSchedule: string
    hoursPerWeek: number | null
    targetJoinDate: string | null
  }
  jobProfiles: Array<{ job_profile_id: number; profile_code: string; profile_name: string }>
  serviceOrders: Array<{
    service_order_id: number
    order_number: string
    title: string
    agreement_number: string
  }>
}

export type RequirementCreationOptions = {
  jobProfiles: Array<{ job_profile_id: number; profile_code: string; profile_name: string }>
  serviceOrders: Array<{
    service_order_id: number
    order_number: string
    title: string
    agreement_number: string
    company_name: string
  }>
}

export type RequirementIntakeForm = {
  companyName: string
  expiresAt: string
}

export type RequirementIntakeResult = {
  intakeId: number
  companyName: string
  recipientEmail: string
  expiresAt: string
  intakeUrl?: string
}

export type CustomerRequirementRequest = {
  intake_id: number
  job_title: string | null
  skills_requested: string[]
  headcount: number | null
  work_mode: string | null
  employment_schedule: string | null
  status: string
  submitted_at: string | null
  created_at: string
  requirement_id: number | null
  requirement_number: string | null
  requirement_status: string | null
}

export type CustomerRequirement = {
  requirement_id: number
  requirement_number: string
  job_title: string
  headcount: number
  status: string
  work_mode: string
  work_location: string | null
  employment_schedule: string
  created_at: string
  order_number: string
}

export type CustomerRequirementInput = {
  jobTitle: string
  skills: string[]
  jobDescription: string
  headcount: number
  workMode: 'ONSITE' | 'REMOTE' | 'HYBRID'
  workLocation: string
  experienceMinYears: number | null
  experienceMaxYears: number | null
  salaryMin: number | null
  salaryMax: number | null
  employmentSchedule: 'FULL_TIME' | 'PART_TIME'
  hoursPerWeek: number | null
  targetJoinDate: string | null
}

export type CustomerJobProfile = {
  job_profile_id: number
  profile_code: string
  profile_name: string
  category: string | null
  default_experience_min: number | string | null
  default_experience_max: number | string | null
  status: string
}

export type CustomerRecruiter = {
  assignment_id: number
  assignment_role: 'LEAD' | 'SUPPORT'
  assigned_at: string
  requirement_id: number
  requirement_number: string
  job_title: string
  full_name: string
  email: string
}

export type CustomerInterview = {
  interview_id: number
  round_number: number
  interview_type: 'PHONE' | 'VIDEO' | 'IN_PERSON'
  scheduled_start: string
  scheduled_end: string
  location_or_link: string | null
  status: string
  application_number: string
  requirement_number: string
  job_title: string
  candidate_name: string
  interviewer_name: string | null
}

export type AdminInvoice = {
  invoice_id: number
  invoice_number: string
  invoice_type: string
  invoice_date: string
  due_date: string
  subtotal: number | string
  discount_amount: number | string
  tax_total: number | string
  total_amount: number | string
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED'
  order_number: string
  agreement_number: string
  company_name: string
  item_count: number
}

export type CustomerInvoice = {
  invoice_id: number
  invoice_number: string
  invoice_type: string
  invoice_date: string
  due_date: string
  service_period_start: string | null
  service_period_end: string | null
  subtotal: number | string
  discount_amount: number | string
  tax_total: number | string
  total_amount: number | string
  status: string
  order_number: string
  company_name: string
}

export type InvoiceableSelection = {
  placement_id: number
  selection_id: number
  application_id: number
  selected_at: string
  application_number: string
  requirement_number: string
  job_title: string
  service_order_id: number
  order_number: string
  service_order_title: string
  agreement_number: string
  service_name: string
  employment_model: 'DTS_PAYROLL' | 'CUSTOMER_PAYROLL'
  customer_id: number
  company_name: string
  payment_terms_days: number
  candidate_name: string
}

export type AdminInvoiceDraftInput = {
  invoiceNumber: string
  placementId: number
  invoiceDate: string
  dueDate: string
  description: string
  unitPrice: number
  taxRate: number
}

export type InvitationResult = {
  user: {
    userId: number
    fullName: string
    email: string
    mobile: string | null
    role: string
    status: string
  }
  invitationUrl?: string
  expiresAt: string
}

export type InvitationRole = 'RECRUITER' | 'CUSTOMER' | 'CANDIDATE'

export type AgreementCatalog = {
  customers: Array<{ customer_id: number; company_name: string }>
  serviceTypes: Array<{
    service_type_id: number
    service_code: string
    service_name: string
    employment_model: 'DTS_PAYROLL' | 'CUSTOMER_PAYROLL'
  }>
  jobProfiles: Array<{ job_profile_id: number; profile_code: string; profile_name: string }>
}

export type AgreementServiceLineInput = {
  serviceTypeId: number
  jobProfileId: number
  employmentSchedule: 'FULL_TIME' | 'PART_TIME'
  hoursPerWeek: number | null
  headcount: number
  scopeDescription?: string
  feeValue?: number
}

export type AgreementDetail = {
  agreement: {
    agreementId: number
    agreementNumber: string
    customerId: number
    companyName: string
    title: string
    status: string
    effectiveDate: string | null
    expiryDate: string | null
    signedDate: string | null
  }
  version: {
    agreementVersionId: number
    versionNumber: number
    status: string
    changeReason: string | null
    internalReviewNote?: string | null
    canDownloadDraft: boolean
    canDownloadSignedCopy: boolean
    createdAt: string
    reviewedAt: string | null
    signedUploadedAt: string | null
    activatedAt: string | null
  } | null
  serviceLines: Array<{
    agreement_service_line_id: number
    service_type_id: number
    service_code: string
    service_name: string
    employment_model: 'DTS_PAYROLL' | 'CUSTOMER_PAYROLL'
    job_profile_id: number
    profile_code: string
    profile_name: string
    employment_schedule: 'FULL_TIME' | 'PART_TIME'
    hours_per_week: number | null
    headcount: number
    scope_description: string | null
    fee_type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'SALARY_MONTHS'
    fee_basis: 'MONTHLY_SALARY' | 'ANNUAL_CTC' | 'HOURLY' | 'PER_PLACEMENT'
    fee_value: number
    currency: string
    quoted_fee_amount: number | null
  }>
  events: Array<{
    action_code: string
    previous_status: string | null
    new_status: string | null
    customer_visible_comment: string | null
    internal_comment?: string | null
    occurred_at: string
    actor_name: string | null
  }>
}

export type AgreementListItem = {
  agreement_id: number
  agreement_number: string
  customer_id: number
  company_name: string
  title: string
  status: string
  effective_date: string | null
  expiry_date: string | null
  signed_date: string | null
  agreement_version_id: number | null
  version_number: number | null
  version_status: string | null
  change_reason: string | null
  has_draft_document: number | boolean
  has_signed_document: number | boolean
  created_at: string
}

function messageFrom(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

export const workspaceApi = {
  async dashboard() {
    try {
      const response = await http.get<DashboardAnalytics>('/dashboard/analytics')
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load dashboard data.'))
    }
  },

  async agreementCatalog() {
    try {
      const response = await http.get<AgreementCatalog>('/agreements/customer/catalog')
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load agreement options.'))
    }
  },

  async listCustomerAgreements() {
    try {
      const response = await http.get<{ agreements: AgreementListItem[] }>('/agreements/customer')
      return response.data.agreements
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load customer agreements.'))
    }
  },

  async listCustomerInvoices() {
    try {
      const response = await http.get<{ invoices: CustomerInvoice[] }>('/customer/invoices')
      return response.data.invoices
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load customer invoices.'))
    }
  },

  async listAdminInvoices() {
    try {
      const response = await http.get<{ invoices: AdminInvoice[] }>('/admin/invoices')
      return response.data.invoices
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load invoices.'))
    }
  },

  async listInvoiceableSelections() {
    try {
      const response = await http.get<{ selections: InvoiceableSelection[] }>(
        '/admin/invoices/eligible-selections',
      )
      return response.data.selections
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load selected candidates for invoicing.'))
    }
  },

  async createAdminInvoice(values: AdminInvoiceDraftInput) {
    try {
      const response = await http.post<{ invoiceId: number; message: string }>('/admin/invoices', values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to create the invoice draft.'))
    }
  },

  async issueAdminInvoice(invoiceId: number) {
    try {
      const response = await http.post<{ message: string }>(`/admin/invoices/${invoiceId}/issue`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to issue this invoice.'))
    }
  },

  async deleteUserAccount(userId: number) {
    try {
      const response = await http.delete<{ message: string }>(`/admin/users/${userId}`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to delete this user account.'))
    }
  },

  async listCustomerRequirements() {
    try {
      const response = await http.get<{
        requests: CustomerRequirementRequest[]
        requirements: CustomerRequirement[]
      }>('/customer/requirements')
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load customer requirements.'))
    }
  },

  async createCustomerRequirement(values: CustomerRequirementInput) {
    try {
      const response = await http.post<{ intakeId: number; message: string }>(
        '/customer/requirements',
        values,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to submit this requirement.'))
    }
  },

  async listCustomerJobProfiles() {
    try {
      const response = await http.get<{ jobProfiles: CustomerJobProfile[] }>('/customer/job-profiles')
      return response.data.jobProfiles
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load available job profiles.'))
    }
  },

  async listCustomerRecruiters() {
    try {
      const response = await http.get<{ recruiters: CustomerRecruiter[] }>('/customer/recruiters')
      return response.data.recruiters
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load assigned recruiters.'))
    }
  },

  async listCustomerInterviews() {
    try {
      const response = await http.get<{ interviews: CustomerInterview[] }>('/customer/interviews')
      return response.data.interviews
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load customer interviews.'))
    }
  },

  async createCustomerAgreement(values: {
    customerId: number
    requestKey: string
    serviceLines: AgreementServiceLineInput[]
  }) {
    try {
      const response = await http.post<AgreementDetail>('/agreements/customer', values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to submit the agreement request.'))
    }
  },

  async customerAgreement(agreementId: number) {
    try {
      const response = await http.get<AgreementDetail>(`/agreements/customer/${agreementId}`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load this agreement.'))
    }
  },

  async adminAgreement(agreementId: number) {
    try {
      const response = await http.get<AgreementDetail>(`/agreements/admin/${agreementId}`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load this agreement for review.'))
    }
  },

  async saveAdminAgreementTerms(
    agreementId: number,
    versionId: number,
    values: {
      effectiveDate: string | null
      expiryDate: string | null
      internalReviewNote: string
      serviceLines: AgreementServiceLineInput[]
    },
  ) {
    try {
      const response = await http.put<AgreementDetail>(
        `/agreements/admin/${agreementId}/versions/${versionId}/terms`,
        values,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to save agreement terms.'))
    }
  },

  async reviewAdminAgreement(
    agreementId: number,
    versionId: number,
    values: {
      decision: 'APPROVE_FOR_SIGNATURE' | 'REQUEST_CHANGES'
      customerComment?: string
      internalComment?: string
    },
  ) {
    try {
      const response = await http.post<AgreementDetail>(
        `/agreements/admin/${agreementId}/versions/${versionId}/review`,
        values,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to update agreement review.'))
    }
  },

  async downloadAdminAgreementSample() {
    try {
      const response = await http.get('/agreements/admin/sample.pdf', { responseType: 'blob' })
      return response.data as Blob
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load the sample agreement.'))
    }
  },

  async activateAdminAgreement(
    agreementId: number,
    versionId: number,
    values: { effectiveDate: string | null; expiryDate: string | null },
  ) {
    try {
      const response = await http.post<AgreementDetail>(
        `/agreements/admin/${agreementId}/versions/${versionId}/activate`,
        values,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to activate the signed agreement.'))
    }
  },

  async provisionAgreementOrders(agreementId: number) {
    try {
      const response = await http.post<{
        serviceTypeCount: number
        changedCount: number
        message: string
      }>(`/agreements/admin/${agreementId}/provision-orders`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to provision service orders for this agreement.'))
    }
  },

  async uploadSignedAgreement(agreementId: number, versionId: number, file: File) {
    try {
      const body = new FormData()
      body.append('signedPdf', file)
      const response = await http.post<AgreementDetail>(
        `/agreements/customer/${agreementId}/versions/${versionId}/signed-copy`,
        body,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to upload the signed agreement.'))
    }
  },

  async requestAgreementChanges(agreementId: number, versionId: number, comment: string) {
    try {
      const response = await http.post<AgreementDetail>(
        `/agreements/customer/${agreementId}/versions/${versionId}/request-changes`,
        { comment },
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to request agreement changes.'))
    }
  },

  async downloadAgreementDocument(
    audience: 'customer' | 'admin',
    agreementId: number,
    versionId: number,
    kind: 'draft' | 'signed',
  ) {
    try {
      const routeAudience = audience === 'admin' ? 'admin' : 'customer'
      const document = kind === 'draft' ? 'draft.pdf' : 'signed.pdf'
      const response = await http.get(
        `/agreements/${routeAudience}/${agreementId}/versions/${versionId}/${document}`,
        { responseType: 'blob' },
      )
      return response.data as Blob
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to download the agreement document.'))
    }
  },

  async list(module: AdminModule, params: {
    limit: number
    offset: number
    search: string
    status?: string
    filterColumns?: Record<string, string | number | boolean | null>
  }) {
    try {
      const { filterColumns, ...listParams } = params
      const response = await http.get<WorkspacePage>(`/admin/${module}`, {
        params: {
          ...listParams,
          ...(filterColumns ? { filters: JSON.stringify(filterColumns) } : {}),
        },
      })
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, `Unable to load ${module.replace('-', ' ')}.`))
    }
  },

  async inviteUser(values: {
    fullName: string
    email: string
    mobile?: string
    role: InvitationRole
    customerId?: number
  }) {
    try {
      const response = await http.post<InvitationResult>('/admin/users/invitations', values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to create the account invitation.'))
    }
  },

  async createRecord(module: CreatableModule, values: Record<string, unknown>) {
    try {
      const response = await http.post<Record<string, number>>(`/admin/${module}`, values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, `Unable to create this ${module.replace('-', ' ')} record.`))
    }
  },

  async updateRecord(module: AdminModule, id: number, values: Record<string, unknown>) {
    try {
      const response = await http.put<{ message: string }>(`/admin/${module}/${id}`, values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, `Unable to update this ${module.replace('-', ' ')} record.`))
    }
  },

  async createRequirement(values: Record<string, unknown>) {
    try {
      const response = await http.post<{ requirementId: number }>('/admin/requirements', values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to create the requirement.'))
    }
  },

  async sendRequirementForm(customerId: number) {
    try {
      const response = await http.post<RequirementIntakeResult>(`/admin/customers/${customerId}/requirement-intakes`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to send the customer requirement form.'))
    }
  },

  async requirementIntakeOptions(intakeId: number) {
    try {
      const response = await http.get<RequirementIntakeOptions>(`/admin/requirement-intakes/${intakeId}/options`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load conversion options.'))
    }
  },

  async convertRequirementIntake(intakeId: number, values: {
    jobProfileId: number
    serviceOrderId: number
    jobTitle: string
    skills: string[]
  }) {
    try {
      const response = await http.post<{ requirementId: number; requirementNumber: string; message: string }>(
        `/admin/requirement-intakes/${intakeId}/convert`,
        values,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to convert this customer request.'))
    }
  },

  async requirementCreationOptions() {
    try {
      const response = await http.get<RequirementCreationOptions>('/admin/requirements/options')
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load requirement creation options.'))
    }
  },

  async requirementAssignmentOptions(requirementId: number) {
    try {
      const response = await http.get<{
        requirement: { requirement_id: number; job_title: string; status: string }
        recruiters: Array<{ user_id: number; full_name: string; email: string }>
        assignments: Array<{ recruiter_id: number; assignment_role: 'LEAD' | 'SUPPORT'; full_name: string; email: string }>
      }>(`/admin/requirements/${requirementId}/assignment-options`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load recruiter assignment options.'))
    }
  },

  async assignRequirementRecruiter(
    requirementId: number,
    values: { recruiterId: number; assignmentRole: 'LEAD' | 'SUPPORT' },
  ) {
    try {
      const response = await http.post<{ message: string }>(
        `/admin/requirements/${requirementId}/assign`,
        values,
      )
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to assign this recruiter.'))
    }
  },

  async approveServiceOrder(serviceOrderId: number) {
    try {
      const response = await http.post<{ message: string }>(`/admin/service-orders/${serviceOrderId}/approve`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to approve this service order.'))
    }
  },

  async getPublicRequirementIntake(token: string) {
    try {
      const response = await http.get<RequirementIntakeForm>(`/public/requirement-intakes/${token}`)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'This customer requirement link is invalid or expired.'))
    }
  },

  async submitPublicRequirementIntake(token: string, values: Record<string, unknown>) {
    try {
      const response = await http.post<{ message: string }>(`/public/requirement-intakes/${token}`, values)
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to submit the requirement form.'))
    }
  },
}
