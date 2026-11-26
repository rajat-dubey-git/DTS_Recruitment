function invalid(message) {
  return Object.assign(new Error(message), { statusCode: 400 })
}

function moneyCents(value, label) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > 9999999999.99) {
    throw invalid(`${label} must be from 0 to 9,999,999,999.99.`)
  }
  const cents = Math.round(amount * 100)
  if (Math.abs(amount * 100 - cents) > 0.000001) {
    throw invalid(`${label} can have no more than two decimal places.`)
  }
  return cents
}

export function calculateInvoiceTotals(unitPriceValue, taxRateValue) {
  const subtotalCents = moneyCents(unitPriceValue, 'Placement fee')
  const taxRate = Number(taxRateValue)
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100
    || Math.round(taxRate * 100) / 100 !== taxRate) {
    throw invalid('Tax rate must be from 0 to 100 with no more than two decimal places.')
  }

  const taxRateBasisPoints = Math.round(taxRate * 100)
  const taxCents = Math.round(subtotalCents * taxRateBasisPoints / 10000)
  const totalCents = subtotalCents + taxCents
  return {
    subtotal: (subtotalCents / 100).toFixed(2),
    taxTotal: (taxCents / 100).toFixed(2),
    total: (totalCents / 100).toFixed(2),
  }
}
