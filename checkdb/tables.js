const mysql = require('mysql2/promise')
;(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '1234',
    database: 'dts_recruitment',
  })
  const [tables] = await c.query('SHOW TABLES')
  console.log(JSON.stringify(tables, null, 1))
  await c.end()
})().catch((e) => console.error('ERR', e.message))
