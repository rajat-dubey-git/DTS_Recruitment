import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Edit2, FileText, Filter, Mail, Plus, Search, Trash2, UserRoundPlus, X } from 'lucide-react'
import { workspaceApi } from '../../api/workspace'
import type {
  AdminModule,
  CreatableModule,
  InvitationResult,
  InvitationRole,
  RequirementIntakeResult,
  WorkspaceRecord,
} from '../../api/workspace'
import RequirementConversionDialog from './RequirementConversionDialog'
import AdminRequirementCreateDialog from './AdminRequirementCreateDialog'
import WorkspaceCreateDialog from './WorkspaceCreateDialog'
import WorkspaceEditDialog from './WorkspaceEditDialog'
import AgreementSampleTemplateModal from '../../components/AgreementSampleTemplateModal'
import PaginationControls from '../../components/PaginationControls'

const PAGE_SIZE = 10
const CUSTOMER_OPTION_PAGE_SIZE = 100

type CustomerOption = {
  id: number
  name: string
}

const moduleConfig: Record<AdminModule, {
  title: string
  description: string
  inviteLabel: string | null
  columns: Array<{ key: string; label: string; enumFilterKey?: string }>
}> = {
  customers: {
    title: 'Customers',
    description: 'Customer companies and their account status.',
    inviteLabel: null,
    columns: [
      { key: 'customer_code', label: 'Code' },
      { key: 'company_name', label: 'Company' },
      { key: 'industry', label: 'Industry' },
      { key: 'status', label: 'Status', enumFilterKey: 'status' },
      { key: 'payment_terms_days', label: 'Payment terms (days)' },
    ],
  },
  'customer-addresses': {
    title: 'Customer Addresses',
    description: 'Registered, billing and service addresses for customer companies.',
    inviteLabel: null,
    columns: [
      { key: 'company_name', label: 'Company' },
      { key: 'address_type', label: 'Type', enumFilterKey: 'ca.address_type' },
      { key: 'address_line', label: 'Address' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'postal_code', label: 'Postal code' },
      { key: 'is_primary', label: 'Primary' },
    ],
  },
  'customer-contacts': {
    title: 'Customer Contacts',
    description: 'Contacts associated with customer companies.',
    inviteLabel: null,
    columns: [
      { key: 'company_name', label: 'Company' },
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'designation', label: 'Designation' },
      { key: 'contact_type', label: 'Contact type', enumFilterKey: 'cc.contact_type' },
      { key: 'is_primary', label: 'Primary' },
      { key: 'status', label: 'Status', enumFilterKey: 'cc.status' },
    ],
  },
  recruiters: {
    title: 'Recruiters',
    description: 'Recruiter accounts and their access status.',
    inviteLabel: 'Invite user',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status', enumFilterKey: 'status' },
      { key: 'last_login_at', label: 'Last sign in' },
    ],
  },
  users: {
    title: 'Users',
    description: 'Portal accounts, roles, customer associations and access status.',
    inviteLabel: 'Invite user',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'role', label: 'Role', enumFilterKey: 'u.role' },
      { key: 'candidate_profile_status', label: 'Candidate profile' },
      { key: 'customer_company', label: 'Customer' },
      { key: 'status', label: 'Status', enumFilterKey: 'u.status' },
      { key: 'last_login_at', label: 'Last sign in' },
    ],
  },
  skills: {
    title: 'Skills',
    description: 'Skill catalog used by job profiles and requirements.',
    inviteLabel: null,
    columns: [
      { key: 'skill_name', label: 'Skill' },
      { key: 'skill_category', label: 'Category' },
    ],
  },
  'service-types': {
    title: 'Service Types',
    description: 'Staffing and employment models configured for customer engagements.',
    inviteLabel: null,
    columns: [
      { key: 'service_code', label: 'Code' },
      { key: 'service_name', label: 'Service' },
      { key: 'employment_model', label: 'Employment model', enumFilterKey: 'employment_model' },
    ],
  },
  'job-profiles': {
    title: 'Job Profiles',
    description: 'Configured job profiles and experience ranges.',
    inviteLabel: null,
    columns: [
      { key: 'profile_code', label: 'Code' },
      { key: 'profile_name', label: 'Profile' },
      { key: 'category', label: 'Category' },
      { key: 'default_experience_min', label: 'Min. experience' },
      { key: 'default_experience_max', label: 'Max. experience' },
      { key: 'status', label: 'Status', enumFilterKey: 'status' },
    ],
  },
  agreements: {
    title: 'Agreements',
    description: 'Customer agreements and their effective periods.',
    inviteLabel: null,
    columns: [
      { key: 'agreement_number', label: 'Agreement' },
      { key: 'company_name', label: 'Customer company' },
      { key: 'title', label: 'Title' },
      { key: 'status', label: 'Status', enumFilterKey: 'a.status' },
      { key: 'effective_date', label: 'Effective date' },
      { key: 'expiry_date', label: 'Expiry date' },
      { key: 'signed_date', label: 'Signed date' },
    ],
  },
  'rate-cards': {
    title: 'Rate Cards',
    description: 'Commercial rates configured by agreement, service and job profile.',
    inviteLabel: null,
    columns: [
      { key: 'agreement_number', label: 'Agreement' },
      { key: 'company_name', label: 'Customer company' },
      { key: 'service_name', label: 'Service' },
      { key: 'profile_name', label: 'Job profile' },
      { key: 'fee_type', label: 'Fee type', enumFilterKey: 'rc.fee_type' },
      { key: 'fee_basis', label: 'Fee basis', enumFilterKey: 'rc.fee_basis' },
      { key: 'fee_value', label: 'Fee value' },
      { key: 'billing_frequency', label: 'Billing frequency', enumFilterKey: 'rc.billing_frequency' },
      { key: 'effective_from', label: 'Effective from' },
      { key: 'effective_to', label: 'Effective to' },
    ],
  },
  'service-orders': {
    title: 'Service Orders',
    description: 'Customer service orders linked to agreements and service types.',
    inviteLabel: null,
    columns: [
      { key: 'order_number', label: 'Order' },
      { key: 'agreement_number', label: 'Agreement' },
      { key: 'company_name', label: 'Customer company' },
      { key: 'service_name', label: 'Service' },
      { key: 'title', label: 'Title' },
      { key: 'start_date', label: 'Start date' },
      { key: 'end_date', label: 'End date' },
      { key: 'status', label: 'Status', enumFilterKey: 'so.status' },
    ],
  },
  requirements: {
    title: 'Requirements',
    description: 'Customer-raised hiring requirements and their current status.',
    inviteLabel: null,
    columns: [
      { key: 'requirement_number', label: 'Requirement' },
      { key: 'company_name', label: 'Customer company' },
      { key: 'job_title', label: 'Job title' },
      { key: 'profile_name', label: 'Job profile' },
      { key: 'headcount', label: 'Headcount' },
      { key: 'work_mode', label: 'Work mode', enumFilterKey: 'r.work_mode' },
      { key: 'assigned_recruiters', label: 'Assigned recruiters' },
      { key: 'status', label: 'Status', enumFilterKey: 'r.status' },
    ],
  },
  'requirement-intakes': {
    title: 'Customer Requests',
    description: 'Customer-submitted hiring requests awaiting review and conversion.',
    inviteLabel: null,
    columns: [
      { key: 'company_name', label: 'Customer company' },
      { key: 'contact_name', label: 'Contact' },
      { key: 'email', label: 'Email' },
      { key: 'job_title', label: 'Requested job' },
      { key: 'headcount', label: 'Headcount' },
      { key: 'work_mode', label: 'Work mode', enumFilterKey: 'i.work_mode' },
      { key: 'employment_schedule', label: 'Schedule', enumFilterKey: 'i.employment_schedule' },
      { key: 'status', label: 'Status', enumFilterKey: 'i.status' },
      { key: 'submitted_at', label: 'Submitted' },
    ],
  },
}

