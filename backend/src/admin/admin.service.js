import { pool } from '../config/db.js'

const hiddenColumns = new Set(['password_hash'])
const immutableColumns = new Set(['created_at', 'updated_at', 'last_login_at'])
const searchableTypes = new Set([
  'char',
  'varchar',
  'tinytext',
  'text',
  'mediumtext',
  'longtext',
  'enum',
  'set',
])

let metadataPromise

function quoteIdentifier(identifier) {
  return `\`${identifier.replace(/`/g, '``')}\``
}

function enumValues(columnType) {
  if (!columnType.startsWith('enum(') && !columnType.startsWith('set(')) return []
  return [...columnType.matchAll(/'((?:''|[^'])*)'/g)]
    .map((match) => match[1].replace(/''/g, "'"))
}

async function loadMetadata() {
  const [columns] = await pool.query(
    `SELECT
       TABLE_NAME AS tableName,
       COLUMN_NAME AS columnName,
       COLUMN_TYPE AS columnType,
       DATA_TYPE AS dataType,
       IS_NULLABLE AS isNullable,
       COLUMN_DEFAULT AS columnDefault,
       COLUMN_KEY AS columnKey,
       EXTRA AS extra,
       GENERATION_EXPRESSION AS generationExpression,
       ORDINAL_POSITION AS ordinalPosition
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME IN (
         SELECT TABLE_NAME
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
       )
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  )
  const [foreignKeys] = await pool.query(
    `SELECT
       TABLE_NAME AS tableName,
       COLUMN_NAME AS columnName,
       REFERENCED_TABLE_NAME AS referencedTable,
       REFERENCED_COLUMN_NAME AS referencedColumn
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
  )

  const foreignKeyByColumn = new Map(
    foreignKeys.map((key) => [`${key.tableName}.${key.columnName}`, key]),
  )
  const tables = new Map()

  for (const column of columns) {
    if (!tables.has(column.tableName)) {
      tables.set(column.tableName, {
        name: column.tableName,
        slug: column.tableName.replace(/_/g, '-'),
        columns: [],
        primaryKey: [],
      })
    }

    const table = tables.get(column.tableName)
    if (column.columnKey === 'PRI') table.primaryKey.push(column.columnName)
    if (hiddenColumns.has(column.columnName)) continue

    const foreignKey = foreignKeyByColumn.get(`${column.tableName}.${column.columnName}`)
    table.columns.push({
      name: column.columnName,
      columnType: column.columnType,
      dataType: column.dataType,
      nullable: column.isNullable === 'YES',
      defaultValue: column.columnDefault,
      primaryKey: column.columnKey === 'PRI',
      unique: column.columnKey === 'UNI',
      autoIncrement: column.extra.includes('auto_increment'),
      generated: Boolean(column.generationExpression) || column.extra.includes('GENERATED'),
      editable: !immutableColumns.has(column.columnName) &&
        !column.extra.includes('auto_increment') &&
        !column.extra.includes('GENERATED') &&
        !Boolean(column.generationExpression),
      enumValues: enumValues(column.columnType),
      foreignKey: foreignKey
        ? {
            table: foreignKey.referencedTable,
            column: foreignKey.referencedColumn,
          }
        : null,
    })
  }

  return [...tables.values()].map((table) => ({
    ...table,
    searchableColumns: table.columns
      .filter((column) => searchableTypes.has(column.dataType))
      .map((column) => column.name),
  }))
}

export async function getTableMetadata() {
  if (!metadataPromise) metadataPromise = loadMetadata()
  return metadataPromise
}

export async function getTableBySlug(slug) {
  const tables = await getTableMetadata()
  return tables.find((table) => table.slug === slug) ?? null
}

export function quoteSqlIdentifier(identifier) {
  return quoteIdentifier(identifier)
}

export function publicColumnNames(table) {
  return table.columns.map((column) => column.name)
}

export function isHiddenColumn(columnName) {
  return hiddenColumns.has(columnName)
}

export function invalidInput(message) {
  const error = new Error(message)
  error.statusCode = 400
  return error
}

export function missingRecord() {
  const error = new Error('Record not found.')
  error.statusCode = 404
  return error
}

export function missingTable() {
  const error = new Error('Table not found.')
  error.statusCode = 404
  return error
}

export function validateRecordKeys(table, keys) {
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw invalidInput('Primary key values are required.')
  }

  if (table.primaryKey.length === 0) {
    throw invalidInput('This table does not have a supported primary key.')
  }

  for (const key of table.primaryKey) {
    if (!Object.prototype.hasOwnProperty.call(keys, key) || keys[key] === null) {
      throw invalidInput(`Primary key field "${key}" is required.`)
    }
  }

  return table.primaryKey
    .map((key) => `${quoteIdentifier(key)} = ?`)
    .join(' AND ')
}

