import {
  createRecord,
  deleteRecord,
  getTableBySlug,
  invalidInput,
  listRecords,
  listTablesWithCounts,
  missingTable,
  updateRecord,
} from './admin.service.js'

async function tableForRequest(slug) {
  const table = await getTableBySlug(slug)
  if (!table) throw missingTable()
  return table
}

function parseInteger(value, name, { defaultValue, min, max }) {
  if (value === undefined) return defaultValue
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw invalidInput(`${name} must be an integer from ${min} to ${max}.`)
  }
  return parsed
}

export async function listTables(_req, res, next) {
  try {
    const tables = await listTablesWithCounts()
    return res.json({ tables })
  } catch (error) {
    return next(error)
  }
}

export async function listTableRecords(req, res, next) {
  try {
    const table = await tableForRequest(req.params.table)
    const limit = parseInteger(req.query.limit, 'limit', {
      defaultValue: 50,
      min: 1,
      max: 100,
    })
    const offset = parseInteger(req.query.offset, 'offset', {
      defaultValue: 0,
      min: 0,
      max: 1000000,
    })
    const search = req.query.search ?? ''
    const sort = req.query.sort ?? ''
    const direction = req.query.direction ?? 'asc'

    if (typeof search !== 'string' || search.length > 100) {
      throw invalidInput('Search must be a string of 100 characters or fewer.')
    }
    if (typeof sort !== 'string') throw invalidInput('sort must be a column name.')
    if (direction !== 'asc' && direction !== 'desc') {
      throw invalidInput('direction must be "asc" or "desc".')
    }

    const result = await listRecords(table, { limit, offset, search, sort, direction })
    return res.json({ table: table.name, ...result })
  } catch (error) {
    return next(error)
  }
}

export async function insertTableRecord(req, res, next) {
  try {
    const table = await tableForRequest(req.params.table)
    const record = await createRecord(table, req.body?.values)
    return res.status(201).json({ record })
  } catch (error) {
    return next(error)
  }
}

export async function updateTableRecord(req, res, next) {
  try {
    const table = await tableForRequest(req.params.table)
    if (
      table.name === 'users' &&
      Number(req.body?.keys?.user_id) === req.authUser.user_id &&
      (Object.prototype.hasOwnProperty.call(req.body?.values ?? {}, 'role') ||
        Object.prototype.hasOwnProperty.call(req.body?.values ?? {}, 'status'))
    ) {
      throw invalidInput('You cannot change your own role or status.')
    }
    const record = await updateRecord(table, req.body?.keys, req.body?.values)
    return res.json({ record })
  } catch (error) {
    return next(error)
  }
}

export async function deleteTableRecord(req, res, next) {
  try {
    const table = await tableForRequest(req.params.table)
    if (table.name === 'users' && Number(req.body?.keys?.user_id) === req.authUser.user_id) {
      throw invalidInput('You cannot delete your own account.')
    }
    await deleteRecord(table, req.body?.keys)
    return res.json({ message: 'Record deleted.' })
  } catch (error) {
    return next(error)
  }
}
