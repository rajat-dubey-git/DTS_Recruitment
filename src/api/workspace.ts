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

export type InvitationRole = 'RECRUITER' | 'CUSTOMER'

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

  async list(module: AdminModule, params: { limit: number; offset: number; search: string }) {
    try {
      const response = await http.get<WorkspacePage>(`/admin/${module}`, { params })
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

  async convertRequirementIntake(intakeId: number, values: { jobProfileId: number; serviceOrderId: number }) {
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
