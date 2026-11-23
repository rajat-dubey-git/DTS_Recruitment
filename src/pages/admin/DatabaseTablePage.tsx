import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { adminApi } from '../../api/admin'
import type { AdminColumn, AdminRecord, AdminTable } from '../../api/admin'

const PAGE_SIZE = 50
const numericTypes = new Set([
  'decimal',
  'float',
  'double',
  'int',
  'integer',
  'smallint',
  'mediumint',
  'bigint',
  'tinyint',
])
const integerTypes = new Set(['int', 'integer', 'smallint', 'mediumint', 'bigint', 'tinyint'])
const referenceLabelOrder = [
  'full_name',
  'company_name',
  'candidate_code',
  'profile_name',
  'service_name',
  'skill_name',
  'agreement_number',
  'order_number',
  'requirement_number',
  'invoice_number',
  'payment_reference',
  'employee_code',
  'contract_number',
  'application_number',
  'offer_reference',
  'customer_code',
  'email',
  'title',
]

type FormValues = Record<string, string>
type ReferenceRows = Record<string, AdminRecord[]>

function isBooleanColumn(column: AdminColumn) {
  return column.dataType === 'tinyint' && /\(\s*1\s*\)/.test(column.columnType)
}

function inputType(column: AdminColumn) {
  if (numericTypes.has(column.dataType)) return 'number'
  if (column.dataType === 'date') return 'date'
  if (column.dataType === 'datetime' || column.dataType === 'timestamp') return 'datetime-local'
  if (column.dataType === 'time') return 'time'
  return 'text'
}

