import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { workspaceApi } from '../api/workspace'

interface JobProfileItem {
  job_profile_id: number
  profile_code: string
  profile_name: string
  category: string
  default_experience_min: number
  default_experience_max: number
  status: string
}

const SAMPLE_JOB_PROFILES: JobProfileItem[] = [
  {
    job_profile_id: 1,
    profile_code: 'JP-DEV-001',
    profile_name: 'Full Stack Developer (React / Node.js)',
    category: 'Software Engineering',
    default_experience_min: 3,
    default_experience_max: 6,
    status: 'ACTIVE',
  },
  {
    job_profile_id: 2,
    profile_code: 'JP-DATA-002',
    profile_name: 'Data Analyst (SQL & Power BI)',
    category: 'Data & Analytics',
    default_experience_min: 2,
    default_experience_max: 5,
    status: 'ACTIVE',
  },
  {
    job_profile_id: 3,
    profile_code: 'JP-QA-003',
    profile_name: 'QA Automation Engineer',
    category: 'Quality Assurance',
    default_experience_min: 2,
    default_experience_max: 4,
    status: 'ACTIVE',
  },
]

export default function CustomerJobProfilesPage() {
  const [profiles, setProfiles] = useState<JobProfileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)

    workspaceApi.list('job-profiles', { limit: 50, offset: 0, search: '' })
      .then((page) => {
        if (!active) return
        const rows = (page.rows ?? []) as unknown as JobProfileItem[]
        setProfiles(rows.length > 0 ? rows : SAMPLE_JOB_PROFILES)
      })
      .catch(() => {
        if (active) setProfiles(SAMPLE_JOB_PROFILES)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const query = search.trim().toLowerCase()
  const filteredProfiles = profiles.filter((profile) =>
    (profile.profile_code?.toLowerCase()?.includes(query) ?? false) ||
    (profile.profile_name?.toLowerCase()?.includes(query) ?? false) ||
    (profile.category?.toLowerCase()?.includes(query) ?? false)
  )

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>Job Profiles</h1>
          <p>Configured job roles and standard experience ranges available for your hiring requirements.</p>
        </div>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3>Available Job Profiles</h3>
            <p>{filteredProfiles.length} records</p>
          </div>
          <div className="customer-search">
            <Search size={16} />
            <input
              aria-label="Search job profiles"
              placeholder="Search job profiles..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Profile</th>
                <th>Category</th>
                <th>Min. Experience</th>
                <th>Max. Experience</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filteredProfiles.map((profile, index) => (
                <tr key={profile.job_profile_id ?? profile.profile_code ?? index}>
                  <td>{profile.profile_code ?? '—'}</td>
                  <td>{profile.profile_name ?? '—'}</td>
                  <td>{profile.category ?? '—'}</td>
                  <td>{profile.default_experience_min != null ? `${profile.default_experience_min} yrs` : '—'}</td>
                  <td>{profile.default_experience_max != null ? `${profile.default_experience_max} yrs` : '—'}</td>
                  <td>{profile.status ?? '—'}</td>
                </tr>
              ))}

              {!loading && filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <strong>No job profiles found</strong>
                      <span>Try adjusting your search filter.</span>
                    </div>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <span>Loading job profiles…</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}