export function normalizeBarcode(value: string | null | undefined) {
  return String(value ?? '').replace(/[\s\r\n\t]+/g, '').trim()
}

export function barcodeMatches(candidate: string | null | undefined, query: string) {
  const normalizedCandidate = normalizeBarcode(candidate)
  const normalizedQuery = normalizeBarcode(query)

  return Boolean(normalizedCandidate && normalizedQuery && normalizedCandidate === normalizedQuery)
}

export function isLikelyBarcode(value: string | null | undefined) {
  const normalized = normalizeBarcode(value)
  return normalized.length >= 4 && /^[A-Za-z0-9._-]+$/.test(normalized)
}
