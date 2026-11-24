
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
    { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/admin/job-profiles' },
    { label: 'Skills', icon: BriefcaseBusiness, path: '/app/admin/skills' },
    { label: 'Service Types', icon: ClipboardList, path: '/app/admin/service-types' },
    { label: 'Agreements', icon: FileText, path: '/app/admin/agreements' },
    { label: 'Rate Cards', icon: CreditCard, path: '/app/admin/rate-cards' },
    { label: 'Service Orders', icon: ClipboardList, path: '/app/admin/service-orders' },
    { label: 'Requirements', icon: ClipboardList, path: '/app/admin/requirements' },
    { label: 'Customer Requests', icon: ClipboardList, path: '/app/admin/requirement-intakes' },
  ],

  CUSTOMER: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/job-profiles' },
    { label: 'My Requirements', icon: ClipboardList, path: '/app/my-requirements' },
    { label: 'Candidates', icon: Users, path: '/app/candidates' },
    { label: 'Interviews', icon: CalendarDays, path: '/app/interviews' },
    { label: 'Invoices', icon: CreditCard, path: '/app/invoices' },
  ],

  RECRUITER: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Assigned Requirements', icon: ClipboardList, path: '/app/assigned-requirements' },
    { label: 'Candidates', icon: Users, path: '/app/candidates' },
    { label: 'Applications', icon: BriefcaseBusiness, path: '/app/applications' },
    { label: 'Interviews', icon: CalendarDays, path: '/app/interviews' },
  ],

  CANDIDATE: [
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
  ],
}
