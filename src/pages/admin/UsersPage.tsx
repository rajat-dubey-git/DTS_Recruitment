
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Search, Pencil, Power, X, Users } from 'lucide-react'

type UserRole = 'ADMIN' | 'RECRUITER' | 'CUSTOMER' | 'CANDIDATE'

type PortalUser = {
  id: number
  fullName: string
  email: string
  mobile: string
  role: UserRole
  customer: string
  status: 'ACTIVE' | 'INACTIVE'
}

type UserForm = {
  fullName: string
  email: string
  mobile: string
  role: UserRole
  customer: string
}

const initialUsers: PortalUser[] = [
  { id: 1, fullName: 'Amit Sharma', email: 'amit.admin@dts.com', mobile: '9000000001', role: 'ADMIN', customer: '', status: 'ACTIVE' },
  { id: 2, fullName: 'Rahul Verma', email: 'rahul.recruiter@dts.com', mobile: '9000000002', role: 'RECRUITER', customer: '', status: 'ACTIVE' },
  { id: 3, fullName: 'Priya Mehta', email: 'priya@techsolutions.com', mobile: '9000000003', role: 'CUSTOMER', customer: 'Tech Solutions Pvt. Ltd.', status: 'ACTIVE' },
  { id: 4, fullName: 'Neha Gupta', email: 'neha.candidate@example.com', mobile: '9000000004', role: 'CANDIDATE', customer: '', status: 'INACTIVE' },
]

const emptyForm: UserForm = {
  fullName: '',
  email: '',
  mobile: '',
  role: 'RECRUITER',
  customer: '',
}

export default function UsersPage() {
  const [users, setUsers] = useState<PortalUser[]>(initialUsers)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<PortalUser | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [error, setError] = useState('')

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const text = search.toLowerCase()

      const matchesSearch =
        user.fullName.toLowerCase().includes(text) ||
        user.email.toLowerCase().includes(text) ||
        user.mobile.includes(search) ||
        user.customer.toLowerCase().includes(text)

      const matchesRole = roleFilter === 'ALL' || user.role === roleFilter

      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (user: PortalUser) => {
    setEditing(user)
    setForm({
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      customer: user.customer,
    })
    setError('')
    setModalOpen(true)
  }

  const updateField = (field: keyof UserForm, value: string) => {
    setForm((old) => ({ ...old, [field]: value }))
  }

  const saveUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const email = form.email.trim().toLowerCase()
    const mobile = form.mobile.trim()

    if (!form.fullName.trim()) {
      setError('Full name is required.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    if (!/^\d{10}$/.test(mobile)) {
      setError('Enter a valid 10-digit mobile number.')
      return
    }

    if (form.role === 'CUSTOMER' && !form.customer.trim()) {
      setError('Enter the customer organisation for this user.')
      return
    }

    const duplicate = users.some(
      (user) => user.email.toLowerCase() === email && user.id !== editing?.id
    )

    if (duplicate) {
      setError('A user with this email already exists.')
      return
    }

    const userData = {
      fullName: form.fullName.trim(),
      email,
      mobile,
      role: form.role,
      customer: form.role === 'CUSTOMER' ? form.customer.trim() : '',
    }

    if (editing) {
      setUsers((old) =>
        old.map((user) =>
          user.id === editing.id ? { ...user, ...userData } : user
        )
      )
    } else {
      setUsers((old) => [
        {
          id: Math.max(0, ...old.map((user) => user.id)) + 1,
          ...userData,
          status: 'ACTIVE',
        },
        ...old,
      ])
    }

    setModalOpen(false)
  }

  const toggleStatus = (id: number) => {
    setUsers((old) =>
      old.map((user) =>
        user.id === id
          ? { ...user, status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
          : user
      )
    )
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>User Management</h1>
          <p>Create portal users and manage their roles and access status.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add User
        </button>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>Portal Users</h3>
            <p>{users.length} registered users</p>
          </div>

          <div className="customer-filters">
            <div className="customer-search">
              <Search size={16} />
              <input
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="RECRUITER">Recruiter</option>
              <option value="CUSTOMER">Customer</option>
              <option value="CANDIDATE">Candidate</option>
            </select>
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>USER</th>
                <th>EMAIL</th>
                <th>MOBILE</th>
                <th>ROLE</th>
                <th>CUSTOMER</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="company-cell">
                      <div className="company-avatar"><Users size={16} /></div>
                      <strong>{user.fullName}</strong>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{user.mobile}</td>
                  <td>{user.role}</td>
                  <td>{user.customer || '—'}</td>
                  <td>
                    <span className={`customer-status ${user.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button title="Edit user" onClick={() => openEdit(user)}>
                        <Pencil size={15} />
                      </button>
                      <button title="Change status" onClick={() => toggleStatus(user.id)}>
                        <Power size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="customer-empty">
                      <Users size={28} />
                      <strong>No users found</strong>
                      <span>Change your search or role filter.</span>
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
                <h2>{editing ? 'Edit User' : 'Add User'}</h2>
                <p>Enter the user's portal details and role.</p>
              </div>
              <button className="customer-modal-close" onClick={() => setModalOpen(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveUser}>
              <label>
                Full Name *
                <input value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} required />
              </label>

              <label>
                Email *
                <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} required />
              </label>

              <label>
                Mobile *
                <input value={form.mobile} maxLength={10} onChange={(e) => updateField('mobile', e.target.value)} required />
              </label>

              <label>
                Role *
                <select value={form.role} onChange={(e) => updateField('role', e.target.value as UserRole)}>
                  <option value="ADMIN">Admin</option>
                  <option value="RECRUITER">Recruiter</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="CANDIDATE">Candidate</option>
                </select>
              </label>

              {form.role === 'CUSTOMER' && (
                <label>
                  Customer Organisation *
                  <input
                    value={form.customer}
                    onChange={(e) => updateField('customer', e.target.value)}
                    placeholder="Enter customer organisation"
                  />
                </label>
              )}

              {error && <div className="customer-form-error">{error}</div>}

              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}