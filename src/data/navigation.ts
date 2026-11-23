
import {
  LayoutDashboard,
  Users,
  BriefcaseBusiness,
  ClipboardList,
  UserRound,
  FileText,
  CalendarDays,
  CreditCard,
  Building2,
  GraduationCap,
  Database,
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
    // { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    // { label: 'Customers', icon: Building2, path: '/app/customers' },
    // { label: 'Users', icon: Users, path: '/app/users' },
    // { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/job-profiles' },
    // { label: 'Skills', icon: BriefcaseBusiness, path: '/app/skills' },
    // { label: 'Service Types', icon: ClipboardList, path: '/app/service-types' },
    // { label: 'Customer Contacts', icon: Users, path: '/app/customer-contacts' },
    // { label: 'Agreements', icon: FileText, path: '/app/commercial/agreements' },
    // { label: 'Rate Cards', icon: CreditCard, path: '/app/commercial/rate-cards' },
    // { label: 'Service Orders', icon: ClipboardList, path: '/app/commercial/service-orders' },
    // { label: 'Requirements', icon: ClipboardList, path: '/app/requirements' },
    // { label: 'Candidates', icon: UserRound, path: '/app/candidates' },
    // { label: 'Interviews', icon: CalendarDays, path: '/app/interviews' },
    // { label: 'Invoices', icon: CreditCard, path: '/app/invoices' },
    // { label: 'Reports', icon: FileText, path: '/app/reports' },
    { label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { label: 'Database Records', icon: Database, path: '/app/admin' },
    { label: 'Customers', icon: Building2, path: '/app/admin/customers' },
    { label: 'Customer Addresses', icon: Building2, path: '/app/admin/customer-addresses' },
    { label: 'Customer Contacts', icon: Users, path: '/app/admin/customer-contacts' },
    { label: 'Users', icon: Users, path: '/app/admin/users' },
    { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/admin/job-profiles' },
    { label: 'Skills', icon: BriefcaseBusiness, path: '/app/admin/skills' },
    { label: 'Service Types', icon: ClipboardList, path: '/app/admin/service-types' },
    { label: 'Agreements', icon: FileText, path: '/app/admin/agreements' },
    { label: 'Rate Cards', icon: CreditCard, path: '/app/admin/rate-cards' },
    { label: 'Service Orders', icon: ClipboardList, path: '/app/admin/service-orders' },
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
    { label: 'My Profile', icon: UserRound, path: '/app/my-profile' },
    { label: 'Browse Jobs', icon: BriefcaseBusiness, path: '/app/browse-jobs' },
    { label: 'My Applications', icon: ClipboardList, path: '/app/my-applications' },
    { label: 'Documents', icon: FileText, path: '/app/documents' },
    { label: 'Learning', icon: GraduationCap, path: '/app/learning' },
  ],
}
