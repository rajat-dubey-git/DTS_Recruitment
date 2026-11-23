
import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Search,
  Plus,
  Building2,
  Pencil,
  Power,
  X,
  Users,
} from 'lucide-react'

type Customer = {
  id: number
  companyName: string
  contactPerson: string
  email: string
  phone: string
  status: 'ACTIVE' | 'INACTIVE'
}

type CustomerForm = {
  companyName: string
  contactPerson: string
  email: string
  phone: string
}

const initialCustomers: Customer[] = [
  {
    id: 1,
    companyName: 'Tech Solutions Pvt. Ltd.',
    contactPerson: 'Amit Sharma',
    email: 'amit@techsolutions.com',
    phone: '9876543210',
    status: 'ACTIVE',
  },
  {
    id: 2,
    companyName: 'Global Systems India',
    contactPerson: 'Priya Verma',
    email: 'priya@globalsystems.com',
    phone: '9876543211',
    status: 'ACTIVE',
  },
  {
    id: 3,
    companyName: 'NextGen Technologies',
    contactPerson: 'Rahul Mehta',
    email: 'rahul@nextgen.com',
    phone: '9876543212',
    status: 'INACTIVE',
  },
  {
    id: 4,
    companyName: 'Digital Innovations Ltd.',
    contactPerson: 'Neha Gupta',
    email: 'neha@digitalinnovations.com',
    phone: '9876543213',
    status: 'ACTIVE',
  },
  {
    id: 5,
    companyName: 'Bright Future Consulting',
    contactPerson: 'Karan Singh',
    email: 'karan@brightfuture.com',
    phone: '9876543214',
    status: 'ACTIVE',
  },
]

