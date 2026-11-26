import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateInvoiceTotals } from '../src/admin/invoice-calculation.js'

test('calculates tax and total with currency precision', () => {
  assert.deepEqual(calculateInvoiceTotals('1000.00', '18'), {
    subtotal: '1000.00',
    taxTotal: '180.00',
    total: '1180.00',
  })
})

test('rounds tax to the nearest cent', () => {
  assert.deepEqual(calculateInvoiceTotals('1.01', '0.5'), {
    subtotal: '1.01',
    taxTotal: '0.01',
    total: '1.02',
  })
})

test('rejects amounts with more than two decimal places', () => {
  assert.throws(() => calculateInvoiceTotals('10.001', '0'), {
    statusCode: 400,
    message: 'Placement fee can have no more than two decimal places.',
  })
})

test('rejects tax rates outside the supported range', () => {
  assert.throws(() => calculateInvoiceTotals('10', '100.01'), {
    statusCode: 400,
    message: 'Tax rate must be from 0 to 100 with no more than two decimal places.',
  })
})
