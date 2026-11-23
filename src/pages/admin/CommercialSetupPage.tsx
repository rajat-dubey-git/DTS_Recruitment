import { createContext, useContext, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  Navigate,
  NavLink,
  Outlet,
  useParams,
} from 'react-router-dom'
import { Plus, Search, Pencil, Power, X, FileText } from 'lucide-react'

type Status = 'ACTIVE' | 'INACTIVE'
type Section = 'agreements' | 'rate-cards' | 'service-orders'

type Agreement = {
  id: number
  agreementNumber: string
  customerId: number
  startDate: string
  endDate: string
  notes: string
  status: Status
}

type RateCard = {
  id: number
  agreementId: number
  serviceTypeId: number
  jobProfileId: number | null
  billingUnit: string
  currency: string
  rate: number
  effectiveFrom: string
  effectiveTo: string
  status: Status
}

type ServiceOrder = {
  id: number
  orderNumber: string
  agreementId: number
  rateCardId: number
  headcount: number
  location: string
  startDate: string
  endDate: string
  status: Status
}

type AgreementForm = {
  agreementNumber: string
  customerId: string
  startDate: string
  endDate: string
  notes: string
}

type RateCardForm = {
  agreementId: string
  serviceTypeId: string
  jobProfileId: string
  billingUnit: string
  currency: string
  rate: string
  effectiveFrom: string
  effectiveTo: string
}

type ServiceOrderForm = {
  orderNumber: string
  agreementId: string
  rateCardId: string
  headcount: string
  location: string
  startDate: string
  endDate: string
}

const customers = [
  { id: 1, name: 'Tech Solutions Pvt. Ltd.' },
  { id: 2, name: 'Global Systems India' },
  { id: 3, name: 'NextGen Technologies' },
  { id: 4, name: 'Digital Innovations Ltd.' },
  { id: 5, name: 'Bright Future Consulting' },
]

const serviceTypes = [
  { id: 1, name: 'Full-Time' },
  { id: 2, name: 'Part-Time' },
  { id: 3, name: 'DTS Payroll' },
  { id: 4, name: 'Customer Payroll' },
]

const jobProfiles = [
  { id: 1, name: 'Java Developer' },
  { id: 2, name: 'React Developer' },
  { id: 3, name: 'Python Developer' },
]

const initialAgreements: Agreement[] = [
  {
    id: 1,
    agreementNumber: 'AGR-2026-001',
    customerId: 1,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    notes: 'Annual recruitment services agreement',
    status: 'ACTIVE',
  },
  {
    id: 2,
    agreementNumber: 'AGR-2026-002',
    customerId: 2,
    startDate: '2026-02-01',
    endDate: '2027-01-31',
    notes: 'Technology staffing services',
    status: 'ACTIVE',
  },
]

const initialRateCards: RateCard[] = [
  {
    id: 1,
    agreementId: 1,
    serviceTypeId: 1,
    jobProfileId: 1,
    billingUnit: 'Per placement',
    currency: 'INR',
    rate: 85000,
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    status: 'ACTIVE',
  },
  {
    id: 2,
    agreementId: 2,
    serviceTypeId: 3,
    jobProfileId: 2,
    billingUnit: 'Per month',
    currency: 'INR',
    rate: 125000,
    effectiveFrom: '2026-02-01',
    effectiveTo: '2027-01-31',
    status: 'ACTIVE',
  },
]

const initialServiceOrders: ServiceOrder[] = [
  {
    id: 1,
    orderNumber: 'SO-2026-001',
    agreementId: 1,
    rateCardId: 1,
    headcount: 3,
    location: 'Bengaluru',
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
  },
]

const emptyAgreementForm: AgreementForm = {
  agreementNumber: '',
  customerId: '',
  startDate: '',
  endDate: '',
  notes: '',
}

const emptyRateCardForm: RateCardForm = {
  agreementId: '',
  serviceTypeId: '',
  jobProfileId: '',
  billingUnit: 'Per placement',
  currency: 'INR',
  rate: '',
  effectiveFrom: '',
  effectiveTo: '',
}

