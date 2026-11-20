
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ClipboardList,
  Users,
  CalendarDays,
  MoreHorizontal,
  Building2,
  UserCheck,
  FileText,
  Clock,
  Target,
  GraduationCap,
  CheckCircle,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../data/navigation'

type Metric = {
  label: string
  value: string
  change: string
  icon: LucideIcon
  tone: string
}

type Activity = {
  initial: string
  name: string
  action: string
  target: string
  time: string
  tone: string
}

type PipelineItem = {
  name: string
  count: number
  width: string
  color: string
}

type DashboardConfig = {
  title: string
  description: string
  buttonText: string
  metrics: Metric[]
  pipelineTitle: string
  pipelineDescription: string
  pipeline: PipelineItem[]
  activities: Activity[]
}

const dashboardByRole: Record<Role, DashboardConfig> = {
  ADMIN: {
    title: 'Admin Overview',
    description: 'Monitor customers, recruitment operations and platform activity.',
    buttonText: 'Add customer',

    metrics: [
      {
        label: 'Total customers',
        value: '24',
        change: '+12.5%',
        icon: Building2,
        tone: 'blue',
      },
      {
        label: 'Open requirements',
        value: '32',
        change: '+8.2%',
        icon: ClipboardList,
        tone: 'violet',
      },
      {
        label: 'Active candidates',
        value: '186',
        change: '+4.6%',
        icon: Users,
        tone: 'green',
      },
      {
        label: 'Pending interviews',
        value: '18',
        change: '+2.4%',
        icon: CalendarDays,
        tone: 'orange',
      },
    ],

    pipelineTitle: 'Recruitment overview',
    pipelineDescription: 'Candidate progression across all active requirements',

    pipeline: [
      { name: 'Applied', count: 86, width: '92%', color: 'bar-blue' },
      { name: 'Screening', count: 54, width: '70%', color: 'bar-violet' },
      { name: 'Shortlisted', count: 32, width: '48%', color: 'bar-cyan' },
      { name: 'Interview', count: 18, width: '31%', color: 'bar-orange' },
      { name: 'Selected', count: 9, width: '17%', color: 'bar-green' },
    ],

    activities: [
      {
        initial: 'AK',
        name: 'Aarav Kumar',
        action: 'was shortlisted for',
        target: 'Senior Java Developer',
        time: '12 min ago',
        tone: 'blue',
      },
      {
        initial: 'SP',
        name: 'Sneha Patel',
        action: 'interview scheduled for',
        target: 'Frontend Engineer',
        time: '1 hour ago',
        tone: 'purple',
      },
      {
        initial: 'RM',
        name: 'Rohit Mehra',
        action: 'submitted a new requirement',
        target: 'Data Analyst',
        time: '3 hours ago',
        tone: 'green',
      },
    ],
  },

  CUSTOMER: {
    title: 'Customer Overview',
    description: 'Track your hiring requirements and shortlisted candidates.',
    buttonText: 'Create requirement',

    metrics: [
      {
        label: 'My requirements',
        value: '8',
        change: '+2 this month',
        icon: ClipboardList,
        tone: 'blue',
      },
      {
        label: 'Shortlisted candidates',
        value: '24',
        change: '+6 this week',
        icon: UserCheck,
        tone: 'violet',
      },
      {
        label: 'Upcoming interviews',
        value: '5',
        change: 'Next 7 days',
        icon: CalendarDays,
        tone: 'orange',
      },
      {
        label: 'Successful placements',
        value: '12',
        change: '+3 this month',
        icon: CheckCircle,
        tone: 'green',
      },
    ],

    pipelineTitle: 'My hiring progress',
    pipelineDescription: 'Progress of candidates against your requirements',

    pipeline: [
      { name: 'Requirements raised', count: 8, width: '100%', color: 'bar-blue' },
      { name: 'Candidates shared', count: 24, width: '80%', color: 'bar-violet' },
      { name: 'Shortlisted', count: 14, width: '60%', color: 'bar-cyan' },
      { name: 'Interviewed', count: 9, width: '40%', color: 'bar-orange' },
      { name: 'Selected', count: 4, width: '25%', color: 'bar-green' },
    ],

    activities: [
      {
        initial: 'DT',
        name: 'DTS Recruitment',
        action: 'shared candidates for',
        target: 'Java Developer',
        time: '20 min ago',
        tone: 'blue',
      },
      {
        initial: 'HR',
        name: 'HR Team',
        action: 'scheduled an interview for',
        target: 'Business Analyst',
        time: '2 hours ago',
        tone: 'purple',
      },
      {
        initial: 'DT',
        name: 'DTS Recruitment',
        action: 'updated the status of',
        target: 'Frontend Developer',
        time: 'Yesterday',
        tone: 'green',
      },
    ],
  },

  RECRUITER: {
    title: 'Recruiter Overview',
    description: 'Manage assigned requirements and candidate recruitment progress.',
    buttonText: 'Add candidate',

    metrics: [
      {
        label: 'Assigned requirements',
        value: '12',
        change: '+2 this week',
        icon: ClipboardList,
        tone: 'blue',
      },
      {
        label: 'Candidates sourced',
        value: '48',
        change: '+10 this week',
        icon: Users,
        tone: 'violet',
      },
      {
        label: 'Interviews scheduled',
        value: '9',
        change: 'Next 7 days',
        icon: CalendarDays,
        tone: 'orange',
      },
      {
        label: 'Offers in progress',
        value: '4',
        change: '+1 this week',
        icon: FileText,
        tone: 'green',
      },
    ],

    pipelineTitle: 'My recruitment pipeline',
    pipelineDescription: 'Progress of candidates assigned to your requirements',

    pipeline: [
      { name: 'Sourced', count: 48, width: '100%', color: 'bar-blue' },
      { name: 'Screened', count: 32, width: '75%', color: 'bar-violet' },
      { name: 'Shortlisted', count: 20, width: '55%', color: 'bar-cyan' },
      { name: 'Interview', count: 9, width: '35%', color: 'bar-orange' },
      { name: 'Selected', count: 4, width: '20%', color: 'bar-green' },
    ],

    activities: [
      {
        initial: 'RK',
        name: 'Rahul Kumar',
        action: 'added a candidate for',
        target: 'Java Developer',
        time: '15 min ago',
        tone: 'blue',
      },
      {
        initial: 'AS',
        name: 'Ananya Singh',
        action: 'was shortlisted for',
        target: 'React Developer',
        time: '1 hour ago',
        tone: 'purple',
      },
      {
        initial: 'VM',
        name: 'Vikram Mehta',
        action: 'has an interview scheduled for',
        target: 'QA Engineer',
        time: '3 hours ago',
        tone: 'green',
      },
    ],
  },

  CANDIDATE: {
    title: 'Candidate Overview',
    description: 'Track your profile, job applications and upcoming interviews.',
    buttonText: 'Browse jobs',

    metrics: [
      {
        label: 'Profile completion',
        value: '75%',
        change: 'Complete your profile',
        icon: UserCheck,
        tone: 'blue',
      },
      {
        label: 'Matched jobs',
        value: '12',
        change: '+3 new matches',
        icon: BriefcaseBusiness,
        tone: 'violet',
      },
      {
        label: 'My applications',
        value: '6',
        change: '2 under review',
        icon: FileText,
        tone: 'green',
      },
      {
        label: 'Upcoming interviews',
        value: '2',
        change: 'Next 7 days',
        icon: CalendarDays,
        tone: 'orange',
      },
    ],

    pipelineTitle: 'My application progress',
    pipelineDescription: 'Current status of your job applications',

    pipeline: [
      { name: 'Applied', count: 6, width: '100%', color: 'bar-blue' },
      { name: 'Under review', count: 4, width: '75%', color: 'bar-violet' },
      { name: 'Shortlisted', count: 3, width: '55%', color: 'bar-cyan' },
      { name: 'Interview', count: 2, width: '35%', color: 'bar-orange' },
      { name: 'Selected', count: 1, width: '20%', color: 'bar-green' },
    ],

    activities: [
      {
        initial: 'DT',
        name: 'DTS Recruitment',
        action: 'received your application for',
        target: 'Java Developer',
        time: '30 min ago',
        tone: 'blue',
      },
      {
        initial: 'HR',
        name: 'Recruitment Team',
        action: 'scheduled an interview for',
        target: 'Frontend Developer',
        time: 'Yesterday',
        tone: 'purple',
      },
      {
        initial: 'DT',
        name: 'DTS Recruitment',
        action: 'updated your application for',
        target: 'Backend Developer',
        time: '2 days ago',
        tone: 'green',
      },
    ],
  },
}

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  const dashboard = dashboardByRole[user.role]
  const firstName = user.fullName.split(' ')[0]

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{dashboard.title.toUpperCase()}</div>

          <h1>
            Welcome, {firstName} <span>👋</span>
          </h1>

          <p>{dashboard.description}</p>
        </div>

        <button className="btn btn-primary">
          + {dashboard.buttonText}
        </button>
      </div>

      <div className="metric-grid">
        {dashboard.metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <div className="metric-top">
              <div className={`metric-icon ${metric.tone}`}>
                <metric.icon size={19} />
              </div>

              <button className="plain-icon">
                <MoreHorizontal size={18} />
              </button>
            </div>

            <div className="metric-value">{metric.value}</div>

            <div className="metric-bottom">
              <span>{metric.label}</span>

              <small>
                {metric.change}
                <ArrowUpRight size={13} />
              </small>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <section className="panel pipeline-panel">
          <div className="panel-heading">
            <div>
              <h3>{dashboard.pipelineTitle}</h3>
              <p>{dashboard.pipelineDescription}</p>
            </div>

            <button className="period-select">Last 30 days⌄</button>
          </div>

          <div className="pipeline-bars">
            {dashboard.pipeline.map((item) => (
              <div className="bar-row" key={item.name}>
                <div>
                  <span>{item.name}</span>
                  <strong>{item.count}</strong>
                </div>

                <div className="bar-track">
                  <i
                    className={item.color}
                    style={{ width: item.width }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading">
            <div>
              <h3>Recent activity</h3>
              <p>Latest updates in your workspace</p>
            </div>

            <button className="plain-link">View all</button>
          </div>

          {dashboard.activities.map((activity) => (
            <div className="activity-item" key={activity.name + activity.target}>
              <div className={`activity-avatar ${activity.tone}`}>
                {activity.initial}
              </div>

              <div>
                <p>
                  <strong>{activity.name}</strong> {activity.action}{' '}
                  <b>{activity.target}</b>
                </p>

                <small>{activity.time}</small>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="demo-warning">
        Demo data only: these dashboard figures and activities are illustrative.
        They will be replaced with role-specific data from the Node.js API
        when backend integration is implemented.
      </div>
    </div>
  )
}