function formatInputValue(value: unknown, column: AdminColumn) {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (column.dataType === 'date') return value.toISOString().slice(0, 10)
    if (column.dataType === 'datetime' || column.dataType === 'timestamp') {
      return value.toISOString().slice(0, 16)
    }
    return value.toISOString()
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function initialValues(table: AdminTable, record: AdminRecord | null): FormValues {
  const values: FormValues = {}
  for (const column of table.columns) {
    if (!column.editable || (record && column.primaryKey)) continue
    const defaultValue = column.defaultValue ?? ''
    const usableDefault = /^CURRENT_TIMESTAMP/i.test(defaultValue) ? '' : defaultValue
    values[column.name] = formatInputValue(
      record ? record[column.name] : usableDefault,
      column,
    )
  }
  return values
}

function referenceLabel(record: AdminRecord, referencedColumn: string) {
  const labelKey = referenceLabelOrder.find(
    (key) => key !== referencedColumn && record[key] !== null && record[key] !== undefined,
  )
  const label = labelKey ? String(record[labelKey]) : ''
  const value = String(record[referencedColumn] ?? '')
  return label ? `${value} · ${label}` : value
}

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function recordKeys(table: AdminTable, record: AdminRecord) {
  return Object.fromEntries(table.primaryKey.map((key) => [key, record[key]]))
}

export default function DatabaseTablePage() {
  const { module } = useParams()
  const navigate = useNavigate()
  const [tables, setTables] = useState<AdminTable[]>([])
  const [tablesLoading, setTablesLoading] = useState(true)
  const [tablesError, setTablesError] = useState('')
  const [records, setRecords] = useState<AdminRecord[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState('')
  const [total, setTotal] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [referenceRows, setReferenceRows] = useState<ReferenceRows>({})
  const [referenceError, setReferenceError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<AdminRecord | null>(null)
  const [formValues, setFormValues] = useState<FormValues>({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingKey, setDeletingKey] = useState('')

  const selectedTable = useMemo(
    () => tables.find((table) => table.slug === module) ?? null,
    [tables, module],
  )

  const loadTables = useCallback(async () => {
    setTablesLoading(true)
    setTablesError('')
    try {
      setTables(await adminApi.tables())
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : 'Unable to load database tables.')
    } finally {
      setTablesLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTables()
  }, [loadTables])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchText.trim())
      setOffset(0)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [searchText])

  useEffect(() => {
    setOffset(0)
    setSearchText('')
    setSearch('')
  }, [module])

  const loadRecords = useCallback(async () => {
    if (!selectedTable) return
    setRecordsLoading(true)
    setRecordsError('')
    try {
      const page = await adminApi.records(selectedTable.slug, {
        limit: PAGE_SIZE,
        offset,
        search,
      })
      setRecords(page.rows)
      setTotal(page.total)
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : 'Unable to load database records.')
    } finally {
      setRecordsLoading(false)
    }
  }, [selectedTable, offset, search])

  useEffect(() => {
    if (selectedTable) void loadRecords()
  }, [selectedTable, loadRecords])

  useEffect(() => {
    if (!selectedTable) {
      setReferenceRows({})
      setReferenceError('')
      return
    }

    let active = true
    setReferenceError('')
    const referencedTables = [
      ...new Set(
        selectedTable.columns
          .map((column) => column.foreignKey?.table)
          .filter((name): name is string => Boolean(name)),
      ),
    ]

    Promise.all(
      referencedTables.map(async (tableName) => {
        const referenceTable = tables.find((table) => table.name === tableName)
        if (!referenceTable) return [tableName, []] as const
        const result = await adminApi.records(referenceTable.slug, { limit: 100, offset: 0 })
        return [tableName, result.rows] as const
      }),
    )
      .then((entries) => {
        if (active) setReferenceRows(Object.fromEntries(entries))
      })
      .catch(() => {
        if (active) {
          setReferenceRows({})
          setReferenceError('Related record options could not be loaded. Enter the referenced ID instead.')
        }
      })

    return () => {
      active = false
    }
  }, [selectedTable, tables])

  const openCreate = () => {
    if (!selectedTable) return
    setEditingRecord(null)
    setFormValues(initialValues(selectedTable, null))
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (record: AdminRecord) => {
    if (!selectedTable) return
    setEditingRecord(record)
    setFormValues(initialValues(selectedTable, record))
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingRecord(null)
    setFormError('')
  }

  const toApiValues = () => {
    if (!selectedTable) return {}
    const values: AdminRecord = {}

    for (const column of selectedTable.columns) {
      if (!column.editable || (editingRecord && column.primaryKey)) continue
      const rawValue = formValues[column.name] ?? ''

      if (rawValue === '') {
        if (column.nullable) {
          values[column.name] = null
        } else if (column.defaultValue === null && !column.autoIncrement && !column.generated) {
          throw new Error(`${column.name} is required.`)
        }
        continue
      }

      if (isBooleanColumn(column)) {
        values[column.name] = rawValue === '1' ? 1 : 0
      } else if (column.dataType === 'json') {
        try {
          values[column.name] = JSON.parse(rawValue)
        } catch {
          throw new Error(`${column.name} must contain valid JSON.`)
        }
      } else if (
        (column.dataType === 'datetime' || column.dataType === 'timestamp') &&
        rawValue.includes('T')
      ) {
        values[column.name] = rawValue.replace('T', ' ')
      } else {
        values[column.name] = rawValue
      }
    }

    return values
  }

  const saveRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTable) return

    setSaving(true)
    setFormError('')
    try {
      const values = toApiValues()
      if (editingRecord) {
        await adminApi.update(selectedTable.slug, recordKeys(selectedTable, editingRecord), values)
      } else {
        await adminApi.create(selectedTable.slug, values)
        setTables((current) =>
          current.map((table) =>
            table.name === selectedTable.name ? { ...table, rowCount: table.rowCount + 1 } : table,
          ),
        )
      }
      closeModal()
      await loadRecords()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the record.')
    } finally {
      setSaving(false)
    }
  }

  const removeRecord = async (record: AdminRecord) => {
    if (!selectedTable || !window.confirm('Delete this database record?')) return
    const key = JSON.stringify(recordKeys(selectedTable, record))
    setDeletingKey(key)
    setRecordsError('')
    try {
      await adminApi.remove(selectedTable.slug, recordKeys(selectedTable, record))
      setTables((current) =>
        current.map((table) =>
          table.name === selectedTable.name
            ? { ...table, rowCount: Math.max(0, table.rowCount - 1) }
            : table,
        ),
      )
      if (records.length === 1 && offset > 0) setOffset((current) => Math.max(0, current - PAGE_SIZE))
      else await loadRecords()
    } catch (error) {
      setRecordsError(error instanceof Error ? error.message : 'Unable to delete the record.')
    } finally {
      setDeletingKey('')
    }
  }

  if (tablesLoading) {
    return <div className="page-loading" role="status">Loading database tables…</div>
  }

  if (tablesError) {
    return (
      <div className="panel database-message" role="alert">
        <p>{tablesError}</p>
        <button type="button" className="btn btn-primary" onClick={() => void loadTables()}>Retry</button>
      </div>
    )
  }

  if (!module) {
    return (
      <div className="dashboard">
        <div className="page-heading">
          <div>
            <div className="eyebrow">ADMINISTRATION · DATABASE</div>
            <h1>Database Records</h1>
            <p>Browse and manage records from the connected DTS database.</p>
          </div>
        </div>
        <div className="database-table-grid">
          {tables.map((table) => (
            <Link className="panel database-table-card" key={table.name} to={`/app/admin/${table.slug}`}>
              <strong>{table.name.replace(/_/g, ' ')}</strong>
              <span>{table.rowCount} records · {table.columns.length} fields</span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  if (!selectedTable) {
    return (
      <div className="panel database-message" role="alert">
        <p>That database table is not available.</p>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/app/admin')}>
          Browse tables
        </button>
      </div>
    )
  }

  const editableColumns = selectedTable.columns.filter(
    (column) => column.editable && !(editingRecord && column.primaryKey),
  )
  const firstPage = total === 0 ? 0 : offset + 1
  const lastPage = Math.min(offset + PAGE_SIZE, total)

  return (
    <div className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION · DATABASE</div>
          <h1>{selectedTable.name.replace(/_/g, ' ')}</h1>
          <p>{total} records in the database table.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={openCreate}>
          <Plus size={16} /> Add record
        </button>
      </div>

      <section className="panel customer-table-panel">
        <div className="customer-toolbar">
          <div>
            <h3>Table records</h3>
            <p>{selectedTable.name} · page size {PAGE_SIZE}</p>
          </div>
          <div className="customer-filters">
            <select
              aria-label="Select database table"
              value={selectedTable.slug}
              onChange={(event) => navigate(`/app/admin/${event.target.value}`)}
            >
              {tables.map((table) => (
                <option key={table.name} value={table.slug}>{table.name}</option>
              ))}
            </select>
            <div className="customer-search">
              <Search size={16} />
              <input
                aria-label={`Search ${selectedTable.name}`}
                placeholder={`Search ${selectedTable.name}...`}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
          </div>
        </div>

        {recordsError && <div className="form-error" role="alert">{recordsError}</div>}
        <div className="customer-table-wrapper">
          <table className="customer-table database-record-table">
            <thead>
              <tr>
                {selectedTable.columns.map((column) => (
                  <th key={column.name}>{column.name.replace(/_/g, ' ')}</th>
                ))}
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, rowIndex) => {
                const recordKey = JSON.stringify(recordKeys(selectedTable, record))
                return (
                  <tr key={recordKey || rowIndex}>
                    {selectedTable.columns.map((column) => (
                      <td key={column.name}>{displayValue(record[column.name])}</td>
                    ))}
                    <td>
                      <div className="customer-actions">
                        <button
                          type="button"
                          aria-label={`Edit record ${rowIndex + offset + 1}`}
                          title="Edit record"
                          onClick={() => openEdit(record)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete record ${rowIndex + offset + 1}`}
                          title="Delete record"
                          disabled={deletingKey === recordKey}
                          onClick={() => void removeRecord(record)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {!recordsLoading && records.length === 0 && (
                <tr>
                  <td colSpan={selectedTable.columns.length + 1}>
                    <div className="customer-empty">
                      <strong>No records found</strong>
                      <span>Change the search or add a new record.</span>
                    </div>
                  </td>
                </tr>
              )}
              {recordsLoading && (
                <tr>
                  <td colSpan={selectedTable.columns.length + 1}>
                    <div className="customer-empty"><span>Loading records…</span></div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="database-pagination">
          <span>{firstPage}–{lastPage} of {total}</span>
          <div>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Previous page"
              disabled={offset === 0 || recordsLoading}
              onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="btn btn-outline"
              aria-label="Next page"
              disabled={offset + PAGE_SIZE >= total || recordsLoading}
              onClick={() => setOffset((current) => current + PAGE_SIZE)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {modalOpen && (
        <div className="customer-modal-overlay">
          <div className="customer-modal database-record-modal" role="dialog" aria-modal="true" aria-labelledby="database-record-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="database-record-title">{editingRecord ? 'Edit' : 'Add'} {selectedTable.name.replace(/_/g, ' ')} record</h2>
                <p>Fields use the live database schema. Password hashes are not available in this form.</p>
              </div>
              <button type="button" className="customer-modal-close" aria-label="Close dialog" onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={saveRecord}>
              {referenceError && <div className="customer-form-error" role="alert">{referenceError}</div>}
              {editableColumns.map((column) => (
                <DatabaseField
                  key={column.name}
                  column={column}
                  value={formValues[column.name] ?? ''}
                  tables={tables}
                  referenceRows={referenceRows}
                  required={!column.nullable && column.defaultValue === null && !column.autoIncrement}
                  onChange={(value) => setFormValues((current) => ({ ...current, [column.name]: value }))}
                />
              ))}
              {formError && <div className="customer-form-error" role="alert">{formError}</div>}
              <div className="customer-modal-actions">
                <button type="button" className="btn btn-outline" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editingRecord ? 'Save changes' : 'Create record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function DatabaseField({
  column,
  value,
  tables,
  referenceRows,
  required,
  onChange,
}: {
  column: AdminColumn
  value: string
  tables: AdminTable[]
  referenceRows: ReferenceRows
  required: boolean
  onChange: (value: string) => void
}) {
  const referenceTable = column.foreignKey
    ? tables.find((table) => table.name === column.foreignKey?.table)
    : undefined
  const referenceColumn = column.foreignKey?.column
  const options = referenceTable && referenceColumn
    ? (referenceRows[referenceTable.name] ?? [])
        .filter((record) => record[referenceColumn] !== null && record[referenceColumn] !== undefined)
    : []

  if (isBooleanColumn(column)) {
    return (
      <label className="schema-checkbox">
        <input
          type="checkbox"
          checked={value === '1'}
          onChange={(event) => onChange(event.target.checked ? '1' : '0')}
        />
        {column.name.replace(/_/g, ' ')}
      </label>
    )
  }

  if (column.enumValues.length > 0) {
    return (
      <label className="database-field">
        <span>{column.name.replace(/_/g, ' ')}{required ? ' *' : ''}</span>
        <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {column.enumValues.map((option) => (
            <option key={option} value={option}>{option.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </label>
    )
  }

  if (column.foreignKey && referenceTable && referenceColumn && options.length > 0) {
    const hasCurrentValue = options.some((record) => String(record[referenceColumn]) === value)
    return (
      <label className="database-field">
        <span>{column.name.replace(/_/g, ' ')}{required ? ' *' : ''}</span>
        <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select…</option>
          {!hasCurrentValue && value && <option value={value}>{value} · current value</option>}
          {options.map((record) => (
            <option key={String(record[referenceColumn])} value={String(record[referenceColumn])}>
              {referenceLabel(record, referenceColumn)}
            </option>
          ))}
        </select>
      </label>
    )
  }

  const largeText = ['tinytext', 'text', 'mediumtext', 'longtext', 'json'].includes(column.dataType)
  const type = inputType(column)
  const step = integerTypes.has(column.dataType) ? '1' : 'any'
  const commonProps = {
    required,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  }

  return (
    <label className="database-field">
      <span>{column.name.replace(/_/g, ' ')}{required ? ' *' : ''}</span>
      {largeText ? (
        <textarea {...commonProps} rows={3} />
      ) : (
        <input
          {...commonProps}
          type={type}
          step={type === 'number' ? step : undefined}
          readOnly={column.primaryKey}
        />
      )}
      {column.foreignKey && (
        <small>Referenced table: {column.foreignKey.table.replace(/_/g, ' ')}</small>
      )}
    </label>
  )
}
