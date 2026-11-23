import { createContext, useContext, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { Pencil, Plus, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

type ModuleKey =
  | 'customers'
  | 'customer-addresses'
  | 'customer-contacts'
  | 'users'
  | 'skills'
  | 'service-types'
  | 'job-profiles'
  | 'agreements'
  | 'rate-cards'
  | 'service-orders'

type SkillLink = {
  skill_id: number
  is_mandatory: boolean
  min_experience_years: number | null
}

type AdminValue = string | number | boolean | null | SkillLink[]

type AdminRecord = {
  id: number
  [key: string]: AdminValue
}

type AdminData = Record<ModuleKey, AdminRecord[]>

type Option = {
  value: string
  label: string
}

type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox'
  | 'skills'

type FieldSpec = {
  key: string
  label: string
  type: FieldType
  required?: boolean
  defaultValue?: AdminValue
  options?: Option[]
  source?: ModuleKey
  sourceLabel?: string
  filterRole?: string
  placeholder?: string
}

type ColumnSpec = {
  key: string
  label: string
  format?: (record: AdminRecord, data: AdminData) => string
}

type ModuleConfig = {
  title: string
  singular: string
  fields: FieldSpec[]
  columns: ColumnSpec[]
  uniqueBy?: string[]
}

type AdminDataContextValue = {
  data: AdminData
  setData: Dispatch<SetStateAction<AdminData>>
}

const initialData: AdminData = {
  users: [
    {
      id: 1,
      full_name: 'DTS Administrator',
      email: 'admin@dts.com',
      mobile: '9000000000',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
    {
      id: 2,
      full_name: 'Customer Demo User',
      email: 'customer@dts.com',
      mobile: '9000000002',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    },
    {
      id: 3,
      full_name: 'Recruiter Demo User',
      email: 'recruiter@dts.com',
      mobile: '9000000003',
      role: 'RECRUITER',
      status: 'ACTIVE',
    },
  ],
  customers: [
    {
      id: 1,
      customer_code: 'CUST-001',
      company_name: 'Tech Solutions Pvt. Ltd.',
      gstin: null,
      pan: null,
      industry: 'Technology',
      payment_terms_days: 30,
      status: 'ACTIVE',
      account_owner_id: 1,
    },
    {
      id: 2,
      customer_code: 'CUST-002',
      company_name: 'Global Systems India',
      gstin: null,
      pan: null,
      industry: 'Technology',
      payment_terms_days: 45,
      status: 'PROSPECT',
      account_owner_id: 1,
    },
  ],
  'customer-addresses': [
    {
      id: 1,
      customer_id: 1,
      address_type: 'BILLING',
      address_line: '100 Example Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      postal_code: '560001',
      is_primary: true,
    },
  ],
  'customer-contacts': [
    {
      id: 1,
      customer_id: 1,
      user_id: 2,
      designation: 'HR Manager',
      contact_type: 'HIRING',
      is_primary: true,
      status: 'ACTIVE',
    },
  ],
  skills: [
    { id: 1, skill_name: 'Java', skill_category: 'Programming' },
    { id: 2, skill_name: 'React', skill_category: 'Frontend' },
    { id: 3, skill_name: 'MySQL', skill_category: 'Database' },
  ],
  'service-types': [
    {
      id: 1,
      service_code: 'DTS-PAYROLL',
      service_name: 'DTS Payroll',
      employment_model: 'DTS_PAYROLL',
    },
    {
      id: 2,
      service_code: 'CUSTOMER-PAYROLL',
      service_name: 'Customer Payroll',
      employment_model: 'CUSTOMER_PAYROLL',
    },
  ],
  'job-profiles': [
    {
      id: 1,
      profile_code: 'JP-JAVA-001',
      profile_name: 'Java Developer',
      category: 'Engineering',
      purpose: 'Develop and maintain Java applications.',
      key_responsibilities: 'Build, test, and maintain backend services.',
      qualifications: 'Degree or equivalent software development experience.',
      reporting_to: 'Engineering Manager',
      default_experience_min: 2,
      default_experience_max: 5,
      status: 'ACTIVE',
      created_by: 1,
      skill_links: [{ skill_id: 1, is_mandatory: true, min_experience_years: 2 }],
    },
  ],
  agreements: [
    {
      id: 1,
      agreement_number: 'AGR-2026-001',
      customer_id: 1,
      title: 'Annual recruitment services agreement',
      status: 'ACTIVE',
      effective_date: '2026-01-01',
      expiry_date: '2026-12-31',
      signed_date: '2025-12-20',
      auto_renew: false,
      document_path: null,
      created_by: 1,
    },
  ],
  'rate-cards': [
    {
      id: 1,
      agreement_id: 1,
      service_type_id: 1,
      job_profile_id: 1,
      fee_type: 'FIXED_AMOUNT',
      fee_basis: 'PER_PLACEMENT',
      fee_value: 85000,
      billing_frequency: 'ONE_TIME',
      replacement_days: 90,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
    },
  ],
  'service-orders': [
    {
      id: 1,
      order_number: 'SO-2026-001',
      agreement_id: 1,
      service_type_id: 1,
      customer_reference: 'REQ-CLIENT-001',
      title: 'Technology recruitment services',
      scope_description: 'Recruitment services for approved technology roles.',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      status: 'DRAFT',
      approved_by: null,
      approved_at: null,
    },
  ],
}

const context = createContext<AdminDataContextValue | null>(null)

export function AdminSchemaProvider() {
  const [data, setData] = useState(initialData)

  return (
    <context.Provider value={{ data, setData }}>
      <Outlet />
    </context.Provider>
  )
}

function useAdminData() {
  const value = useContext(context)
  if (!value) {
    throw new Error('Admin pages must be rendered inside AdminSchemaProvider')
  }
  return value
}

const enumOptions = (values: string[]): Option[] =>
  values.map((value) => ({ value, label: value.split('_').join(' ') }))

const modules: Record<ModuleKey, ModuleConfig> = {
  customers: {
    title: 'Customers',
    singular: 'Customer',
    uniqueBy: ['customer_code'],
    fields: [
      { key: 'customer_code', label: 'Customer Code', type: 'text', required: true },
      { key: 'company_name', label: 'Company Name', type: 'text', required: true },
      { key: 'gstin', label: 'GSTIN', type: 'text' },
      { key: 'pan', label: 'PAN', type: 'text' },
      { key: 'industry', label: 'Industry', type: 'text' },
      { key: 'payment_terms_days', label: 'Payment Terms (days)', type: 'number', required: true, defaultValue: 30 },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'PROSPECT',
        options: enumOptions(['PROSPECT', 'ACTIVE', 'INACTIVE']),
      },
      {
        key: 'account_owner_id',
        label: 'Account Owner',
        type: 'select',
        source: 'users',
        sourceLabel: 'full_name',
      },
    ],
    columns: [
      { key: 'customer_code', label: 'CODE' },
      { key: 'company_name', label: 'COMPANY' },
      { key: 'industry', label: 'INDUSTRY' },
      { key: 'payment_terms_days', label: 'PAYMENT TERMS' },
      {
        key: 'account_owner_id',
        label: 'ACCOUNT OWNER',
        format: (row, data) => lookup(data.users, row.account_owner_id, 'full_name'),
      },
      { key: 'status', label: 'STATUS' },
    ],
  },

  'customer-addresses': {
    title: 'Customer Addresses',
    singular: 'Customer Address',
    fields: [
      {
        key: 'customer_id',
        label: 'Customer',
        type: 'select',
        required: true,
        source: 'customers',
        sourceLabel: 'company_name',
      },
      {
        key: 'address_type',
        label: 'Address Type',
        type: 'select',
        required: true,
        defaultValue: 'BILLING',
        options: enumOptions(['REGISTERED', 'BILLING', 'SITE', 'OTHER']),
      },
      { key: 'address_line', label: 'Address Line', type: 'text', required: true },
      { key: 'city', label: 'City', type: 'text', required: true },
      { key: 'state', label: 'State', type: 'text' },
      { key: 'postal_code', label: 'Postal Code', type: 'text' },
      { key: 'is_primary', label: 'Primary Address', type: 'checkbox', defaultValue: false },
    ],
    columns: [
      {
        key: 'customer_id',
        label: 'CUSTOMER',
        format: (row, data) => lookup(data.customers, row.customer_id, 'company_name'),
      },
      { key: 'address_type', label: 'TYPE' },
      { key: 'address_line', label: 'ADDRESS' },
      { key: 'city', label: 'CITY' },
      { key: 'state', label: 'STATE' },
      { key: 'postal_code', label: 'POSTAL CODE' },
      { key: 'is_primary', label: 'PRIMARY' },
    ],
  },

  'customer-contacts': {
    title: 'Customer Contacts',
    singular: 'Customer Contact',
    uniqueBy: ['user_id'],
    fields: [
      {
        key: 'customer_id',
        label: 'Customer',
        type: 'select',
        required: true,
        source: 'customers',
        sourceLabel: 'company_name',
      },
      {
        key: 'user_id',
        label: 'Customer Portal User',
        type: 'select',
        required: true,
        source: 'users',
        sourceLabel: 'full_name',
        filterRole: 'CUSTOMER',
      },
      { key: 'designation', label: 'Designation', type: 'text' },
      {
        key: 'contact_type',
        label: 'Contact Type',
        type: 'select',
        required: true,
        defaultValue: 'HIRING',
        options: enumOptions(['HIRING', 'BILLING', 'SIGNATORY', 'TECHNICAL', 'OTHER']),
      },
      { key: 'is_primary', label: 'Primary Contact', type: 'checkbox', defaultValue: false },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'ACTIVE',
        options: enumOptions(['ACTIVE', 'INACTIVE']),
      },
    ],
    columns: [
      {
        key: 'customer_id',
        label: 'CUSTOMER',
        format: (row, data) => lookup(data.customers, row.customer_id, 'company_name'),
      },
      {
        key: 'user_id',
        label: 'PORTAL USER',
        format: (row, data) => lookup(data.users, row.user_id, 'full_name'),
      },
      { key: 'designation', label: 'DESIGNATION' },
      { key: 'contact_type', label: 'CONTACT TYPE' },
      { key: 'is_primary', label: 'PRIMARY' },
      { key: 'status', label: 'STATUS' },
    ],
  },

  users: {
    title: 'Users',
    singular: 'User',
    uniqueBy: ['email'],
    fields: [
      { key: 'full_name', label: 'Full Name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'text', required: true },
      { key: 'mobile', label: 'Mobile', type: 'text' },
      {
        key: 'role',
        label: 'Role',
        type: 'select',
        required: true,
        defaultValue: 'RECRUITER',
        options: enumOptions(['ADMIN', 'RECRUITER', 'CANDIDATE', 'CUSTOMER']),
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'INVITED',
        options: enumOptions(['INVITED', 'ACTIVE', 'INACTIVE', 'LOCKED']),
      },
    ],
    columns: [
      { key: 'full_name', label: 'NAME' },
      { key: 'email', label: 'EMAIL' },
      { key: 'mobile', label: 'MOBILE' },
      { key: 'role', label: 'ROLE' },
      { key: 'status', label: 'STATUS' },
    ],
  },

  skills: {
    title: 'Skills',
    singular: 'Skill',
    uniqueBy: ['skill_name'],
    fields: [
      { key: 'skill_name', label: 'Skill Name', type: 'text', required: true },
      { key: 'skill_category', label: 'Skill Category', type: 'text' },
    ],
    columns: [
      { key: 'skill_name', label: 'SKILL' },
      { key: 'skill_category', label: 'CATEGORY' },
    ],
  },

  'service-types': {
    title: 'Service Types',
    singular: 'Service Type',
    uniqueBy: ['service_code'],
    fields: [
      { key: 'service_code', label: 'Service Code', type: 'text', required: true },
      { key: 'service_name', label: 'Service Name', type: 'text', required: true },
      {
        key: 'employment_model',
        label: 'Employment Model',
        type: 'select',
        required: true,
        options: enumOptions(['DTS_PAYROLL', 'CUSTOMER_PAYROLL']),
      },
    ],
    columns: [
      { key: 'service_code', label: 'CODE' },
      { key: 'service_name', label: 'SERVICE' },
      { key: 'employment_model', label: 'EMPLOYMENT MODEL' },
    ],
  },

  'job-profiles': {
    title: 'Job Profiles',
    singular: 'Job Profile',
    uniqueBy: ['profile_code'],
    fields: [
      { key: 'profile_code', label: 'Profile Code', type: 'text', required: true },
      { key: 'profile_name', label: 'Profile Name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'purpose', label: 'Purpose', type: 'textarea', required: true },
      { key: 'key_responsibilities', label: 'Key Responsibilities', type: 'textarea', required: true },
      { key: 'qualifications', label: 'Qualifications', type: 'textarea' },
      { key: 'reporting_to', label: 'Reporting To', type: 'text' },
      { key: 'default_experience_min', label: 'Minimum Experience (years)', type: 'number' },
      { key: 'default_experience_max', label: 'Maximum Experience (years)', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'DRAFT',
        options: enumOptions(['DRAFT', 'ACTIVE', 'ARCHIVED']),
      },
      { key: 'skill_links', label: 'Profile Skills', type: 'skills', defaultValue: [] },
    ],
    columns: [
      { key: 'profile_code', label: 'CODE' },
      { key: 'profile_name', label: 'PROFILE' },
      { key: 'category', label: 'CATEGORY' },
      {
        key: 'default_experience_min',
        label: 'EXPERIENCE',
        format: (row) => `${row.default_experience_min ?? '—'}–${row.default_experience_max ?? '—'} years`,
      },
      {
        key: 'skill_links',
        label: 'SKILLS',
        format: (row, data) => formatSkills(row.skill_links, data),
      },
      { key: 'status', label: 'STATUS' },
    ],
  },

  agreements: {
    title: 'Agreements',
    singular: 'Agreement',
    uniqueBy: ['agreement_number'],
    fields: [
      { key: 'agreement_number', label: 'Agreement Number', type: 'text', required: true },
      {
        key: 'customer_id',
        label: 'Customer',
        type: 'select',
        required: true,
        source: 'customers',
        sourceLabel: 'company_name',
      },
      { key: 'title', label: 'Title', type: 'text', required: true },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'DRAFT',
        options: enumOptions(['DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED']),
      },
      { key: 'effective_date', label: 'Effective Date', type: 'date' },
      { key: 'expiry_date', label: 'Expiry Date', type: 'date' },
      { key: 'signed_date', label: 'Signed Date', type: 'date' },
      { key: 'auto_renew', label: 'Auto Renew', type: 'checkbox', defaultValue: false },
      { key: 'document_path', label: 'Document Path', type: 'text' },
    ],
    columns: [
      { key: 'agreement_number', label: 'AGREEMENT' },
      {
        key: 'customer_id',
        label: 'CUSTOMER',
        format: (row, data) => lookup(data.customers, row.customer_id, 'company_name'),
      },
      { key: 'title', label: 'TITLE' },
      { key: 'effective_date', label: 'EFFECTIVE' },
      { key: 'expiry_date', label: 'EXPIRY' },
      { key: 'status', label: 'STATUS' },
    ],
  },

  'rate-cards': {
    title: 'Rate Cards',
    singular: 'Rate Card',
    uniqueBy: ['agreement_id', 'service_type_id', 'job_profile_id', 'effective_from'],
    fields: [
      {
        key: 'agreement_id',
        label: 'Agreement',
        type: 'select',
        required: true,
        source: 'agreements',
        sourceLabel: 'agreement_number',
      },
      {
        key: 'service_type_id',
        label: 'Service Type',
        type: 'select',
        required: true,
        source: 'service-types',
        sourceLabel: 'service_name',
      },
      {
        key: 'job_profile_id',
        label: 'Job Profile',
        type: 'select',
        required: true,
        source: 'job-profiles',
        sourceLabel: 'profile_name',
      },
      {
        key: 'fee_type',
        label: 'Fee Type',
        type: 'select',
        required: true,
        options: enumOptions(['PERCENTAGE', 'FIXED_AMOUNT', 'SALARY_MONTHS']),
      },
      {
        key: 'fee_basis',
        label: 'Fee Basis',
        type: 'select',
        required: true,
        options: enumOptions(['MONTHLY_SALARY', 'ANNUAL_CTC', 'HOURLY', 'PER_PLACEMENT']),
      },
      { key: 'fee_value', label: 'Fee Value', type: 'number', required: true },
      {
        key: 'billing_frequency',
        label: 'Billing Frequency',
        type: 'select',
        required: true,
        options: enumOptions(['ONE_TIME', 'MONTHLY', 'QUARTERLY']),
      },
      { key: 'replacement_days', label: 'Replacement Days', type: 'number' },
      { key: 'effective_from', label: 'Effective From', type: 'date', required: true },
      { key: 'effective_to', label: 'Effective To', type: 'date' },
    ],
    columns: [
      { key: 'agreement_id', label: 'AGREEMENT', format: (row, data) => lookup(data.agreements, row.agreement_id, 'agreement_number') },
      { key: 'service_type_id', label: 'SERVICE', format: (row, data) => lookup(data['service-types'], row.service_type_id, 'service_name') },
      { key: 'job_profile_id', label: 'JOB PROFILE', format: (row, data) => lookup(data['job-profiles'], row.job_profile_id, 'profile_name') },
      { key: 'fee_type', label: 'FEE TYPE' },
      { key: 'fee_basis', label: 'FEE BASIS' },
      { key: 'fee_value', label: 'FEE VALUE' },
      { key: 'billing_frequency', label: 'FREQUENCY' },
      { key: 'effective_from', label: 'FROM' },
      { key: 'effective_to', label: 'TO' },
    ],
  },

  'service-orders': {
    title: 'Service Orders',
    singular: 'Service Order',
    uniqueBy: ['order_number'],
    fields: [
      { key: 'order_number', label: 'Order Number', type: 'text', required: true },
      {
        key: 'agreement_id',
        label: 'Agreement',
        type: 'select',
        required: true,
        source: 'agreements',
        sourceLabel: 'agreement_number',
      },
      {
        key: 'service_type_id',
        label: 'Service Type',
        type: 'select',
        required: true,
        source: 'service-types',
        sourceLabel: 'service_name',
      },
      { key: 'customer_reference', label: 'Customer Reference', type: 'text' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'scope_description', label: 'Scope Description', type: 'textarea' },
      { key: 'start_date', label: 'Start Date', type: 'date' },
      { key: 'end_date', label: 'End Date', type: 'date' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'DRAFT',
        options: enumOptions(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
      },
    ],
    columns: [
      { key: 'order_number', label: 'ORDER' },
      { key: 'agreement_id', label: 'AGREEMENT', format: (row, data) => lookup(data.agreements, row.agreement_id, 'agreement_number') },
      { key: 'service_type_id', label: 'SERVICE', format: (row, data) => lookup(data['service-types'], row.service_type_id, 'service_name') },
      { key: 'title', label: 'TITLE' },
      { key: 'start_date', label: 'START' },
      { key: 'end_date', label: 'END' },
      { key: 'status', label: 'STATUS' },
    ],
  },
}

function lookup(records: AdminRecord[], id: AdminValue, labelKey: string) {
  const record = records.find((item) => item.id === Number(id))
  return record ? String(record[labelKey] ?? '') : '—'
}

function formatSkills(value: AdminValue, data: AdminData) {
  if (!Array.isArray(value)) return '—'
  return value
    .map((link) => {
      const skill = data.skills.find((item) => item.id === link.skill_id)
      return skill ? `${String(skill.skill_name)}${link.is_mandatory ? ' *' : ''}` : ''
    })
    .filter(Boolean)
    .join(', ') || '—'
}

function isModuleKey(value: string | undefined): value is ModuleKey {
  return Boolean(value && Object.prototype.hasOwnProperty.call(modules, value))
}

function initialForm(config: ModuleConfig, record?: AdminRecord): Record<string, AdminValue> {
  const values: Record<string, AdminValue> = {}
  for (const field of config.fields) {
    values[field.key] =
      record?.[field.key] ??
      field.defaultValue ??
      (field.type === 'checkbox' ? false : field.type === 'skills' ? [] : '')
  }
  return values
}

function normalizeForm(
  config: ModuleConfig,
  values: Record<string, AdminValue>,
): Record<string, AdminValue> {
  const result: Record<string, AdminValue> = {}

  for (const field of config.fields) {
    const value = values[field.key]

    if (field.type === 'skills') {
      result[field.key] = Array.isArray(value) ? value : []
    } else if (field.type === 'checkbox') {
      result[field.key] = value === true
    } else if (field.type === 'number') {
      result[field.key] = value === '' || value === null ? null : Number(value)
    } else if (field.source) {
      result[field.key] = value === '' || value === null ? null : Number(value)
    } else if (value === '' || value === null) {
      result[field.key] = field.required ? '' : null
    } else if (typeof value === 'string') {
      result[field.key] = value.trim()
    } else {
      result[field.key] = value
    }
  }

  return result
}

function validate(
  module: ModuleKey,
  form: Record<string, AdminValue>,
  rows: AdminRecord[],
  uniqueBy: string[],
  editingId: number | null,
) {
  const required = modules[module].fields.filter((field) => field.required)
  for (const field of required) {
    if (form[field.key] === '' || form[field.key] === null || form[field.key] === undefined) {
      return `${field.label} is required.`
    }
  }

  const duplicate = rows.some((row) =>
    row.id !== editingId &&
    uniqueBy.length > 0 &&
    uniqueBy.every((key) => String(row[key] ?? '').toLowerCase() === String(form[key] ?? '').toLowerCase())
  )
  if (duplicate) return `A ${modules[module].singular.toLowerCase()} with these unique values already exists.`

  if (module === 'customers') {
    const terms = Number(form.payment_terms_days)
    if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
      return 'Payment terms must be a whole number from 0 to 365.'
    }
    const gstin = String(form.gstin ?? '').trim().toUpperCase()
    const pan = String(form.pan ?? '').trim().toUpperCase()
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
      return 'Enter a valid GSTIN.'
    }
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      return 'Enter a valid PAN.'
    }
    if (gstin && pan && gstin.slice(2, 12) !== pan) {
      return 'The PAN must match the PAN embedded in the GSTIN.'
    }
  }

  if (module === 'users') {
    const email = String(form.email ?? '').trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Enter a valid email address.'
    const mobile = String(form.mobile ?? '').trim()
    if (mobile && !/^[+]?[0-9]{7,15}$/.test(mobile)) return 'Enter a valid mobile number.'
  }

  if (module === 'customer-contacts') {
    const user = rowsForValidation('users', form, rows)
    void user
  }

  if (module === 'customer-addresses' && form.is_primary === true) {
    const duplicatePrimary = rows.some((row) =>
      row.id !== editingId &&
      row.customer_id === form.customer_id &&
      row.address_type === form.address_type &&
      row.is_primary === true
    )
    if (duplicatePrimary) return 'This customer already has a primary address of this type.'
  }

  if (module === 'customer-contacts' && form.is_primary === true) {
    const duplicatePrimary = rows.some((row) =>
      row.id !== editingId &&
      row.customer_id === form.customer_id &&
      row.is_primary === true
    )
    if (duplicatePrimary) return 'This customer already has a primary contact.'
  }

  if (module === 'job-profiles') {
    const min = form.default_experience_min
    const max = form.default_experience_max
    if (min !== null && Number(min) < 0) return 'Minimum experience cannot be negative.'
    if (min !== null && max !== null && Number(max) < Number(min)) return 'Maximum experience must be at least the minimum.'
    const links = form.skill_links
    if (Array.isArray(links) && links.some((item) => item.min_experience_years !== null && item.min_experience_years < 0)) {
      return 'Skill experience cannot be negative.'
    }
  }

  if (module === 'agreements') {
    const effective = String(form.effective_date ?? '')
    const expiry = String(form.expiry_date ?? '')
    const signed = String(form.signed_date ?? '')
    if (effective && expiry && expiry < effective) return 'Expiry date must be on or after the effective date.'
    if (form.status === 'ACTIVE' && (!effective || !signed)) {
      return 'An ACTIVE agreement requires an effective date and signed date.'
    }
  }

  if (module === 'rate-cards') {
    const value = Number(form.fee_value)
    if (!Number.isFinite(value) || value < 0) return 'Fee value must be zero or greater.'
    if (form.fee_type === 'PERCENTAGE' && value > 100) return 'Percentage fees cannot exceed 100.'
    const from = String(form.effective_from ?? '')
    const to = String(form.effective_to ?? '')
    if (to && to < from) return 'Effective To must be on or after Effective From.'
    if (form.replacement_days !== null && Number(form.replacement_days) < 0) return 'Replacement days cannot be negative.'
  }

  if (module === 'service-orders') {
    const start = String(form.start_date ?? '')
    const end = String(form.end_date ?? '')
    if (start && end && end < start) return 'End date must be on or after start date.'
  }

  return ''
}

