
import { useState } from 'react'
import { Plus, Search, Pencil, Power, X, Tags } from 'lucide-react'
import { useLocation } from 'react-router-dom'

type CatalogItem = {
  id: number
  name: string
  description: string
  status: 'ACTIVE' | 'INACTIVE'
}

const initialSkills: CatalogItem[] = [
  { id: 1, name: 'Java', description: 'Java programming language', status: 'ACTIVE' },
  { id: 2, name: 'Spring Boot', description: 'Java backend framework', status: 'ACTIVE' },
  { id: 3, name: 'React', description: 'Frontend JavaScript library', status: 'ACTIVE' },
  { id: 4, name: 'MySQL', description: 'Relational database', status: 'ACTIVE' },
  { id: 5, name: 'Python', description: 'Python programming language', status: 'ACTIVE' },
  { id: 6, name: 'Communication', description: 'Verbal and written communication', status: 'ACTIVE' },
]

const initialServices: CatalogItem[] = [
  { id: 1, name: 'Full-Time', description: 'Full-time employee placement', status: 'ACTIVE' },
  { id: 2, name: 'Part-Time', description: 'Part-time employee placement', status: 'ACTIVE' },
  { id: 3, name: 'DTS Payroll', description: 'Employee on DTS payroll', status: 'ACTIVE' },
  { id: 4, name: 'Customer Payroll', description: 'Employee on customer payroll', status: 'ACTIVE' },
]

export default function AdminCatalogPage() {
  const location = useLocation()
  const isSkills = location.pathname === '/app/skills'

  const title = isSkills ? 'Skills Management' : 'Service Types'
  const subtitle = isSkills
    ? 'Manage skills used in candidate profiles and job requirements.'
    : 'Manage the staffing and employment service types offered to customers.'

  const [items, setItems] = useState<CatalogItem[]>(
    isSkills ? initialSkills : initialServices
  )
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogItem | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const filteredItems = items.filter((item) =>
    `${item.name} ${item.description}`.toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setName('')
    setDescription('')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditing(item)
    setName(item.name)
    setDescription(item.description)
    setError('')
    setModalOpen(true)
  }

  const saveItem = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const cleanName = name.trim()
    const cleanDescription = description.trim()

    if (!cleanName) {
      setError('Name is required.')
      return
    }

    const duplicate = items.some(
      (item) =>
        item.name.toLowerCase() === cleanName.toLowerCase() &&
        item.id !== editing?.id
    )

    if (duplicate) {
      setError('This entry already exists.')
      return
    }

    if (editing) {
      setItems((old) =>
        old.map((item) =>
          item.id === editing.id
            ? { ...item, name: cleanName, description: cleanDescription }
            : item
        )
      )
    } else {
      setItems((old) => [
        {
          id: Math.max(0, ...old.map((item) => item.id)) + 1,
          name: cleanName,
          description: cleanDescription,
          status: 'ACTIVE',
        },
        ...old,
      ])
    }

    setModalOpen(false)
  }

  const toggleStatus = (id: number) => {
    setItems((old) =>
      old.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
            }
          : item
      )
    )
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        <button className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add {isSkills ? 'Skill' : 'Service Type'}
        </button>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>{isSkills ? 'Available Skills' : 'Configured Service Types'}</h3>
            <p>{items.length} total entries</p>
          </div>

          <div className="customer-search">
            <Search size={16} />
            <input
              placeholder={`Search ${isSkills ? 'skills' : 'service types'}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>DESCRIPTION</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="company-cell">
                      <div className="company-avatar"><Tags size={16} /></div>
                      <strong>{item.name}</strong>
                    </div>
                  </td>
                  <td>{item.description || '—'}</td>
                  <td>
                    <span className={`customer-status ${item.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button title="Edit" onClick={() => openEdit(item)}>
                        <Pencil size={15} />
                      </button>
                      <button
                        title={item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        onClick={() => toggleStatus(item.id)}
                      >
                        <Power size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="customer-empty">
                      <Tags size={28} />
                      <strong>No entries found</strong>
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
                <h2>{editing ? 'Edit' : 'Add'} {isSkills ? 'Skill' : 'Service Type'}</h2>
                <p>Enter the details below.</p>
              </div>
              <button className="customer-modal-close" onClick={() => setModalOpen(false)}>
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveItem}>
              <label>
                Name *
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>

              <label>
                Description
                <input value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>

              {error && <div className="customer-form-error">{error}</div>}

              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