const emptyServiceOrderForm: ServiceOrderForm = {
  orderNumber: '',
  agreementId: '',
  rateCardId: '',
  headcount: '1',
  location: '',
  startDate: '',
  endDate: '',
}

const tabs: { section: Section; label: string }[] = [
  { section: 'agreements', label: 'Agreements' },
  { section: 'rate-cards', label: 'Rate Cards' },
  { section: 'service-orders', label: 'Service Orders' },
]

type CommercialData = {
  agreements: Agreement[]
  setAgreements: React.Dispatch<React.SetStateAction<Agreement[]>>
  rateCards: RateCard[]
  setRateCards: React.Dispatch<React.SetStateAction<RateCard[]>>
  serviceOrders: ServiceOrder[]
  setServiceOrders: React.Dispatch<React.SetStateAction<ServiceOrder[]>>
}

const CommercialDataContext = createContext<CommercialData | null>(null)

export function CommercialSetupProvider({ children }: { children?: ReactNode }) {
  const [agreements, setAgreements] = useState(initialAgreements)
  const [rateCards, setRateCards] = useState(initialRateCards)
  const [serviceOrders, setServiceOrders] = useState(initialServiceOrders)

  const value = {
    agreements,
    setAgreements,
    rateCards,
    setRateCards,
    serviceOrders,
    setServiceOrders,
  }

  return (
    <CommercialDataContext.Provider value={value}>
      {children ?? <Outlet />}
    </CommercialDataContext.Provider>
  )
}

function useCommercialData() {
  const value = useContext(CommercialDataContext)
  if (!value) {
    throw new Error('CommercialSetupPage must be inside CommercialSetupProvider')
  }
  return value
}

function isSection(value: string | undefined): value is Section {
  return value === 'agreements' || value === 'rate-cards' || value === 'service-orders'
}

function isValidDateRange(start: string, end: string) {
  return !start || !end || end >= start
}