const emptyForm: CustomerForm = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)

  const [form, setForm] = useState<CustomerForm>(emptyForm)
  const [formError, setFormError] = useState('')

  // Search and filter customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const searchText = search.toLowerCase()

      const matchesSearch =
        customer.companyName.toLowerCase().includes(searchText) ||
        customer.contactPerson.toLowerCase().includes(searchText) ||
        customer.email.toLowerCase().includes(searchText) ||
        customer.phone.includes(searchText)
        
      const matchesStatus =
        statusFilter === 'ALL' || customer.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [customers, search, statusFilter])

  // Customer statistics
  const totalCustomers = customers.length

  const activeCustomers = customers.filter(
    (customer) => customer.status === 'ACTIVE'
  ).length

  const inactiveCustomers = customers.filter(
    (customer) => customer.status === 'INACTIVE'
  ).length

  // Open modal for adding a customer
  const openAddModal = () => {
    setEditingCustomer(null)
    setForm(emptyForm)
    setFormError('')
    setIsModalOpen(true)
  }

  // Open modal for editing a customer
  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer)

    setForm({
      companyName: customer.companyName,
      contactPerson: customer.contactPerson,
      email: customer.email,
      phone: customer.phone,
    })

    setFormError('')
    setIsModalOpen(true)
  }

  // Handle form input changes
  const handleInputChange = (
    field: keyof CustomerForm,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
  }

  // Save a new customer or update an existing customer
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')

    const email = form.email.trim().toLowerCase()

    if (!form.companyName.trim() || !form.contactPerson.trim()) {
      setFormError('Company name and contact person are required.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Please enter a valid email address.')
      return
    }

    if (!/^\d{10}$/.test(form.phone.trim())) {
      setFormError('Please enter a valid 10-digit mobile number.')
      return
    }

    const duplicateEmail = customers.some(
      (customer) =>
        customer.email.toLowerCase() === email &&
        customer.id !== editingCustomer?.id
    )

    if (duplicateEmail) {
      setFormError('A customer with this email already exists.')
      return
    }

    if (editingCustomer) {
      setCustomers((previous) =>
        previous.map((customer) =>
          customer.id === editingCustomer.id
            ? {
                ...customer,
                ...form,
                companyName: form.companyName.trim(),
                contactPerson: form.contactPerson.trim(),
                email,
                phone: form.phone.trim(),
              }
            : customer
        )
      )
    } else {
      const newCustomer: Customer = {
        id: Math.max(0, ...customers.map((customer) => customer.id)) + 1,
        companyName: form.companyName.trim(),
        contactPerson: form.contactPerson.trim(),
        email,
        phone: form.phone.trim(),
        status: 'ACTIVE',
      }

      setCustomers((previous) => [newCustomer, ...previous])
    }

    setIsModalOpen(false)
    setForm(emptyForm)
    setEditingCustomer(null)
  }

  // Activate or deactivate a customer
  const toggleCustomerStatus = (id: number) => {
    setCustomers((previous) =>
      previous.map((customer) =>
        customer.id === id
          ? {
              ...customer,
              status:
                customer.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
            }
          : customer
      )
    )
  }

  return (
    <div className="customers-page">

      {/* Page heading */}
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>Customers</h1>
          <p>Manage customer organisations and their contact information.</p>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} />
          Add Customer
        </button>
      </div>

      {/* Statistics */}
      <div className="customer-stats">

        <div className="customer-stat-card">
          <div className="customer-stat-icon blue">
            <Building2 size={20} />
          </div>
          <div>
            <small>Total Customers</small>
            <h2>{totalCustomers}</h2>
          </div>
        </div>

        <div className="customer-stat-card">
          <div className="customer-stat-icon green">
            <Users size={20} />
          </div>
          <div>
            <small>Active Customers</small>
            <h2>{activeCustomers}</h2>
          </div>
        </div>

        <div className="customer-stat-card">
          <div className="customer-stat-icon orange">
            <Building2 size={20} />
          </div>
          <div>
            <small>Inactive Customers</small>
            <h2>{inactiveCustomers}</h2>
          </div>
        </div>

      </div>

      {/* Customer table */}
      <section className="panel customer-table-panel">

        <div className="customer-toolbar">
          <div>
            <h3>Customer Directory</h3>
            <p>View and manage all registered customers.</p>
          </div>

          <div className="customer-filters">

            <div className="customer-search">
              <Search size={16} />

              <input
                type="text"
                placeholder="Search customers..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter customers by status"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>

          </div>
        </div>

        <div className="customer-table-wrapper">
          <table className="customer-table">

            <thead>
              <tr>
                <th>COMPANY</th>
                <th>CONTACT PERSON</th>
                <th>EMAIL</th>
                <th>PHONE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map((customer) => (
                <tr key={customer.id}>

                  <td>
                    <div className="company-cell">
                      <div className="company-avatar">
                        <Building2 size={17} />
                      </div>

                      <strong>{customer.companyName}</strong>
                    </div>
                  </td>

                  <td>{customer.contactPerson}</td>

                  <td>{customer.email}</td>

                  <td>{customer.phone}</td>

                  <td>
                    <span
                      className={`customer-status ${
                        customer.status === 'ACTIVE' ? 'active' : 'inactive'
                      }`}
                    >
                      {customer.status}
                    </span>
                  </td>

                  <td>
                    <div className="customer-actions">

                      <button
                        type="button"
                        title="Edit customer"
                        onClick={() => openEditModal(customer)}
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        type="button"
                        title={
                          customer.status === 'ACTIVE'
                            ? 'Deactivate customer'
                            : 'Activate customer'
                        }
                        onClick={() => toggleCustomerStatus(customer.id)}
                      >
                        <Power size={15} />
                      </button>

                    </div>
                  </td>

                </tr>
              ))}

              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="customer-empty">
                      <Building2 size={30} />
                      <strong>No customers found</strong>
                      <span>Try changing your search or status filter.</span>
                    </div>
                  </td>
                </tr>
              )}

            </tbody>

          </table>
        </div>

        <div className="customer-table-footer">
          Showing {filteredCustomers.length} of {totalCustomers} customers
        </div>

      </section>

      {/* Add/Edit Customer Modal */}
      {isModalOpen && (
        <div
          className="customer-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false)
            }
          }}
        >

          <div
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-modal-title"
          >

            <div className="customer-modal-heading">
              <div>
                <h2 id="customer-modal-title">
                  {editingCustomer ? 'Edit Customer' : 'Add Customer'}
                </h2>

                <p>
                  Enter the organisation and primary contact details.
                </p>
              </div>

              <button
                type="button"
                className="customer-modal-close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>

              <label>
                Company Name *
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(event) =>
                    handleInputChange('companyName', event.target.value)
                  }
                  placeholder="Enter company name"
                  required
                />
              </label>

              <label>
                Contact Person *
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={(event) =>
                    handleInputChange('contactPerson', event.target.value)
                  }
                  placeholder="Enter contact person name"
                  required
                />
              </label>

              <label>
                Email Address *
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    handleInputChange('email', event.target.value)
                  }
                  placeholder="name@company.com"
                  required
                />
              </label>

              <label>
                Mobile Number *
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    handleInputChange('phone', event.target.value)
                  }
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  required
                />
              </label>

              {formError && (
                <div className="customer-form-error">
                  {formError}
                </div>
              )}

              <div className="customer-modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>

                <button type="submit" className="btn btn-primary">
                  {editingCustomer ? 'Save Changes' : 'Create Customer'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  )
}