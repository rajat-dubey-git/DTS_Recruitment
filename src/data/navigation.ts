
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  ClipboardList,
  CalendarDays,
  CreditCard,
  Building2,
  FileText,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

export type Role = 'ADMIN' | 'CUSTOMER' | 'RECRUITER' | 'CANDIDATE'

export type NavItem = {
  label: string
  icon: LucideIcon
  path: string
}

export const navByRole: Record<Role, NavItem[]> = {
  ADMIN: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Customers', icon: Building2, path: '/app/admin/customers' },
    { label: 'Customer Addresses', icon: Building2, path: '/app/admin/customer-addresses' },
    { label: 'Customer Contacts', icon: Users, path: '/app/admin/customer-contacts' },
    { label: 'Recruiters', icon: Users, path: '/app/admin/recruiters' },
    { label: 'Users', icon: Users, path: '/app/admin/users' },
    { label: 'Requirements', icon: ClipboardList, path: '/app/admin/requirements' },
    { label: 'Candidates', icon: Users, path: '/app/admin/candidates' },
    { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/admin/job-profiles' },
    { label: 'Skills', icon: BriefcaseBusiness, path: '/app/admin/skills' },
    { label: 'Service Types', icon: ClipboardList, path: '/app/admin/service-types' },
    { label: 'Agreements', icon: FileText, path: '/app/admin/agreements' },
    { label: 'Rate Cards', icon: CreditCard, path: '/app/admin/rate-cards' },
    { label: 'Service Orders', icon: ClipboardList, path: '/app/admin/service-orders' },
    { label: 'Customer Requests', icon: ClipboardList, path: '/app/admin/requirement-intakes' },
    { label: 'Recruiting Operations', icon: Users, path: '/app/assigned-requirements' },
  ],

  CUSTOMER: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Agreements', icon: FileText, path: '/app/agreements' },
    { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/job-profiles' },
    { label: 'My Requirements', icon: ClipboardList, path: '/app/my-requirements' },
    { label: 'Candidates', icon: Users, path: '/app/candidates' },
    { label: 'Interviews', icon: CalendarDays, path: '/app/interviews' },
    { label: 'Invoices', icon: CreditCard, path: '/app/invoices' },
  ],

  RECRUITER: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Assigned Requirements', icon: ClipboardList, path: '/app/assigned-requirements' },
    { label: 'Candidates', icon: Users, path: '/app/recruiter/candidates' },
    { label: 'Applications', icon: BriefcaseBusiness, path: '/app/recruiter/applications' },
    { label: 'Interviews', icon: CalendarDays, path: '/app/recruiter/interviews' },
  ],

  CANDIDATE: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Profile', icon: Users, path: '/app/candidate/profile' },
    { label: 'Resume', icon: FileText, path: '/app/candidate/resume' },
    { label: 'Open Requirements', icon: ClipboardList, path: '/app/candidate/requirements' },
    { label: 'Applications', icon: BriefcaseBusiness, path: '/app/candidate/applications' },
  ],
}