export default function CommercialSetupPage() {
  const { section: sectionParam } = useParams()
  const {
    agreements,
    setAgreements,
    rateCards,
    setRateCards,
    serviceOrders,
    setServiceOrders,
  } = useCommercialData()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [agreementForm, setAgreementForm] = useState(emptyAgreementForm)
  const [rateCardForm, setRateCardForm] = useState(emptyRateCardForm)
  const [serviceOrderForm, setServiceOrderForm] = useState(emptyServiceOrderForm)

  const validSection = isSection(sectionParam)
  const section: Section = validSection ? sectionParam : 'agreements'
  const query = search.trim().toLowerCase()

  const customerName = (id: number) =>
    customers.find((customer) => customer.id === id)?.name ?? 'Unknown customer'

  const agreementNumber = (id: number) =>
    agreements.find((agreement) => agreement.id === id)?.agreementNumber ?? 'Unknown agreement'

  const rateCardLabel = (id: number) => {
    const card = rateCards.find((item) => item.id === id)
    if (!card) return 'Unknown rate card'
    const profile = card.jobProfileId
      ? jobProfiles.find((item) => item.id === card.jobProfileId)?.name
      : 'All profiles'
    const service = serviceTypes.find((item) => item.id === card.serviceTypeId)?.name
    return `${service ?? 'Service'} · ${profile ?? 'Profile'}`
  }

  const filteredAgreements = useMemo(
    () =>
      agreements.filter((agreement) =>
        `${agreement.agreementNumber} ${customerName(agreement.customerId)} ${agreement.notes}`
          .toLowerCase()
          .includes(query)
      ),
    [agreements, query]
  )

  const filteredRateCards = useMemo(
    () =>
      rateCards.filter((card) =>
        `${agreementNumber(card.agreementId)} ${rateCardLabel(card.id)} ${card.billingUnit}`
          .toLowerCase()
          .includes(query)
      ),
    [rateCards, agreements, query]
  )

  const filteredServiceOrders = useMemo(
    () =>
      serviceOrders.filter((order) =>
        `${order.orderNumber} ${agreementNumber(order.agreementId)} ${order.location} ${rateCardLabel(order.rateCardId)}`
          .toLowerCase()
          .includes(query)
      ),
    [serviceOrders, agreements, rateCards, query]
  )

  if (!validSection) {
    return <Navigate to="/app/commercial/agreements" replace />
  }

  const resetForms = () => {
    setAgreementForm(emptyAgreementForm)
    setRateCardForm(emptyRateCardForm)
    setServiceOrderForm(emptyServiceOrderForm)
    setEditingId(null)
    setError('')
  }

  const closeModal = () => {
    setModalOpen(false)
    resetForms()
  }

  const openAdd = () => {
    resetForms()
    if (section === 'rate-cards' && agreements.length > 0) {
      setRateCardForm({ ...emptyRateCardForm, agreementId: String(agreements[0].id) })
    }
    if (section === 'service-orders' && agreements.length > 0) {
      const agreementId = String(agreements[0].id)
      const firstCard = rateCards.find((card) => card.agreementId === Number(agreementId))
      setServiceOrderForm({
        ...emptyServiceOrderForm,
        agreementId,
        rateCardId: firstCard ? String(firstCard.id) : '',
      })
    }
    setModalOpen(true)
  }

  const openEditAgreement = (agreement: Agreement) => {
    setEditingId(agreement.id)
    setAgreementForm({
      agreementNumber: agreement.agreementNumber,
      customerId: String(agreement.customerId),
      startDate: agreement.startDate,
      endDate: agreement.endDate,
      notes: agreement.notes,
    })
    setError('')
    setModalOpen(true)
  }

  const openEditRateCard = (card: RateCard) => {
    setEditingId(card.id)
    setRateCardForm({
      agreementId: String(card.agreementId),
      serviceTypeId: String(card.serviceTypeId),
      jobProfileId: card.jobProfileId ? String(card.jobProfileId) : '',
      billingUnit: card.billingUnit,
      currency: card.currency,
      rate: String(card.rate),
      effectiveFrom: card.effectiveFrom,
      effectiveTo: card.effectiveTo,
    })
    setError('')
    setModalOpen(true)
  }

  const openEditServiceOrder = (order: ServiceOrder) => {
    setEditingId(order.id)
    setServiceOrderForm({
      orderNumber: order.orderNumber,
      agreementId: String(order.agreementId),
      rateCardId: String(order.rateCardId),
      headcount: String(order.headcount),
      location: order.location,
      startDate: order.startDate,
      endDate: order.endDate,
    })
    setError('')
    setModalOpen(true)
  }

  const saveAgreement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const number = agreementForm.agreementNumber.trim().toUpperCase()
    if (!number || !agreementForm.customerId || !agreementForm.startDate || !agreementForm.endDate) {
      setError('Agreement number, customer, and both dates are required.')
      return
    }
    if (!isValidDateRange(agreementForm.startDate, agreementForm.endDate)) {
      setError('The agreement end date must be on or after the start date.')
      return
    }
    if (agreements.some((item) => item.agreementNumber.toLowerCase() === number.toLowerCase() && item.id !== editingId)) {
      setError('An agreement with this number already exists.')
      return
    }

    const data = {
      agreementNumber: number,
      customerId: Number(agreementForm.customerId),
      startDate: agreementForm.startDate,
      endDate: agreementForm.endDate,
      notes: agreementForm.notes.trim(),
    }

    setAgreements((current) =>
      editingId === null
        ? [{ id: Math.max(0, ...current.map((item) => item.id)) + 1, ...data, status: 'ACTIVE' }, ...current]
        : current.map((item) => item.id === editingId ? { ...item, ...data } : item)
    )
    closeModal()
  }

  const saveRateCard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const rate = Number(rateCardForm.rate)
    if (!rateCardForm.agreementId || !rateCardForm.serviceTypeId || !rateCardForm.effectiveFrom || !rateCardForm.effectiveTo) {
      setError('Agreement, service type, rate, and effective dates are required.')
      return
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      setError('Enter a rate greater than zero.')
      return
    }
    if (!isValidDateRange(rateCardForm.effectiveFrom, rateCardForm.effectiveTo)) {
      setError('The effective-to date must be on or after the effective-from date.')
      return
    }
    const duplicate = rateCards.some(
      (item) =>
        item.agreementId === Number(rateCardForm.agreementId) &&
        item.serviceTypeId === Number(rateCardForm.serviceTypeId) &&
        item.jobProfileId === (rateCardForm.jobProfileId ? Number(rateCardForm.jobProfileId) : null) &&
        item.id !== editingId
    )
    if (duplicate) {
      setError('A rate card already exists for this agreement, service type, and job profile.')
      return
    }

    const data = {
      agreementId: Number(rateCardForm.agreementId),
      serviceTypeId: Number(rateCardForm.serviceTypeId),
      jobProfileId: rateCardForm.jobProfileId ? Number(rateCardForm.jobProfileId) : null,
      billingUnit: rateCardForm.billingUnit,
      currency: rateCardForm.currency,
      rate,
      effectiveFrom: rateCardForm.effectiveFrom,
      effectiveTo: rateCardForm.effectiveTo,
    }

    setRateCards((current) =>
      editingId === null
        ? [{ id: Math.max(0, ...current.map((item) => item.id)) + 1, ...data, status: 'ACTIVE' }, ...current]
        : current.map((item) => item.id === editingId ? { ...item, ...data } : item)
    )
    closeModal()
  }

  const saveServiceOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const number = serviceOrderForm.orderNumber.trim().toUpperCase()
    const headcount = Number(serviceOrderForm.headcount)
    const selectedCard = rateCards.find((card) => card.id === Number(serviceOrderForm.rateCardId))

    if (!number || !serviceOrderForm.agreementId || !serviceOrderForm.rateCardId || !serviceOrderForm.startDate) {
      setError('Order number, agreement, rate card, and start date are required.')
      return
    }
    if (!selectedCard || selectedCard.agreementId !== Number(serviceOrderForm.agreementId)) {
      setError('Select a rate card that belongs to the selected agreement.')
      return
    }
    if (!Number.isInteger(headcount) || headcount < 1) {
      setError('Headcount must be a whole number greater than zero.')
      return
    }
    if (!isValidDateRange(serviceOrderForm.startDate, serviceOrderForm.endDate)) {
      setError('The order end date must be on or after the start date.')
      return
    }
    if (serviceOrders.some((item) => item.orderNumber.toLowerCase() === number.toLowerCase() && item.id !== editingId)) {
      setError('A service order with this number already exists.')
      return
    }

    const data = {
      orderNumber: number,
      agreementId: Number(serviceOrderForm.agreementId),
      rateCardId: Number(serviceOrderForm.rateCardId),
      headcount,
      location: serviceOrderForm.location.trim(),
      startDate: serviceOrderForm.startDate,
      endDate: serviceOrderForm.endDate,
    }

    setServiceOrders((current) =>
      editingId === null
        ? [{ id: Math.max(0, ...current.map((item) => item.id)) + 1, ...data, status: 'ACTIVE' }, ...current]
        : current.map((item) => item.id === editingId ? { ...item, ...data } : item)
    )
    closeModal()
  }

  const toggleAgreementStatus = (id: number) =>
    setAgreements((current) => current.map((item) => item.id === id
      ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
      : item))

  const toggleRateCardStatus = (id: number) =>
    setRateCards((current) => current.map((item) => item.id === id
      ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
      : item))

  const toggleOrderStatus = (id: number) =>
    setServiceOrders((current) => current.map((item) => item.id === id
      ? { ...item, status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }
      : item))

  const title = section === 'agreements'
    ? 'Agreements'
    : section === 'rate-cards'
      ? 'Rate Cards'
      : 'Service Orders'

  const subtitle = section === 'agreements'
    ? 'Manage customer agreements and their effective periods.'
    : section === 'rate-cards'
      ? 'Configure rates by agreement, service type, and job profile.'
      : 'Create service orders using an agreement and its approved rate card.'

  const addLabel = section === 'agreements'
    ? 'Add Agreement'
    : section === 'rate-cards'
      ? 'Add Rate Card'
      : 'Add Service Order'

  const rateCardAgreementOptions = agreements.filter((item) => item.status === 'ACTIVE')
  const orderAgreementOptions = agreements.filter((item) => item.status === 'ACTIVE')
  const availableOrderRateCards = rateCards.filter(
    (card) => card.status === 'ACTIVE' && card.agreementId === Number(serviceOrderForm.agreementId)
  )

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION · COMMERCIAL SETUP</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openAdd}>
          <Plus size={16} /> {addLabel}
        </button>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="Commercial setup modules">
        {tabs.map((tab) => (
          <NavLink
            key={tab.section}
            to={`/app/commercial/${tab.section}`}
            role="tab"
            aria-selected={section === tab.section}
            className={section === tab.section ? 'admin-tab active' : 'admin-tab'}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>{title} Directory</h3>
            <p>
              {section === 'agreements' ? agreements.length
                : section === 'rate-cards' ? rateCards.length
                  : serviceOrders.length} records
            </p>
          </div>
          <div className="customer-search">
            <Search size={16} />
            <input
              aria-label={`Search ${title.toLowerCase()}`}
              placeholder={`Search ${title.toLowerCase()}...`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="customer-table-wrapper">
          {section === 'agreements' && (
            <table className="customer-table">
              <thead><tr><th>AGREEMENT</th><th>CUSTOMER</th><th>PERIOD</th><th>NOTES</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {filteredAgreements.map((item) => (
                  <tr key={item.id}>
                    <td><div className="company-cell"><div className="company-avatar"><FileText size={16} /></div><strong>{item.agreementNumber}</strong></div></td>
                    <td>{customerName(item.customerId)}</td>
                    <td>{item.startDate} – {item.endDate}</td>
                    <td>{item.notes || '—'}</td>
                    <td><span className={`customer-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                    <td><div className="customer-actions">
                      <button type="button" title="Edit agreement" onClick={() => openEditAgreement(item)}><Pencil size={15} /></button>
                      <button type="button" title="Change status" onClick={() => toggleAgreementStatus(item.id)}><Power size={15} /></button>
                    </div></td>
                  </tr>
                ))}
                {filteredAgreements.length === 0 && <EmptyRow columns={6} label="No agreements found" />}
              </tbody>
            </table>
          )}

          {section === 'rate-cards' && (
            <table className="customer-table">
              <thead><tr><th>AGREEMENT</th><th>SERVICE</th><th>JOB PROFILE</th><th>RATE</th><th>EFFECTIVE PERIOD</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {filteredRateCards.map((item) => (
                  <tr key={item.id}>
                    <td>{agreementNumber(item.agreementId)}</td>
                    <td>{serviceTypes.find((value) => value.id === item.serviceTypeId)?.name}</td>
                    <td>{item.jobProfileId ? jobProfiles.find((value) => value.id === item.jobProfileId)?.name : 'All profiles'}</td>
                    <td>{item.currency} {item.rate.toLocaleString()} / {item.billingUnit.replace('Per ', '').toLowerCase()}</td>
                    <td>{item.effectiveFrom} – {item.effectiveTo}</td>
                    <td><span className={`customer-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                    <td><div className="customer-actions">
                      <button type="button" title="Edit rate card" onClick={() => openEditRateCard(item)}><Pencil size={15} /></button>
                      <button type="button" title="Change status" onClick={() => toggleRateCardStatus(item.id)}><Power size={15} /></button>
                    </div></td>
                  </tr>
                ))}
                {filteredRateCards.length === 0 && <EmptyRow columns={7} label="No rate cards found" />}
              </tbody>
            </table>
          )}

          {section === 'service-orders' && (
            <table className="customer-table">
              <thead><tr><th>ORDER</th><th>AGREEMENT</th><th>RATE CARD</th><th>HEADCOUNT</th><th>LOCATION</th><th>PERIOD</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
              <tbody>
                {filteredServiceOrders.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.orderNumber}</strong></td>
                    <td>{agreementNumber(item.agreementId)}</td>
                    <td>{rateCardLabel(item.rateCardId)}</td>
                    <td>{item.headcount}</td>
                    <td>{item.location || '—'}</td>
                    <td>{item.startDate}{item.endDate ? ` – ${item.endDate}` : ' – Ongoing'}</td>
                    <td><span className={`customer-status ${item.status.toLowerCase()}`}>{item.status}</span></td>
                    <td><div className="customer-actions">
                      <button type="button" title="Edit service order" onClick={() => openEditServiceOrder(item)}><Pencil size={15} /></button>
                      <button type="button" title="Change status" onClick={() => toggleOrderStatus(item.id)}><Power size={15} /></button>
                    </div></td>
                  </tr>
                ))}
                {filteredServiceOrders.length === 0 && <EmptyRow columns={8} label="No service orders found" />}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="commercial-modal-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="commercial-modal-title">
                  {editingId === null ? 'Add' : 'Edit'} {section === 'agreements' ? 'Agreement' : section === 'rate-cards' ? 'Rate Card' : 'Service Order'}
                </h2>
                <p>Enter the commercial setup details.</p>
              </div>
              <button type="button" className="customer-modal-close" aria-label="Close dialog" onClick={closeModal}><X size={19} /></button>
            </div>

            {section === 'agreements' && (
              <form onSubmit={saveAgreement}>
                <label>Agreement Number *<input value={agreementForm.agreementNumber} onChange={(event) => setAgreementForm({ ...agreementForm, agreementNumber: event.target.value })} required /></label>
                <label>Customer *
                  <select value={agreementForm.customerId} onChange={(event) => setAgreementForm({ ...agreementForm, customerId: event.target.value })} required>
                    <option value="">Select customer</option>
                    {customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                </label>
                <div className="customer-form-row">
                  <label>Start Date *<input type="date" value={agreementForm.startDate} onChange={(event) => setAgreementForm({ ...agreementForm, startDate: event.target.value })} required /></label>
                  <label>End Date *<input type="date" value={agreementForm.endDate} onChange={(event) => setAgreementForm({ ...agreementForm, endDate: event.target.value })} required /></label>
                </div>
                <label>Notes<textarea rows={3} value={agreementForm.notes} onChange={(event) => setAgreementForm({ ...agreementForm, notes: event.target.value })} /></label>
                <ModalActions error={error} editing={editingId !== null} onCancel={closeModal} createLabel="Create Agreement" />
              </form>
            )}

            {section === 'rate-cards' && (
              <form onSubmit={saveRateCard}>
                <label>Agreement *
                  <select value={rateCardForm.agreementId} onChange={(event) => setRateCardForm({ ...rateCardForm, agreementId: event.target.value })} required>
                    <option value="">Select agreement</option>
                    {rateCardAgreementOptions.map((item) => <option key={item.id} value={item.id}>{item.agreementNumber} · {customerName(item.customerId)}</option>)}
                  </select>
                </label>
                <div className="customer-form-row">
                  <label>Service Type *
                    <select value={rateCardForm.serviceTypeId} onChange={(event) => setRateCardForm({ ...rateCardForm, serviceTypeId: event.target.value })} required>
                      <option value="">Select service</option>
                      {serviceTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <label>Job Profile
                    <select value={rateCardForm.jobProfileId} onChange={(event) => setRateCardForm({ ...rateCardForm, jobProfileId: event.target.value })}>
                      <option value="">All profiles</option>
                      {jobProfiles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="customer-form-row">
                  <label>Rate *
                    <input type="number" min="0.01" step="0.01" value={rateCardForm.rate} onChange={(event) => setRateCardForm({ ...rateCardForm, rate: event.target.value })} required />
                  </label>
                  <label>Currency *
                    <select value={rateCardForm.currency} onChange={(event) => setRateCardForm({ ...rateCardForm, currency: event.target.value })}>
                      <option value="INR">INR</option><option value="USD">USD</option>
                    </select>
                  </label>
                </div>
                <div className="customer-form-row">
                  <label>Billing Unit *
                    <select value={rateCardForm.billingUnit} onChange={(event) => setRateCardForm({ ...rateCardForm, billingUnit: event.target.value })}>
                      <option>Per placement</option><option>Per hour</option><option>Per day</option><option>Per month</option>
                    </select>
                  </label>
                  <span />
                </div>
                <div className="customer-form-row">
                  <label>Effective From *<input type="date" value={rateCardForm.effectiveFrom} onChange={(event) => setRateCardForm({ ...rateCardForm, effectiveFrom: event.target.value })} required /></label>
                  <label>Effective To *<input type="date" value={rateCardForm.effectiveTo} onChange={(event) => setRateCardForm({ ...rateCardForm, effectiveTo: event.target.value })} required /></label>
                </div>
                <ModalActions error={error} editing={editingId !== null} onCancel={closeModal} createLabel="Create Rate Card" />
              </form>
            )}

            {section === 'service-orders' && (
              <form onSubmit={saveServiceOrder}>
                <label>Order Number *<input value={serviceOrderForm.orderNumber} onChange={(event) => setServiceOrderForm({ ...serviceOrderForm, orderNumber: event.target.value })} required /></label>
                <label>Agreement *
                  <select
                    value={serviceOrderForm.agreementId}
                    onChange={(event) => {
                      const agreementId = event.target.value
                      const firstCard = rateCards.find((card) => card.status === 'ACTIVE' && card.agreementId === Number(agreementId))
                      setServiceOrderForm({ ...serviceOrderForm, agreementId, rateCardId: firstCard ? String(firstCard.id) : '' })
                    }}
                    required
                  >
                    <option value="">Select agreement</option>
                    {orderAgreementOptions.map((item) => <option key={item.id} value={item.id}>{item.agreementNumber} · {customerName(item.customerId)}</option>)}
                  </select>
                </label>
                <label>Rate Card *
                  <select value={serviceOrderForm.rateCardId} onChange={(event) => setServiceOrderForm({ ...serviceOrderForm, rateCardId: event.target.value })} required>
                    <option value="">Select rate card</option>
                    {availableOrderRateCards.map((item) => <option key={item.id} value={item.id}>{rateCardLabel(item.id)}</option>)}
                  </select>
                </label>
                <div className="customer-form-row">
                  <label>Headcount *<input type="number" min="1" step="1" value={serviceOrderForm.headcount} onChange={(event) => setServiceOrderForm({ ...serviceOrderForm, headcount: event.target.value })} required /></label>
                  <label>Location<input value={serviceOrderForm.location} onChange={(event) => setServiceOrderForm({ ...serviceOrderForm, location: event.target.value })} /></label>
                </div>
                <div className="customer-form-row">
                  <label>Start Date *<input type="date" value={serviceOrderForm.startDate} onChange={(event) => setServiceOrderForm({ ...serviceOrderForm, startDate: event.target.value })} required /></label>
                  <label>End Date<input type="date" value={serviceOrderForm.endDate} onChange={(event) => setServiceOrderForm({ ...serviceOrderForm, endDate: event.target.value })} /></label>
                </div>
                <ModalActions error={error} editing={editingId !== null} onCancel={closeModal} createLabel="Create Service Order" />
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyRow({ columns, label }: { columns: number; label: string }) {
  return (
    <tr>
      <td colSpan={columns}>
        <div className="customer-empty">
          <FileText size={28} />
          <strong>{label}</strong>
          <span>Try a different search or add a new record.</span>
        </div>
      </td>
    </tr>
  )
}

function ModalActions({
  error,
  editing,
  onCancel,
  createLabel,
}: {
  error: string
  editing: boolean
  onCancel: () => void
  createLabel: string
}) {
  return (
    <>
      {error && <div className="customer-form-error" role="alert">{error}</div>}
      <div className="customer-modal-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">{editing ? 'Save Changes' : createLabel}</button>
      </div>
    </>
  )
}
