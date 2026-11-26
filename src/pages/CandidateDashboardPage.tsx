import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, FileText, UserRound, Users } from 'lucide-react'
import { candidateApi } from '../api/candidate'
import type { CandidateDashboardApplication } from '../api/candidate'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

type Dashboard = Awaited<ReturnType<typeof candidateApi.dashboard>>

export default function CandidateDashboardPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const recentApplications = useListPagination(dashboard?.applications ?? [])

  useEffect(() => {
    let active = true
    candidateApi.dashboard()
      .then((result) => {
        if (active) setDashboard(result)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load candidate dashboard.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  if (loading) return <div className="panel database-message" role="status">Loading your candidate dashboard…</div>
  if (error) return <div className="form-error" role="alert">{error}</div>
  if (!dashboard) return <div className="panel database-message">No candidate profile is linked to this account.</div>

  const fullName = `${dashboard.profile.first_name} ${dashboard.profile.last_name || ''}`.trim()
  const metrics = [
    { label: 'Profile completion', value: `${dashboard.profileCompletion}%`, icon: UserRound },
    { label: 'Applications', value: dashboard.metrics.applications ?? 0, icon: BriefcaseBusiness },
    { label: 'Scheduled interviews', value: dashboard.metrics.interviews ?? 0, icon: Users },
    { label: 'Resume', value: dashboard.resume_status, icon: FileText },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Candidate overview</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-800">Welcome, {fullName}</h1>
          <p className="mt-1 text-sm text-slate-500">Track your profile, applications and interview progress.</p>
        </div>
        <Link className="btn btn-primary" to="/app/candidate/requirements">
          Browse open requirements <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase">{label}</span>
              <Icon size={18} />
            </div>
            <p className="mt-3 text-xl font-bold text-slate-800">{value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Recent applications</h2>
              <p className="mt-1 text-sm text-slate-500">View the latest status updates from your application timeline.</p>
            </div>
            <Link className="text-sm font-semibold text-blue-700 hover:underline" to="/app/candidate/applications">
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-100">
            {recentApplications.total ? recentApplications.items.map((application: CandidateDashboardApplication) => (
              <div key={application.application_id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Application #{application.application_id}</p>
                  <p className="text-xs text-slate-500">{new Date(application.applied_at).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {application.status}
                </span>
              </div>
            )) : (
              <p className="py-6 text-sm text-slate-500">You have not applied to any requirements yet.</p>
            )}
          </div>
          <PaginationControls
            page={recentApplications.page}
            pageCount={recentApplications.pageCount}
            total={recentApplications.total}
            onPageChange={recentApplications.setPage}
          />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-800">Complete your profile</h2>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${dashboard.profileCompletion}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">{dashboard.profileCompletion}% complete</p>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            A complete profile helps recruiters understand your experience and match you to relevant roles.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <Link className="btn btn-outline justify-center" to="/app/candidate/profile">Edit profile</Link>
            <Link className="btn btn-outline justify-center" to="/app/candidate/resume">Manage resume</Link>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800">Your skills</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {dashboard.skills.length ? dashboard.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{skill}</span>
          )) : <p className="text-sm text-slate-500">Add your skills in the profile section.</p>}
        </div>
      </section>
    </div>
  )
}
