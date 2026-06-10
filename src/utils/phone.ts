export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

export function isValidPhone(phone: string) {
  const digits = normalizePhone(phone)
  return digits.length >= 7
}

export function borrowerKey(name: string, phone: string) {
  const digits = normalizePhone(phone)
  return digits || name.trim().toLowerCase()
}
