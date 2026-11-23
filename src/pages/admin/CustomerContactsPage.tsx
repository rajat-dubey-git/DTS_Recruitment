import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Search, Pencil, Power, X, Users } from 'lucide-react'

type Status = 'ACTIVE' | 'INACTIVE'

type CustomerOption = {
  id: number
  name: string
}

type CustomerContact = {
  id: number
  customerId: number
  fullName: string
  designation: string
  email: string
  phone: string
  isPrimary: boolean
  status: Status
}

type ContactForm = Omit<CustomerContact, 'id' | 'status'>

const customerOptions: CustomerOption[] = [
  { id: 1, name: 'Tech Solutions Pvt. Ltd.' },
  { id: 2, name: 'Global Systems India' },
  { id: 3, name: 'NextGen Technologies' },
  { id: 4, name: 'Digital Innovations Ltd.' },
  { id: 5, name: 'Bright Future Consulting' },
]

const initialContacts: CustomerContact[] = [
  {
    id: 1,
    customerId: 1,
    fullName: 'Amit Sharma',
    designation: 'HR Manager',
    email: 'amit@techsolutions.com',
    phone: '9876543210',
    isPrimary: true,
    status: 'ACTIVE',
  },
  {
    id: 2,
    customerId: 2,
    fullName: 'Priya Verma',
    designation: 'Talent Acquisition Lead',
    email: 'priya@globalsystems.com',
    phone: '9876543211',
    isPrimary: true,
    status: 'ACTIVE',
  },
]

const emptyForm: ContactForm = {
  customerId: 1,
  fullName: '',
  designation: '',
  email: '',
  phone: '',
  isPrimary: false,
}

export default function CustomerContactsPage() {
  const [contacts, setContacts] = useState(initialContacts)
  const [search, setSearch] = useState('')
  const [customerFilter, setCustomerFilter] = useState('ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerContact | null>(null)
  const [form, setForm] = useState<ContactForm>(emptyForm)
  const [error, setError] = useState('')

  const customerName = (customerId: number) =>
    customerOptions.find((customer) => customer.id === customerId)?.name ?? 'Unknown customer'

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase()

    return contacts.filter((contact) => {
      const matchesSearch = [
        contact.fullName,
        contact.designation,
        contact.email,
        contact.phone,
        customerName(contact.customerId),
      ].some((value) => value.toLowerCase().includes(query))

      const matchesCustomer =
        customerFilter === 'ALL' || contact.customerId === Number(customerFilter)

      return matchesSearch && matchesCustomer
    })
  }, [contacts, search, customerFilter])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setError('')
    setModalOpen(true)
  }

  const openEdit = (contact: CustomerContact) => {
    setEditing(contact)
    setForm({
      customerId: contact.customerId,
      fullName: contact.fullName,
      designation: contact.designation,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.isPrimary,
    })
    setError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setError('')
  }

  const saveContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const email = form.email.trim().toLowerCase()
    const fullName = form.fullName.trim()
    const phone = form.phone.trim()

    if (!fullName || !phone) {
      setError('Contact name and phone number are required.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }

    const duplicateEmail = contacts.some(
      (contact) =>
        contact.email.toLowerCase() === email && contact.id !== editing?.id
    )

    if (duplicateEmail) {
      setError('A contact with this email already exists.')
      return
    }

    setContacts((current) => {
      const updated = editing
        ? current.map((contact) =>
            contact.id === editing.id
              ? { ...contact, ...form, fullName, email, phone }
              : contact
          )
        : [
            {
              id: Math.max(0, ...current.map((contact) => contact.id)) + 1,
              ...form,
              fullName,
              email,
              phone,
              status: 'ACTIVE' as const,
            },
            ...current,
          ]

      if (!form.isPrimary) return updated

      return updated.map((contact) =>
        contact.customerId === form.customerId
          ? { ...contact, isPrimary: contact.id === (editing?.id ?? updated[0].id) }
          : contact
      )
    })

    closeModal()
  }

  const toggleStatus = (id: number) => {
    setContacts((current) =>
      current.map((contact) =>
        contact.id === id
          ? {
              ...contact,
              status: contact.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
            }
          : contact
      )
    )
  }

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Customer Contacts</h1>
          <p>Manage customer contacts and their primary contact status.</p>
        </div>

        <button className="btn btn-primary" type="button" onClick={openAdd}>
          <Plus size={16} /> Add Contact
        </button>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>Contact Directory</h3>
            <p>{contacts.length} contacts</p>
          </div>

          <div className="customer-filters">
            <div className="customer-search">
              <Search size={16} />
              <input
                aria-label="Search customer contacts"
                placeholder="Search contacts..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              aria-label="Filter by customer"
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
            >
              <option value="ALL">All Customers</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">
            <thead>
              <tr>
                <th>CONTACT</th>
                <th>CUSTOMER</th>
                <th>DESIGNATION</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredContacts.map((contact) => (
                <tr key={contact.id}>
                  <td>
                    <div className="company-cell">
                      <div className="company-avatar"><Users size={16} /></div>
                      <strong>
                        {contact.fullName}
                        {contact.isPrimary && <small> · Primary</small>}
                      </strong>
                    </div>
                  </td>
                  <td>{customerName(contact.customerId)}</td>
                  <td>{contact.designation || '—'}</td>
                  <td>{contact.email}</td>
                  <td>{contact.phone}</td>
                  <td>
                    <span className={`customer-status ${contact.status.toLowerCase()}`}>
                      {contact.status}
                    </span>
                  </td>
                  <td>
                    <div className="customer-actions">
                      <button
                        type="button"
                        title="Edit contact"
                        aria-label={`Edit ${contact.fullName}`}
                        onClick={() => openEdit(contact)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        title={contact.status === 'ACTIVE' ? 'Deactivate contact' : 'Activate contact'}
                        aria-label={`${contact.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} ${contact.fullName}`}
                        onClick={() => toggleStatus(contact.id)}
                      >
                        <Power size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="customer-empty">
                      <Users size={28} />
                      <strong>No contacts found</strong>
                      <span>Try changing your search or customer filter.</span>
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
          <div
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
          >
            <div className="customer-modal-heading">
              <div>
                <h2 id="contact-modal-title">
                  {editing ? 'Edit Contact' : 'Add Contact'}
                </h2>
                <p>Enter the customer contact details.</p>
              </div>
              <button
                type="button"
                className="customer-modal-close"
                aria-label="Close dialog"
                onClick={closeModal}
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={saveContact}>
              <label>
                Customer *
                <select
                  value={form.customerId}
                  onChange={(event) =>
                    setForm({ ...form, customerId: Number(event.target.value) })
                  }
                >
                  {customerOptions.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Full Name *
                <input
                  value={form.fullName}
                  onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                  required
                />
              </label>

              <label>
                Designation
                <input
                  value={form.designation}
                  onChange={(event) => setForm({ ...form, designation: event.target.value })}
                />
              </label>

              <label>
                Email *
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  required
                />
              </label>

              <label>
                Phone *
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  required
                />
              </label>

              <label className="skill-option">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(event) => setForm({ ...form, isPrimary: event.target.checked })}
                />
                Primary contact for this customer
              </label>

              {error && <div className="customer-form-error" role="alert">{error}</div>}

              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}