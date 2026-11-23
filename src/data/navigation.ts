
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
    { label: 'Customers', icon: Building2, path: '/app/customers' },
    { label: 'Users', icon: Users, path: '/app/users' },
    { label: 'Job Profiles', icon: BriefcaseBusiness, path: '/app/job-profiles' },
    { label: 'Skills', icon: BriefcaseBusiness, path: '/app/skills' },
    { label: 'Service Types', icon: ClipboardList, path: '/app/service-types' },
    { label: 'Requirements', icon: ClipboardList, path: '/app/requirements' },
    { label: 'Candidates', icon: UserRound, path: '/app/candidates' },
    { label: 'Interviews', icon: CalendarDays, path: '/app/interviews' },
    { label: 'Invoices', icon: CreditCard, path: '/app/invoices' },
    { label: 'Reports', icon: FileText, path: '/app/reports' },
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