export function validateRecordValues(table, values, { creating = false } = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    throw invalidInput('Record values must be an object.')
  }

  const columnByName = new Map(table.columns.map((column) => [column.name, column]))
  const primaryKeySet = new Set(table.primaryKey)
  const entries = []

  for (const [name, value] of Object.entries(values)) {
    const column = columnByName.get(name)
    if (!column || isHiddenColumn(name) || !column.editable) {
      throw invalidInput(`Field "${name}" cannot be changed.`)
    }
    if (primaryKeySet.has(name) && !creating) {
      throw invalidInput(`Primary key field "${name}" cannot be changed.`)
    }
    if (value === null && !column.nullable) {
      throw invalidInput(`Field "${name}" cannot be null.`)
    }
    if (value !== null && column.enumValues.length > 0 && !column.enumValues.includes(String(value))) {
      throw invalidInput(`Field "${name}" must be one of: ${column.enumValues.join(', ')}.`)
    }
    if (
      value !== null &&
      ['decimal', 'float', 'double', 'int', 'integer', 'smallint', 'mediumint', 'bigint', 'tinyint'].includes(column.dataType) &&
      !(
        (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) && Number.isFinite(Number(value)))
      )
    ) {
      throw invalidInput(`Field "${name}" must be a finite number.`)
    }
    if (value !== null && (column.dataType === 'json') && typeof value !== 'object') {
      throw invalidInput(`Field "${name}" must be a JSON value.`)
    }
    entries.push([name, value])
  }

  if (creating) {
    for (const column of table.columns) {
      if (
        !column.nullable &&
        !column.autoIncrement &&
        !column.generated &&
        column.defaultValue === null &&
        !Object.prototype.hasOwnProperty.call(values, column.name)
      ) {
        throw invalidInput(`Field "${column.name}" is required.`)
      }
    }
  } else if (entries.length === 0) {
    throw invalidInput('At least one field must be provided.')
  }

  return entries
}

export async function listTablesWithCounts() {
  const tables = await getTableMetadata()
  const countsQuery = tables
    .map((table) =>
      `SELECT '${table.name.replace(/'/g, "''")}' AS tableName, COUNT(*) AS rowCount FROM ${quoteIdentifier(table.name)}`,
    )
    .join(' UNION ALL ')
  const [counts] = await pool.query(countsQuery)
  const countByTable = new Map(counts.map((row) => [row.tableName, Number(row.rowCount)]))

  return tables.map((table) => ({
    ...table,
    rowCount: countByTable.get(table.name) ?? 0,
  }))
}

export async function listRecords(table, { limit, offset, search, sort, direction }) {
  const columns = publicColumnNames(table)
  const searchable = table.searchableColumns
  const whereValues = []
  let whereSql = ''

  if (search) {
    if (searchable.length === 0) throw invalidInput('Search is not available for this table.')
    whereSql = ` WHERE (${searchable
      .map((column) => `${quoteIdentifier(column)} LIKE ?`)
      .join(' OR ')})`
    whereValues.push(...searchable.map(() => `%${search}%`))
  }

  const orderColumn = sort && columns.includes(sort)
    ? sort
    : table.primaryKey[0]
  if (!orderColumn) throw invalidInput('This table does not have a supported primary key.')

  const orderDirection = direction === 'desc' ? 'DESC' : 'ASC'
  const tableName = quoteIdentifier(table.name)
  const selection = columns.map(quoteIdentifier).join(', ')
  const [rows] = await pool.execute(
    `SELECT ${selection} FROM ${tableName}${whereSql}
     ORDER BY ${quoteIdentifier(orderColumn)} ${orderDirection}
     LIMIT ? OFFSET ?`,
    [...whereValues, limit, offset],
  )
  const [counts] = await pool.execute(
    `SELECT COUNT(*) AS total FROM ${tableName}${whereSql}`,
    whereValues,
  )

  return { rows, total: Number(counts[0].total), limit, offset }
}

export async function createRecord(table, values) {
  const entries = validateRecordValues(table, values, { creating: true })
  for (const key of table.primaryKey) {
    const column = table.columns.find((item) => item.name === key)
    if (!column?.autoIncrement && !Object.prototype.hasOwnProperty.call(values, key)) {
      throw invalidInput(`Primary key field "${key}" is required to create this record.`)
    }
  }

  const tableName = quoteIdentifier(table.name)
  const columns = entries.map(([name]) => quoteIdentifier(name))
  const parameters = entries.map(([, value]) => value)
  const insertSql = entries.length === 0
    ? `INSERT INTO ${tableName} () VALUES ()`
    : `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${entries.map(() => '?').join(', ')})`
  const [result] = await pool.execute(insertSql, parameters)
  const keys = {}

  for (const key of table.primaryKey) {
    const column = table.columns.find((item) => item.name === key)
    if (column?.autoIncrement) {
      keys[key] = result.insertId
    } else if (Object.prototype.hasOwnProperty.call(values, key)) {
      keys[key] = values[key]
    } else {
      throw invalidInput(`Primary key field "${key}" is required to create this record.`)
    }
  }

  return getRecord(table, keys)
}

export async function updateRecord(table, keys, values) {
  const whereSql = validateRecordKeys(table, keys)
  const entries = validateRecordValues(table, values)
  const setSql = entries.map(([name]) => `${quoteIdentifier(name)} = ?`).join(', ')
  const parameters = [...entries.map(([, value]) => value), ...table.primaryKey.map((key) => keys[key])]
  await pool.execute(
    `UPDATE ${quoteIdentifier(table.name)} SET ${setSql} WHERE ${whereSql}`,
    parameters,
  )
  return getRecord(table, keys)
}

export async function deleteRecord(table, keys) {
  const whereSql = validateRecordKeys(table, keys)
  const [result] = await pool.execute(
    `DELETE FROM ${quoteIdentifier(table.name)} WHERE ${whereSql}`,
    table.primaryKey.map((key) => keys[key]),
  )
  if (result.affectedRows === 0) throw missingRecord()
}

async function getRecord(table, keys) {
  const whereSql = validateRecordKeys(table, keys)
  const selection = publicColumnNames(table).map(quoteIdentifier).join(', ')
  const [rows] = await pool.execute(
    `SELECT ${selection} FROM ${quoteIdentifier(table.name)} WHERE ${whereSql} LIMIT 1`,
    table.primaryKey.map((key) => keys[key]),
  )
  if (!rows[0]) throw missingRecord()
  return rows[0]
}