const createLabels: Partial<Record<AdminModule, string>> = {
  customers: 'Create customer',
  skills: 'Create skill',
  'service-types': 'Create service type',
  'job-profiles': 'Create job profile',
  agreements: 'Create agreement',
  'rate-cards': 'Create rate card',
  'service-orders': 'Create service order',
  requirements: 'Add requirement',
}

const creatableModules = new Set<AdminModule>([
  'customers',
  'skills',
  'service-types',
  'job-profiles',
  'agreements',
  'rate-cards',
  'service-orders',
])

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'string' && value.includes('T')) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString()
  }
  return String(value)
}

export default function AdminWorkspacePage() {
  const { module } = useParams()
  const selectedModule = module && module in moduleConfig ? module as AdminModule : null
  const config = selectedModule ? moduleConfig[selectedModule] : null
  const [rows, setRows] = useState<WorkspaceRecord[]>([])
  const [total, setTotal] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({})
  const [filterOptions, setFilterOptions] = useState<Record<string, Array<string | number>>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [inviteRole, setInviteRole] = useState<InvitationRole | null>(null)
  const [inviteCustomer, setInviteCustomer] = useState<{ id: number; name: string } | null>(null)
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [loadingCustomerOptions, setLoadingCustomerOptions] = useState(false)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [invitation, setInvitation] = useState<InvitationResult | null>(null)
  const [creating, setCreating] = useState(false)
  const [editingRecord, setEditingRecord] = useState<WorkspaceRecord | null>(null)
  const [showSampleTemplate, setShowSampleTemplate] = useState(false)
  const [requestCustomer, setRequestCustomer] = useState<{ id: number; name: string } | null>(null)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestResult, setRequestResult] = useState<RequirementIntakeResult | null>(null)
  const [conversionIntakeId, setConversionIntakeId] = useState<number | null>(null)
  const [assignmentRequirement, setAssignmentRequirement] = useState<{ id: number; title: string } | null>(null)
  const [assignmentRecruiters, setAssignmentRecruiters] = useState<Array<{ user_id: number; full_name: string; email: string }>>([])
  const [assignmentCurrent, setAssignmentCurrent] = useState<Array<{ recruiter_id: number; assignment_role: 'LEAD' | 'SUPPORT'; full_name: string; email: string }>>([])
  const [assignmentRole, setAssignmentRole] = useState<'LEAD' | 'SUPPORT'>('LEAD')
  const [assignmentRecruiterId, setAssignmentRecruiterId] = useState('')
  const [assignmentBusy, setAssignmentBusy] = useState(false)
  const [assignmentError, setAssignmentError] = useState('')
  const [customerRequests, setCustomerRequests] = useState<WorkspaceRecord[]>([])
  const [customerRequestsTotal, setCustomerRequestsTotal] = useState(0)
  const [customerRequestsOffset, setCustomerRequestsOffset] = useState(0)
  const [customerRequestsLoading, setCustomerRequestsLoading] = useState(false)
  const [customerRequestsError, setCustomerRequestsError] = useState('')

  const deleteUser = async (row: WorkspaceRecord) => {
    const userId = Number(row.user_id)
    if (!Number.isSafeInteger(userId) || userId < 1) {
      setError('This user record has an invalid ID.')
      return
    }
    const name = String(row.full_name ?? row.email ?? 'this user')
    if (!window.confirm(
      `Permanently delete the account for ${name}? Related business history will be retained, but login access and account-only records will be removed.`,
    )) return

    setDeletingUserId(userId)
    setError('')
    setNotice('')
    try {
      const result = await workspaceApi.deleteUserAccount(userId)
      setNotice(result.message)
      setReloadKey((value) => value + 1)
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this user account.')
    } finally {
      setDeletingUserId(null)
    }
  }

  useEffect(() => {
    setColumnFilters({})
    setFilterOptions({})
    setOpenFilter(null)
    setOffset(0)
    setCustomerRequestsOffset(0)
    setSearchText('')
    setSearch('')
  }, [selectedModule])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchText.trim())
      setOffset(0)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [searchText])

  useEffect(() => {
    if (!selectedModule) return

    let active = true
    setLoading(true)
    setError('')
    workspaceApi.list(selectedModule, {
      limit: PAGE_SIZE,
      offset,
      search,
      filterColumns: columnFilters,
    })
      .then((page) => {
        if (!active) return
        setRows(page.rows)
        setTotal(page.total)
        setFilterOptions(page.filterOptions ?? {})
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load this module.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedModule, offset, search, columnFilters, reloadKey])

  useEffect(() => {
    if (inviteRole !== 'CUSTOMER') {
      setLoadingCustomerOptions(false)
      return
    }

    let active = true
    setLoadingCustomerOptions(true)
    setInviteError('')

    const loadCustomers = async () => {
      const options: CustomerOption[] = []
      const firstPage = await workspaceApi.list('customers', {
        limit: CUSTOMER_OPTION_PAGE_SIZE,
        offset: 0,
        search: '',
      })
      const mapRows = (rows: WorkspaceRecord[]) => rows.map((row) => ({
        id: Number(row.customer_id),
        name: `${String(row.customer_code ?? '')} — ${String(row.company_name ?? '')}`.trim(),
      }))
      options.push(...mapRows(firstPage.rows))

      for (let offset = firstPage.limit; offset < firstPage.total; offset += firstPage.limit) {
        const page = await workspaceApi.list('customers', {
          limit: CUSTOMER_OPTION_PAGE_SIZE,
          offset,
          search: '',
        })
        options.push(...mapRows(page.rows))
      }

      return options
    }

    void loadCustomers()
      .then((options) => {
        if (active) setCustomerOptions(options)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setInviteError(loadError instanceof Error ? loadError.message : 'Unable to load customers.')
        }
      })
      .finally(() => {
        if (active) setLoadingCustomerOptions(false)
      })

    return () => { active = false }
  }, [inviteRole])

  useEffect(() => {
    if (selectedModule !== 'requirements') {
      setCustomerRequests([])
      setCustomerRequestsTotal(0)
      setCustomerRequestsOffset(0)
      setCustomerRequestsError('')
      setCustomerRequestsLoading(false)
      return
    }

    let active = true
    setCustomerRequestsLoading(true)
    setCustomerRequestsError('')
    workspaceApi.list('requirement-intakes', {
      limit: PAGE_SIZE,
      offset: customerRequestsOffset,
      search: '',
      filterColumns: { 'i.status': 'SUBMITTED' },
    })
      .then((page) => {
        if (!active) return
        setCustomerRequests(page.rows)
        setCustomerRequestsTotal(page.total)
      })
      .catch((loadError: unknown) => {
        if (active) {
          setCustomerRequestsError(loadError instanceof Error ? loadError.message : 'Unable to load customer requests.')
        }
      })
      .finally(() => {
        if (active) setCustomerRequestsLoading(false)
      })

    return () => { active = false }
  }, [selectedModule, reloadKey, customerRequestsOffset])

  const sendInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (inviteRole === 'CUSTOMER' && !inviteCustomer) {
      setInviteError('Select the customer organisation for this contact.')
      return
    }
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    setInviteBusy(true)
    setInviteError('')
    setInvitation(null)

    try {
      const result = await workspaceApi.inviteUser({
        fullName: String(form.get('fullName') ?? ''),
        email: String(form.get('email') ?? ''),
        mobile: String(form.get('mobile') ?? ''),
        role: inviteRole ?? 'RECRUITER',
        ...(inviteRole === 'CUSTOMER' && inviteCustomer ? { customerId: inviteCustomer.id } : {}),
      })
      setInvitation(result)
      formElement.reset()
      if (selectedModule) {
        try {
          const page = await workspaceApi.list(selectedModule, {
            limit: PAGE_SIZE,
            offset: 0,
            search,
            filterColumns: columnFilters,
          })
          setRows(page.rows)
          setTotal(page.total)
          setFilterOptions(page.filterOptions ?? {})
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : 'Invitation created, but the list could not be refreshed.')
        }
      }
    } catch (inviteFailure) {
      setInviteError(inviteFailure instanceof Error ? inviteFailure.message : 'Unable to create the invitation.')
    } finally {
      setInviteBusy(false)
    }
  }

  const openRequirementAssignment = async (requirementId: number, title: string) => {
    setAssignmentRequirement({ id: requirementId, title })
    setAssignmentBusy(true)
    setAssignmentError('')
    setAssignmentRecruiters([])
    setAssignmentRecruiterId('')
    try {
      const options = await workspaceApi.requirementAssignmentOptions(requirementId)
      setAssignmentRecruiters(options.recruiters)
      const currentLead = options.assignments.find((assignment) => assignment.assignment_role === 'LEAD')
      setAssignmentRole(currentLead?.assignment_role ?? 'LEAD')
      setAssignmentRecruiterId(String(currentLead?.recruiter_id ?? options.recruiters[0]?.user_id ?? ''))
      setAssignmentCurrent(options.assignments)
    } catch (loadError) {
      setAssignmentError(loadError instanceof Error ? loadError.message : 'Unable to load recruiter assignment options.')
    } finally {
      setAssignmentBusy(false)
    }
  }

  const saveRequirementAssignment = async () => {
    if (!assignmentRequirement || !assignmentRecruiterId) return
    setAssignmentBusy(true)
    setAssignmentError('')
    try {
      await workspaceApi.assignRequirementRecruiter(assignmentRequirement.id, {
        recruiterId: Number(assignmentRecruiterId),
        assignmentRole,
      })
      setAssignmentRequirement(null)
      setReloadKey((value) => value + 1)
    } catch (saveError) {
      setAssignmentError(saveError instanceof Error ? saveError.message : 'Unable to assign this recruiter.')
    } finally {
      setAssignmentBusy(false)
    }
  }

  if (!config || !selectedModule) {
    return (
      <div className="panel database-message">
        <p>This business module is not available.</p>
        <Link className="btn btn-outline" to="/app/dashboard">Return to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION — FULL CONTROL</div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {selectedModule === 'agreements' && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowSampleTemplate(true)}
              title="View Standard Sample Agreement Draft"
            >
              <FileText size={16} /> Sample Agreement Template
            </button>
          )}
          {config.inviteLabel && (selectedModule === 'recruiters' || selectedModule === 'users') && (
            <button type="button" className="btn btn-primary" onClick={() => {
              setInviteRole('RECRUITER')
              setInviteCustomer(null)
              setInviteError('')
              setInvitation(null)
            }}>
              <Plus size={16} /> Invite user
            </button>
          )}
          {selectedModule && (creatableModules.has(selectedModule) || selectedModule === 'requirements') && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> {createLabels[selectedModule]}
            </button>
          )}
        </div>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3>{config.title}</h3>
            <p>{total.toLocaleString()} records</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="customer-search">
              <Search size={16} />
              <input
                aria-label={`Search ${config.title}`}
                placeholder={`Search ${config.title.toLowerCase()}...`}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        {notice && <div className="database-read-only" role="status">{notice}</div>}

        {selectedModule === 'requirements' && (
          <section className="panel customer-table-panel">
            <div className="customer-toolbar">
              <div>
                <h2>Customer requests awaiting review</h2>
                <p>Review submitted customer requests and map them to an approved service order to create a requirement.</p>
              </div>
              <span className="agreement-status">{customerRequestsTotal} submitted</span>
            </div>
            {customerRequestsError && <div className="form-error" role="alert">{customerRequestsError}</div>}
            {customerRequestsLoading ? (
              <div className="customer-empty">Loading customer requests…</div>
            ) : customerRequests.length === 0 ? (
              <div className="customer-empty">No submitted customer requests are awaiting review.</div>
            ) : (
              <div className="customer-table-wrapper">
                <table className="customer-table">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Contact</th>
                      <th>Email</th>
                      <th>Requested job</th>
                      <th>Headcount</th>
                      <th>Submitted</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerRequests.map((request) => (
                      <tr key={String(request.intake_id)}>
                        <td>{display(request.company_name)}</td>
                        <td>{display(request.contact_name)}</td>
                        <td>{display(request.email)}</td>
                        <td>{display(request.job_title)}</td>
                        <td>{display(request.headcount)}</td>
                        <td>{display(request.submitted_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => setConversionIntakeId(Number(request.intake_id))}
                          >
                            Review &amp; convert
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!customerRequestsLoading && (
              <PaginationControls
                page={Math.floor(customerRequestsOffset / PAGE_SIZE) + 1}
                pageCount={Math.max(1, Math.ceil(customerRequestsTotal / PAGE_SIZE))}
                total={customerRequestsTotal}
                onPageChange={(page) => setCustomerRequestsOffset((page - 1) * PAGE_SIZE)}
              />
            )}
          </section>
        )}

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column.key}>
                    {column.label}
                    {column.enumFilterKey && (
                      <span style={{ position: 'relative', display: 'inline-flex', marginLeft: '0.35rem' }}>
                        <button
                          type="button"
                          aria-label={`Filter ${column.label}`}
                          title={columnFilters[column.enumFilterKey] ? `Filtered by ${columnFilters[column.enumFilterKey]}` : `Filter ${column.label}`}
                          onClick={() => setOpenFilter((current) => current === column.enumFilterKey ? null : column.enumFilterKey!)}
                          style={{
                            border: 0,
                            background: 'transparent',
                            color: columnFilters[column.enumFilterKey] ? '#2563eb' : '#64748b',
                            padding: 0,
                            cursor: 'pointer',
                            verticalAlign: 'middle',
                          }}
                        >
                          <Filter size={13} />
                        </button>
                        {openFilter === column.enumFilterKey && (
                          <div
                            role="group"
                            aria-label={`${column.label} filter options`}
                            onClick={(event) => event.stopPropagation()}
                            style={{
                              position: 'absolute',
                              zIndex: 30,
                              top: '1.5rem',
                              left: 0,
                              minWidth: '180px',
                              padding: '0.65rem',
                              background: 'white',
                              border: '1px solid #dbe3ef',
                              borderRadius: '8px',
                              boxShadow: '0 8px 24px #0f172a20',
                            }}
                          >
                            <select
                              aria-label={`Select ${column.label}`}
                              value={columnFilters[column.enumFilterKey] ?? ''}
                              onChange={(event) => {
                                const value = event.target.value
                                setColumnFilters((current) => {
                                  const next = { ...current }
                                  if (value) next[column.enumFilterKey!] = value
                                  else delete next[column.enumFilterKey!]
                                  return next
                                })
                                setOffset(0)
                              }}
                              style={{ width: '100%', padding: '0.4rem', border: '1px solid #dbe3ef', borderRadius: '5px' }}
                            >
                              <option value="" disabled>Select a value</option>
                              {(filterOptions[column.enumFilterKey] ?? []).map((value) => (
                                <option key={String(value)} value={String(value)}>{display(value)}</option>
                              ))}
                            </select>
                            {columnFilters[column.enumFilterKey] && (
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ marginTop: '0.5rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                onClick={() => {
                                  setColumnFilters((current) => {
                                    const next = { ...current }
                                    delete next[column.enumFilterKey!]
                                    return next
                                  })
                                  setOffset(0)
                                  setOpenFilter(null)
                                }}
                              >
                                <X size={12} /> Clear filter
                              </button>
                            )}
                          </div>
                        )}
                      </span>
                    )}
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(
                  row.customer_id ?? row.address_id ?? row.contact_id ?? row.user_id ??
                  row.skill_id ?? row.service_type_id ?? row.job_profile_id ??
                  row.agreement_id ?? row.rate_card_id ?? row.service_order_id ?? row.intake_id ??
                  row.requirement_id ?? index
                )}>
                  {config.columns.map((column) => (
                    <td key={column.key}>{display(row[column.key])}</td>
                  ))}
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        onClick={() => setEditingRecord(row)}
                        title="Edit this record (Admin Full Control)"
                      >
                        <Edit2 size={13} /> Edit
                      </button>

                      {selectedModule === 'customers' && (
                        <>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setInviteRole('CUSTOMER')
                              setInviteCustomer({
                                id: Number(row.customer_id),
                                name: String(row.company_name ?? 'customer'),
                              })
                              setInviteError('')
                              setInvitation(null)
                            }}
                          >
                            Invite contact
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              setRequestCustomer({
                                id: Number(row.customer_id),
                                name: String(row.company_name ?? 'customer'),
                              })
                              setRequestError('')
                              setRequestResult(null)
                            }}
                          >
                            <Mail size={13} /> Request req
                          </button>
                        </>
                      )}

                      {selectedModule === 'requirement-intakes' && (
                        row.status === 'SUBMITTED' ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => setConversionIntakeId(Number(row.intake_id))}
                          >
                            Review &amp; convert
                          </button>
                        ) : null
                      )}

                      {selectedModule === 'requirements' && ['APPROVED', 'OPEN'].includes(String(row.status)) && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => void openRequirementAssignment(
                            Number(row.requirement_id),
                            String(row.job_title ?? row.requirement_number ?? 'Requirement'),
                          )}
                        >
                          <UserRoundPlus size={13} /> Assign recruiter
                        </button>
                      )}

                      {selectedModule === 'service-orders' && (
                        row.status === 'PENDING_APPROVAL' ? (
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              void workspaceApi.approveServiceOrder(Number(row.service_order_id))
                                .then(() => setReloadKey((value) => value + 1))
                                .catch((approveError: unknown) => setError(approveError instanceof Error ? approveError.message : 'Unable to approve the service order.'))
                            }}
                          >
                            Approve
                          </button>
                        ) : null
                      )}

                      {selectedModule === 'agreements' && (
                        <Link
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          to={`/app/admin/agreements/${row.agreement_id}/review`}
                        >
                          Review workflow
                        </Link>
                      )}

                      {selectedModule === 'users' && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          disabled={deletingUserId === Number(row.user_id)}
                          onClick={() => void deleteUser(row)}
                        >
                          <Trash2 size={13} /> {deletingUserId === Number(row.user_id) ? 'Deleting…' : 'Delete user'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={config.columns.length + 1}>
                  <div className="customer-empty"><strong>No records found</strong><span>Change your search or filter criteria.</span></div>
                </td></tr>
              )}
              {loading && (
                <tr><td colSpan={config.columns.length + 1}>
                  <div className="customer-empty"><span>Loading records…</span></div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="database-pagination">
          <span>{total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
          <div>
            <button type="button" className="btn btn-outline" disabled={offset === 0 || loading} onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}>Previous</button>
            <button type="button" className="btn btn-outline" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => setOffset((value) => value + PAGE_SIZE)}>Next</button>
          </div>
        </div>
      </section>

      {/* INVITE USER MODAL */}
      {inviteRole && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="invite-title">Invite User</h2>
                <p>
                  {inviteCustomer ? `Account for ${inviteCustomer.name}. ` : ''}
                  The invitee chooses their own password from a one-time invitation, then signs in with this email address.
                </p>
              </div>
              <button type="button" className="customer-modal-close" onClick={() => setInviteRole(null)} aria-label="Close">×</button>
            </div>
            <form onSubmit={(event) => void sendInvitation(event)}>
              <label>Full name *<input name="fullName" autoComplete="name" maxLength={100} required /></label>
              <label>Email address *<input name="email" type="email" autoComplete="email" maxLength={150} required /></label>
              <label>
                Mobile{inviteRole === 'CANDIDATE' ? ' *' : ' (optional)'}
                <input name="mobile" type="tel" autoComplete="tel" maxLength={15}
                  required={inviteRole === 'CANDIDATE'} pattern="[+]?[0-9]{7,15}"
                  title="Enter 7 to 15 digits, optionally starting with +." />
              </label>
              <label>
                Role *
                <select
                  value={inviteRole}
                  onChange={(event) => {
                    const role = event.target.value as InvitationRole
                    setInviteRole(role)
                    if (role !== 'CUSTOMER') setInviteCustomer(null)
                  }}
                  required
                >
                  <option value="RECRUITER">Recruiter</option>
                  <option value="CUSTOMER">Customer contact</option>
                  <option value="CANDIDATE">Candidate</option>
                </select>
              </label>
              {inviteRole === 'CUSTOMER' && (
                <>
                  <label>
                    Customer organisation *
                    <select
                      value={inviteCustomer ? String(inviteCustomer.id) : ''}
                      onChange={(event) => {
                        const customer = customerOptions.find((option) => String(option.id) === event.target.value)
                        setInviteCustomer(customer ?? null)
                      }}
                      required
                      disabled={loadingCustomerOptions}
                    >
                      <option value="">
                        {loadingCustomerOptions ? 'Loading customers…' : 'Select a customer'}
                      </option>
                      {customerOptions.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                  </label>
                  <p className="customer-contact-access-note">
                    Each contact has a separate login. Contacts linked to this organisation share its customer portal data.
                  </p>
                </>
              )}
              {inviteError && <div className="customer-form-error" role="alert">{inviteError}</div>}
              {invitation?.invitationUrl && (
                <div className="database-read-only" role="status">
                  {inviteRole === 'CANDIDATE' ? 'Candidate profile and account created. ' : 'Invitation created. '}
                  Share this one-time link with the user. They must set a password before signing in:
                  <a href={invitation.invitationUrl}>{invitation.invitationUrl}</a>
                </div>
              )}
              {invitation && !invitation.invitationUrl && (
                <div className="database-read-only" role="status">
                  {inviteRole === 'CANDIDATE' ? 'Candidate profile and account created. ' : 'Invitation created. '}
                  A password setup link was emailed to {invitation.user.email}. They set their own password there, then sign in with this email address.
                </div>
              )}
              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setInviteRole(null)}>Close</button>
                {!invitation && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={inviteBusy || (inviteRole === 'CUSTOMER' && (loadingCustomerOptions || !inviteCustomer))}
                  >
                    {inviteBusy ? 'Creating…' : 'Create invitation'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE RECORD DIALOGS */}
      {creating && selectedModule === 'requirements' && (
        <AdminRequirementCreateDialog
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setOffset(0)
            setReloadKey((value) => value + 1)
          }}
        />
      )}
      {creating && selectedModule && creatableModules.has(selectedModule) && (
        <WorkspaceCreateDialog
          module={selectedModule as CreatableModule}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            setOffset(0)
            setReloadKey((value) => value + 1)
          }}
        />
      )}

      {/* EDIT RECORD DIALOG */}
      {editingRecord && selectedModule && (
        <WorkspaceEditDialog
          module={selectedModule}
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={() => {
            setEditingRecord(null)
            setReloadKey((value) => value + 1)
          }}
        />
      )}

      {/* SAMPLE AGREEMENT TEMPLATE MODAL */}
      {showSampleTemplate && (
        <AgreementSampleTemplateModal onClose={() => setShowSampleTemplate(false)} />
      )}

      {/* REQUEST REQUIREMENT MODAL */}
      {requestCustomer && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="requirement-request-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="requirement-request-title">Request a hiring requirement</h2>
                <p>Send a secure 72-hour form link to an active contact at {requestCustomer.name}.</p>
              </div>
              <button type="button" className="customer-modal-close" onClick={() => setRequestCustomer(null)} aria-label="Close">×</button>
            </div>
            {requestResult ? (
              <div className="database-read-only" role="status">
                <p>The request is addressed to {requestResult.recipientEmail}.</p>
                {requestResult.intakeUrl ? (
                  <>
                    <p>Email delivery is not configured in development. Share this one-time link manually:</p>
                    <a href={requestResult.intakeUrl}>{requestResult.intakeUrl}</a>
                  </>
                ) : <p>The form link was sent by email and expires in 72 hours.</p>}
              </div>
            ) : (
              <>
                <p className="database-read-only">The primary active customer contact will receive the form. If there is no active contact, invite one from this customer record first.</p>
                {requestError && <div className="customer-form-error" role="alert">{requestError}</div>}
                <div className="customer-modal-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setRequestCustomer(null)}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={requestBusy}
                    onClick={() => {
                      setRequestBusy(true)
                      setRequestError('')
                      void workspaceApi.sendRequirementForm(requestCustomer.id)
                        .then(setRequestResult)
                        .catch((sendError: unknown) => setRequestError(sendError instanceof Error ? sendError.message : 'Unable to send the request.'))
                        .finally(() => setRequestBusy(false))
                    }}
                  >
                    {requestBusy ? 'Sending…' : 'Send form'}
                  </button>
                </div>
              </>
            )}
            {requestResult && (
              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setRequestCustomer(null)}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONVERT INTAKE DIALOG */}
      {conversionIntakeId !== null && (
        <RequirementConversionDialog
          intakeId={conversionIntakeId}
          onClose={() => setConversionIntakeId(null)}
          onConverted={() => {
            setConversionIntakeId(null)
            setReloadKey((value) => value + 1)
          }}
        />
      )}

      {assignmentRequirement && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="assignment-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="assignment-title">Assign recruiter</h2>
                <p>{assignmentRequirement.title}</p>
              </div>
              <button
                type="button"
                className="customer-modal-close"
                onClick={() => setAssignmentRequirement(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {assignmentCurrent.length > 0 && (
              <div className="database-read-only">
                <strong>Currently assigned</strong>
                <ul>
                  {assignmentCurrent.map((assignment) => (
                    <li key={`${assignment.recruiter_id}-${assignment.assignment_role}`}>
                      {assignment.full_name} ({assignment.assignment_role.toLowerCase()})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {assignmentError && <div className="customer-form-error" role="alert">{assignmentError}</div>}
            <label className="form-field">
              <span>Active recruiter</span>
              <select
                value={assignmentRecruiterId}
                onChange={(event) => setAssignmentRecruiterId(event.target.value)}
                disabled={assignmentBusy || assignmentRecruiters.length === 0}
              >
                <option value="">Select a recruiter</option>
                {assignmentRecruiters.map((recruiter) => (
                  <option key={recruiter.user_id} value={recruiter.user_id}>
                    {recruiter.full_name} — {recruiter.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>Assignment role</span>
              <select
                value={assignmentRole}
                onChange={(event) => setAssignmentRole(event.target.value as 'LEAD' | 'SUPPORT')}
                disabled={assignmentBusy}
              >
                <option value="LEAD">Lead recruiter</option>
                <option value="SUPPORT">Supporting recruiter</option>
              </select>
              <small>Assigning a new lead replaces the existing lead. Supporting recruiters can be added without replacing the lead.</small>
            </label>
            <div className="customer-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setAssignmentRequirement(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={assignmentBusy || !assignmentRecruiterId}
                onClick={() => void saveRequirementAssignment()}
              >
                {assignmentBusy ? 'Saving…' : 'Save assignment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}