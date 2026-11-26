import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { workspaceApi } from '../api/workspace'
import type { CustomerJobProfile } from '../api/workspace'
import PaginationControls, { useListPagination } from '../components/PaginationControls'

export default function CustomerJobProfilesPage() {
  const [profiles, setProfiles] = useState<CustomerJobProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)

    workspaceApi.listCustomerJobProfiles()
      .then((jobProfiles) => {
        if (!active) return
        setProfiles(jobProfiles)
      }).catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load job profiles.')
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
  const profilePage = useListPagination(filteredProfiles, search)

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CUSTOMER PORTAL</div>
          <h1>Job Profiles</h1>
          <p>Configured job roles and standard experience ranges available for your hiring requirements.</p>
        </div>
      </div>

      {error && <div className="form-error" role="alert">{error}</div>}
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
              {!loading && profilePage.items.map((profile, index) => (
                <tr key={profile.job_profile_id ?? profile.profile_code ?? index}>
                  <td>{profile.profile_code ?? '—'}</td>
                  <td>{profile.profile_name ?? '—'}</td>
                  <td>{profile.category ?? '—'}</td>
                  <td>{profile.default_experience_min != null ? `${profile.default_experience_min} yrs` : '—'}</td>
                  <td>{profile.default_experience_max != null ? `${profile.default_experience_max} yrs` : '—'}</td>
                  <td>{profile.status ?? '—'}</td>
                </tr>
              ))}

              {!loading && !error && filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <strong>No job profiles found</strong>
                      <span>{profiles.length === 0 ? 'No active profiles are currently available.' : 'Try adjusting your search filter.'}</span>
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
        {!loading && (
          <PaginationControls
            page={profilePage.page}
            pageCount={profilePage.pageCount}
            total={profilePage.total}
            onPageChange={profilePage.setPage}
          />
        )}
      </section>
    </div>
  )
}