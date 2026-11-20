import { LayoutDashboard, Users, BriefcaseBusiness, ClipboardList, UserRound, FileText, Settings, CalendarDays, CreditCard, Building2, GraduationCap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
export type Role = 'ADMIN' | 'CUSTOMER' | 'RECRUITER' | 'CANDIDATE'
export type NavItem = { label: string; icon: LucideIcon }
export const navByRole: Record<Role, NavItem[]> = {
  ADMIN: [
    {label:'Overview',icon:LayoutDashboard},{label:'Customers',icon:Building2},{label:'Users',icon:Users},
    {label:'Job Profiles',icon:BriefcaseBusiness},{label:'Requirements',icon:ClipboardList},{label:'Candidates',icon:UserRound},
    {label:'Interviews',icon:CalendarDays},{label:'Invoices',icon:CreditCard},{label:'Reports',icon:FileText}
  ],
  CUSTOMER: [{label:'Overview',icon:LayoutDashboard},{label:'Job Profiles',icon:BriefcaseBusiness},{label:'My Requirements',icon:ClipboardList},{label:'Candidates',icon:Users},{label:'Interviews',icon:CalendarDays},{label:'Invoices',icon:CreditCard}],
  RECRUITER: [{label:'Overview',icon:LayoutDashboard},{label:'Assigned Requirements',icon:ClipboardList},{label:'Candidates',icon:Users},{label:'Applications',icon:BriefcaseBusiness},{label:'Interviews',icon:CalendarDays}],
  CANDIDATE: [{label:'Overview',icon:LayoutDashboard},{label:'My Profile',icon:UserRound},{label:'Browse Jobs',icon:BriefcaseBusiness},{label:'My Applications',icon:ClipboardList},{label:'Documents',icon:FileText},{label:'Learning',icon:GraduationCap}]
}