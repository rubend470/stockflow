/**
 * Firestore rejects `undefined` anywhere in document data.
 * Recursively omits undefined properties while preserving null and other values.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) {
    return value
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T
  }

  const result: Record<string, unknown> = {}

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    if (entry !== undefined) {
      result[key] = stripUndefinedDeep(entry)
    }
  })

  return result as T
}