function rowsForValidation(
  _module: ModuleKey,
  _form: Record<string, AdminValue>,
  _rows: AdminRecord[],
) {
  return null
}

export default function SchemaAlignedAdminPage() {
  const { module: moduleParam } = useParams()
  const { data, setData } = useAdminData()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, AdminValue>>({})
  const [error, setError] = useState('')

  if (!isModuleKey(moduleParam)) {
    return <Navigate to="/app/admin/customers" replace />
  }

  const module = moduleParam
  const config = modules[module]
  const rows = data[module]
  const statusField = config.fields.find((field) => field.key === 'status')
  const query = search.trim().toLowerCase()

  const visibleRows = rows.filter((row) => {
    const text = config.columns
      .map((column) => column.format?.(row, data) ?? String(row[column.key] ?? ''))
      .join(' ')
      .toLowerCase()
    const matchesSearch = text.includes(query)
    const matchesStatus = statusFilter === 'ALL' || row.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const openAdd = () => {
    setEditingId(null)
    setForm(initialForm(config))
    setError('')
    setModalOpen(true)
  }

  const openEdit = (record: AdminRecord) => {
    setEditingId(record.id)
    setForm(initialForm(config, record))
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setError('')
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const normalized = normalizeForm(config, form)
    const validationError = validate(module, normalized, rows, config.uniqueBy ?? [], editingId)
    if (validationError) {
      setError(validationError)
      return
    }

    const existing = rows.find((row) => row.id === editingId)
    const id = editingId ?? Math.max(0, ...rows.map((row) => row.id)) + 1
    const record: AdminRecord = { ...(existing ?? {}), ...normalized, id }

    if (editingId === null && (module === 'job-profiles' || module === 'agreements')) {
      record.created_by = user?.userId ?? null
    }

    if (module === 'service-orders') {
      if (record.status === 'APPROVED') {
        record.approved_by = user?.userId ?? null
        record.approved_at = existing?.approved_at ?? new Date().toISOString()
      } else {
        record.approved_by = null
        record.approved_at = null
      }
      if (editingId === null) record.created_at = new Date().toISOString()
    }

    setData((current) => ({
      ...current,
      [module]: editingId === null
        ? [record, ...current[module]]
        : current[module].map((item) => item.id === editingId ? record : item),
    }))
    closeModal()
  }

  const title = config.title

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION · MASTER DATA</div>
          <h1>{title}</h1>
          <p>Manage {title.toLowerCase()} using the DTS database fields.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openAdd}>
          <Plus size={16} /> Add {config.singular}
        </button>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>{title} Directory</h3>
            <p>{rows.length} records</p>
          </div>
          <div className="customer-filters">
            <div className="customer-search">
              <Search size={16} />
              <input
                aria-label={`Search ${title}`}
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {statusField?.options && (
              <select
                aria-label={`Filter ${title} by status`}
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="ALL">All Statuses</option>
                {statusField.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                {config.columns.map((column) => <th key={column.key}>{column.label}</th>)}
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  {config.columns.map((column) => {
                    const value = column.format?.(row, data) ?? displayValue(row[column.key], data)
                    return (
                      <td key={column.key}>
                        {column.key === 'status'
                          ? <span className={`customer-status ${row.status === 'ACTIVE' ? 'active' : 'inactive'}`}>{value}</span>
                          : value}
                      </td>
                    )
                  })}
                  <td>
                    <div className="customer-actions">
                      <button
                        type="button"
                        title={`Edit ${config.singular.toLowerCase()}`}
                        aria-label={`Edit ${config.singular.toLowerCase()}`}
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={config.columns.length + 1}>
                    <div className="customer-empty">
                      <strong>No {title.toLowerCase()} found</strong>
                      <span>Try a different search or add a new record.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="admin-form-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="admin-form-title">{editingId === null ? 'Add' : 'Edit'} {config.singular}</h2>
                <p>Fields correspond to the DTS schema.</p>
              </div>
              <button type="button" className="customer-modal-close" aria-label="Close dialog" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={save}>
              {config.fields.map((field) => (
                <FieldControl
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  data={data}
                  onChange={(value) => setForm((current) => ({ ...current, [field.key]: value }))}
                />
              ))}
              {error && <div className="customer-form-error" role="alert">{error}</div>}
              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingId === null ? `Create ${config.singular}` : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function FieldControl({
  field,
  value,
  data,
  onChange,
}: {
  field: FieldSpec
  value: AdminValue | undefined
  data: AdminData
  onChange: (value: AdminValue) => void
}) {
  if (field.type === 'skills') {
    const selected = Array.isArray(value) ? value : []
    return (
      <fieldset className="schema-skill-field">
        <legend>{field.label}</legend>
        {data.skills.map((skill) => {
          const link = selected.find((item) => item.skill_id === skill.id)
          return (
            <div className="schema-skill-row" key={skill.id}>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(link)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...selected, { skill_id: skill.id, is_mandatory: true, min_experience_years: null }]
                      : selected.filter((item) => item.skill_id !== skill.id)
                    onChange(next)
                  }}
                />
                {String(skill.skill_name)}
              </label>
              {link && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={link.is_mandatory}
                      onChange={(event) => onChange(selected.map((item) =>
                        item.skill_id === skill.id ? { ...item, is_mandatory: event.target.checked } : item
                      ))}
                    />
                    Mandatory
                  </label>
                  <input
                    aria-label={`${String(skill.skill_name)} minimum experience`}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Min years"
                    value={link.min_experience_years ?? ''}
                    onChange={(event) => onChange(selected.map((item) =>
                      item.skill_id === skill.id
                        ? { ...item, min_experience_years: event.target.value === '' ? null : Number(event.target.value) }
                        : item
                    ))}
                  />
                </>
              )}
            </div>
          )
        })}
      </fieldset>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <label className="schema-checkbox">
        <input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    )
  }

  if (field.type === 'select') {
    const options = field.options ?? (
      field.source
        ? data[field.source]
            .filter((record) => !field.filterRole || record.role === field.filterRole)
            .map((record) => ({
              value: String(record.id),
              label: String(record[field.sourceLabel ?? 'id'] ?? record.id),
            }))
        : []
    )
    return (
      <label>
        {field.label}{field.required ? ' *' : ''}
        <select
          value={value === null || value === undefined ? '' : String(value)}
          required={field.required}
          onChange={(event) => onChange(event.target.value)}
        >
          {!field.required && <option value="">None</option>}
          {field.required && <option value="">Select {field.label.toLowerCase()}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    )
  }

  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : ''

  return (
    <label>
      {field.label}{field.required ? ' *' : ''}
      {field.type === 'textarea'
        ? <textarea rows={3} value={stringValue} required={field.required} onChange={(event) => onChange(event.target.value)} />
        : <input
            type={field.type}
            min={field.type === 'number' ? '0' : undefined}
            step={field.type === 'number' ? '0.1' : undefined}
            value={stringValue}
            required={field.required}
            placeholder={field.placeholder}
            onChange={(event) => onChange(event.target.value)}
          />}
    </label>
  )
}

function displayValue(value: AdminValue | undefined, data: AdminData) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return formatSkills(value, data)
  return String(value)
}