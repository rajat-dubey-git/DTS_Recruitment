const mysql = require('mysql2/promise')
;(async () => {
  const c = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '1234',
    database: 'dts_recruitment',
  })
  const [users] = await c.query("SELECT user_id, full_name, email, role, status, password_hash IS NULL AS no_hash FROM users WHERE role IN ('ADMIN','RECRUITER','CUSTOMER','CANDIDATE') ORDER BY user_id")
  console.log(JSON.stringify(users, null, 1))
  const [agreements] = await c.query('SELECT agreement_id, agreement_number, customer_id, title, status, effective_date, expiry_date, signed_date FROM agreements ORDER BY agreement_id')
  console.log('\nAGREEMENTS:')
  console.log(JSON.stringify(agreements, null, 1))
  const [invoices] = await c.query('SELECT invoice_id, invoice_number, service_order_id, invoice_date, due_date, subtotal, tax_total, total_amount, status FROM invoices ORDER BY invoice_id')
  console.log('\nINVOICES:')
  console.log(JSON.stringify(invoices, null, 1))
  await c.end()
})().catch((e) => console.error('ERR', e.message))
