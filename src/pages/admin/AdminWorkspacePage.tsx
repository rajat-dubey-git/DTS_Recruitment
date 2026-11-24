import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Mail, Plus, Search } from 'lucide-react'
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

const PAGE_SIZE = 50

const moduleConfig: Record<AdminModule, {
  title: string
  description: string
  inviteLabel: string | null
  columns: Array<{ key: string; label: string }>
}> = {
  customers: {
    title: 'Customers',
    description: 'Customer companies and their account status.',
    inviteLabel: null,
    columns: [
      { key: 'customer_code', label: 'Code' },
      { key: 'company_name', label: 'Company' },
      { key: 'industry', label: 'Industry' },
      { key: 'status', label: 'Status' },
      { key: 'payment_terms_days', label: 'Payment terms (days)' },
    ],
  },
  'customer-addresses': {
    title: 'Customer Addresses',
    description: 'Registered, billing and service addresses for customer companies.',
    inviteLabel: null,
    columns: [
      { key: 'company_name', label: 'Company' },
      { key: 'address_type', label: 'Type' },
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
      { key: 'contact_type', label: 'Contact type' },
      { key: 'is_primary', label: 'Primary' },
      { key: 'status', label: 'Status' },
    ],
  },
  recruiters: {
    title: 'Recruiters',
    description: 'Recruiter accounts and their access status.',
    inviteLabel: 'Invite recruiter',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'last_login_at', label: 'Last sign in' },
    ],
  },
  users: {
    title: 'Users',
    description: 'Portal accounts, roles, customer associations and access status.',
    inviteLabel: 'Invite recruiter',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'role', label: 'Role' },
      { key: 'customer_company', label: 'Customer' },
      { key: 'status', label: 'Status' },
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
      { key: 'employment_model', label: 'Employment model' },
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
      { key: 'status', label: 'Status' },
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
      { key: 'status', label: 'Status' },
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
      { key: 'fee_type', label: 'Fee type' },
      { key: 'fee_basis', label: 'Fee basis' },
      { key: 'fee_value', label: 'Fee value' },
      { key: 'billing_frequency', label: 'Billing frequency' },
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
      { key: 'status', label: 'Status' },
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
      { key: 'work_mode', label: 'Work mode' },
      { key: 'status', label: 'Status' },
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
      { key: 'work_mode', label: 'Work mode' },
      { key: 'employment_schedule', label: 'Schedule' },
      { key: 'status', label: 'Status' },
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
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [error, setError] = useState('')
  const [inviteRole, setInviteRole] = useState<InvitationRole | null>(null)
  const [inviteCustomer, setInviteCustomer] = useState<{ id: number; name: string } | null>(null)
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [invitation, setInvitation] = useState<InvitationResult | null>(null)
  const [creating, setCreating] = useState(false)
  const [requestCustomer, setRequestCustomer] = useState<{ id: number; name: string } | null>(null)
  const [requestBusy, setRequestBusy] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [requestResult, setRequestResult] = useState<RequirementIntakeResult | null>(null)
  const [conversionIntakeId, setConversionIntakeId] = useState<number | null>(null)

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
    workspaceApi.list(selectedModule, { limit: PAGE_SIZE, offset, search })
      .then((page) => {
        if (!active) return
        setRows(page.rows)
        setTotal(page.total)
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
  }, [selectedModule, offset, search, reloadKey])

  const sendInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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
          const page = await workspaceApi.list(selectedModule, { limit: PAGE_SIZE, offset: 0, search })
          setRows(page.rows)
          setTotal(page.total)
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
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        {config.inviteLabel && (selectedModule === 'recruiters' || selectedModule === 'users') && (
          <button type="button" className="btn btn-primary" onClick={() => {
            setInviteRole('RECRUITER')
            setInviteCustomer(null)
            setInviteError('')
            setInvitation(null)
          }}>
            <Plus size={16} /> {config.inviteLabel}
          </button>
        )}
        {selectedModule && (creatableModules.has(selectedModule) || selectedModule === 'requirements') && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> {createLabels[selectedModule]}
          </button>
        )}
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>{config.title}</h3>
            <p>{total.toLocaleString()} records</p>
          </div>
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

        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                {config.columns.map((column) => <th key={column.key}>{column.label}</th>)}
                {(selectedModule === 'customers' || selectedModule === 'requirement-intakes' || selectedModule === 'service-orders') && <th>Actions</th>}
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
                  {selectedModule === 'customers' && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline"
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
                        onClick={() => {
                          setRequestCustomer({
                            id: Number(row.customer_id),
                            name: String(row.company_name ?? 'customer'),
                          })
                          setRequestError('')
                          setRequestResult(null)
                        }}
                      >
                        <Mail size={14} /> Request requirement
                      </button>
                    </td>
                  )}
                  {selectedModule === 'requirement-intakes' && (
                    <td>
                      {row.status === 'SUBMITTED' ? (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => setConversionIntakeId(Number(row.intake_id))}
                        >
                          Review &amp; convert
                        </button>
                      ) : <span>{row.status === 'CONVERTED' ? 'Converted' : '—'}</span>}
                    </td>
                  )}
                  {selectedModule === 'service-orders' && (
                    <td>
                      {row.status === 'PENDING_APPROVAL' ? (
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            void workspaceApi.approveServiceOrder(Number(row.service_order_id))
                              .then(() => setReloadKey((value) => value + 1))
                              .catch((approveError: unknown) => setError(approveError instanceof Error ? approveError.message : 'Unable to approve the service order.'))
                          }}
                        >
                          Approve
                        </button>
                      ) : <span>{row.status === 'APPROVED' || row.status === 'IN_PROGRESS' ? 'Approved' : '—'}</span>}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={config.columns.length + (selectedModule === 'customers' || selectedModule === 'requirement-intakes' || selectedModule === 'service-orders' ? 1 : 0)}>
                  <div className="customer-empty"><strong>No records found</strong><span>Change your search or add records through the supported workflow.</span></div>
                </td></tr>
              )}
              {loading && (
                <tr><td colSpan={config.columns.length + (selectedModule === 'customers' || selectedModule === 'requirement-intakes' || selectedModule === 'service-orders' ? 1 : 0)}>
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

      {inviteRole && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="invite-title">{inviteRole === 'RECRUITER' ? 'Invite recruiter' : 'Invite customer contact'}</h2>
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
              <label>Mobile (optional)<input name="mobile" type="tel" autoComplete="tel" maxLength={16} /></label>
              {inviteError && <div className="customer-form-error" role="alert">{inviteError}</div>}
              {invitation?.invitationUrl && (
                <div className="database-read-only" role="status">
                  Invitation created. Share this one-time link with the user. They must set a password before signing in:
                  <a href={invitation.invitationUrl}>{invitation.invitationUrl}</a>
                </div>
              )}
              {invitation && !invitation.invitationUrl && (
                <div className="database-read-only" role="status">
                  Invitation created. A password setup link was emailed to {invitation.user.email}. They set their own password there, then sign in with this email address.
                </div>
              )}
              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setInviteRole(null)}>Close</button>
                {!invitation && <button type="submit" className="btn btn-primary" disabled={inviteBusy}>{inviteBusy ? 'Creating…' : 'Create invitation'}</button>}
              </div>
            </form>
          </div>
        </div>
      )}
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
    </div>
  )
}
