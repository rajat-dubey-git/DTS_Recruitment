import axios from 'axios'
import { http } from './http'

export type AdminColumn = {
  name: string
  columnType: string
  dataType: string
  nullable: boolean
  defaultValue: string | null
  primaryKey: boolean
  unique: boolean
  autoIncrement: boolean
  generated: boolean
  editable: boolean
  enumValues: string[]
  foreignKey: { table: string; column: string } | null
}

export type AdminTable = {
  name: string
  slug: string
  readOnly: boolean
  columns: AdminColumn[]
  primaryKey: string[]
  searchableColumns: string[]
  rowCount: number
}

export type AdminRecord = Record<string, unknown>

export type RecordPage = {
  table: string
  rows: AdminRecord[]
  total: number
  limit: number
  offset: number
}

function messageFrom(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback
  }
  return fallback
}

export const adminApi = {
  async tables() {
    try {
      const response = await http.get<{ tables: AdminTable[] }>('/admin/tables')
      return response.data.tables
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load database tables.'))
    }
  },

  async records(
    table: string,
    params: { limit: number; offset: number; search?: string },
  ) {
    try {
      const response = await http.get<RecordPage>(`/admin/tables/${table}/records`, { params })
      return response.data
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to load database records.'))
    }
  },

  async create(table: string, values: AdminRecord) {
    try {
      const response = await http.post<{ record: AdminRecord }>(
        `/admin/tables/${table}/records`,
        { values },
      )
      return response.data.record
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to create the record.'))
    }
  },

  async update(table: string, keys: AdminRecord, values: AdminRecord) {
    try {
      const response = await http.put<{ record: AdminRecord }>(
        `/admin/tables/${table}/records`,
        { keys, values },
      )
      return response.data.record
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to update the record.'))
    }
  },

  async remove(table: string, keys: AdminRecord) {
    try {
      await http.delete(`/admin/tables/${table}/records`, { data: { keys } })
    } catch (error) {
      throw new Error(messageFrom(error, 'Unable to delete the record.'))
    }
  },
}
