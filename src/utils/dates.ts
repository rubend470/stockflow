export function todayDateInputValue(reference = new Date()) {
  const year = reference.getFullYear()
  const month = String(reference.getMonth() + 1).padStart(2, '0')
  const day = String(reference.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isOnLocalDate(isoDate: string, dateValue: string) {
  if (!isoDate || !dateValue) return false

  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return false

  const [year, month, day] = dateValue.split('-').map(Number)
  if (!year || !month || !day) return false

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() + 1 === month &&
    parsed.getDate() === day
  )
}

export function formatClosureDate(dateValue: string) {
  if (!dateValue) return '—'
  const parsed = new Date(`${dateValue}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return dateValue

  return new Intl.DateTimeFormat('es', {
    dateStyle: 'full',
  }).format(parsed)
}

export function formatDateTime(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
