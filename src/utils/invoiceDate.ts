export function todayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function invoiceDateFromIso(iso: string) {
  if (!iso) return todayInputValue()

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return todayInputValue()

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatInvoiceListDate(invoice: { invoiceDate?: string; createdAt: string }) {
  if (invoice.invoiceDate) {
    const [year, month, day] = invoice.invoiceDate.split('-').map(Number)
    return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(
      new Date(year, month - 1, day),
    )
  }

  if (!invoice.createdAt) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(invoice.createdAt))
}

export function invoiceDateToDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}
