
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Search, Pencil, Power, X, BriefcaseBusiness } from 'lucide-react'

type JobProfile = {
  id: number
  name: string
  department: string
  minExperience: number
  maxExperience: number
  skills: string[]
  status: 'ACTIVE' | 'INACTIVE'
}

const availableSkills = [
  'Java',
  'Spring Boot',
  'React',
  'MySQL',
  'Python',
  'Communication',
]

const initialProfiles: JobProfile[] = [
  {
    id: 1,
    name: 'Java Developer',
    department: 'Engineering',
    minExperience: 2,
    maxExperience: 5,
    skills: ['Java', 'Spring Boot', 'MySQL'],
    status: 'ACTIVE',
  },
  {
    id: 2,
    name: 'React Developer',
    department: 'Engineering',
    minExperience: 1,
    maxExperience: 4,
    skills: ['React', 'Communication'],
    status: 'ACTIVE',
  },
  {
    id: 3,
    name: 'Python Developer',
    department: 'Engineering',
    minExperience: 2,
    maxExperience: 6,
    skills: ['Python', 'MySQL'],
    status: 'ACTIVE',
  },
]

const emptyForm = {
  name: '',
  department: '',
  minExperience: '0',
  maxExperience: '2',
  skills: [] as string[],
}

export default function JobProfilesPage() {
  const [profiles, setProfiles] = useState<JobProfile[]>(initialProfiles)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<JobProfile | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  const filteredProfiles = profiles.filter((profile) =>
    `${profile.name} ${profile.department} ${profile.skills.join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (profile: JobProfile) => {
    setEditing(profile)
    setForm({
      name: profile.name,
      department: profile.department,
      minExperience: String(profile.minExperience),
      maxExperience: String(profile.maxExperience),
      skills: profile.skills,
    })
    setError('')
    setModalOpen(true)
  }

  const toggleSkill = (skill: string) => {
    setForm((old) => ({
      ...old,
      skills: old.skills.includes(skill)
        ? old.skills.filter((item) => item !== skill)
        : [...old.skills, skill],
    }))
  }

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const min = Number(form.minExperience)
    const max = Number(form.maxExperience)

    if (!form.name.trim() || !form.department.trim()) {
      setError('Job profile name and department are required.')
      return
    }

    if (min < 0 || max < min) {
      setError('Enter a valid experience range.')
      return
    }

    if (form.skills.length === 0) {
      setError('Select at least one required skill.')
      return
    }

    const duplicate = profiles.some(
      (profile) =>
        profile.name.toLowerCase() === form.name.trim().toLowerCase() &&
        profile.id !== editing?.id
    )

    if (duplicate) {
      setError('This job profile already exists.')
      return
    }

    const profileData = {
      name: form.name.trim(),
      department: form.department.trim(),
      minExperience: min,
      maxExperience: max,
      skills: form.skills,
    }

    if (editing) {
      setProfiles((old) =>
        old.map((profile) =>
          profile.id === editing.id ? { ...profile, ...profileData } : profile
        )
      )
    } else {
      setProfiles((old) => [
        {
          id: Math.max(0, ...old.map((profile) => profile.id)) + 1,
          ...profileData,
          status: 'ACTIVE',
        },
        ...old,
      ])
    }

    setModalOpen(false)
  }

  const toggleStatus = (id: number) => {
    setProfiles((old) =>
      old.map((profile) =>
        profile.id === id
          ? { ...profile, status: profile.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : profile
      )
    )
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Job Profiles</h1>
          <p>Configure job roles and the skills required for each profile.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Job Profile
        </button>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>Configured Job Profiles</h3>
            <p>{profiles.length} profiles configured</p>
          </div>

          <div className="customer-search">
            <Search size={16} />
            <input
              placeholder="Search job profiles or skills..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>JOB PROFILE</th>
                <th>DEPARTMENT</th>
                <th>EXPERIENCE</th>
                <th>REQUIRED SKILLS</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.map((profile) => (
                <tr key={profile.id}>
                  <td>
                    <div className="company-cell">
                      <div className="company-avatar"><BriefcaseBusiness size={16} /></div>
                      <strong>{profile.name}</strong>
                    </div>
                  </td>
                  <td>{profile.department}</td>
                  <td>{profile.minExperience}–{profile.maxExperience} years</td>
                  <td>{profile.skills.join(', ')}</td>
                  <td>
                    <span className={`customer-status ${profile.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                      {profile.status}
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button title="Edit profile" onClick={() => openEdit(profile)}>
                        <Pencil size={15} />
                      </button>
                      <button title="Change status" onClick={() => toggleStatus(profile.id)}>
                        <Power size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProfiles.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <BriefcaseBusiness size={28} />
                      <strong>No job profiles found</strong>
                      <span>Try a different search.</span>
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
          <div className="customer-modal" role="dialog" aria-modal="true">
            <div className="customer-modal-heading">
              <div>
                <h2>{editing ? 'Edit Job Profile' : 'Add Job Profile'}</h2>
                <p>Define the job profile and its required skills.</p>
              </div>
              <button className="customer-modal-close" onClick={() => setModalOpen(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveProfile}>
              <label>
                Job Profile Name *
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>

              <label>
                Department *
                <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />
              </label>

              <div className="customer-form-row">
                <label>
                  Minimum Experience (years)
                  <input type="number" min="0" value={form.minExperience} onChange={(e) => setForm({ ...form, minExperience: e.target.value })} />
                </label>

                <label>
                  Maximum Experience (years)
                  <input type="number" min="0" value={form.maxExperience} onChange={(e) => setForm({ ...form, maxExperience: e.target.value })} />
                </label>
              </div>

              <div className="skill-picker">
                <span>Required Skills *</span>
                <div>
                  {availableSkills.map((skill) => (
                    <label key={skill} className="skill-option">
                      <input
                        type="checkbox"
                        checked={form.skills.includes(skill)}
                        onChange={() => toggleSkill(skill)}
                      />
                      {skill}
                    </label>
                  ))}
                </div>
              </div>

              {error && <div className="customer-form-error">{error}</div>}

              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create Job Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}