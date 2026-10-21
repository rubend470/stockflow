import {
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import {
  defaultKeyboardShortcuts,
  type KeyboardShortcut,
  type KeyboardShortcutAction,
  type KeyboardShortcutFormInput,
} from '../types/keyboardShortcut'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) return typed.toDate().toISOString()
  if (typeof typed === 'string') return typed
  return undefined
}

function normalizeKeys(value: string) {
  return value
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'control') return 'Ctrl'
      if (lower === 'cmd' || lower === 'meta') return 'Ctrl'
      if (lower === 'esc') return 'Escape'
      if (lower.length === 1) return lower.toUpperCase()
      return part[0].toUpperCase() + part.slice(1)
    })
    .join('+')
}

function mapShortcut(id: string, data: Record<string, unknown>): KeyboardShortcut | null {
  const fallback = defaultKeyboardShortcuts.find((shortcut) => shortcut.id === id)
  if (!fallback) return null
  return {
    id: fallback.id,
    label: fallback.label,
    keys: normalizeKeys(String(data.keys ?? fallback.keys)),
    active: data.active !== false,
    updatedAt: mapTimestamp(data.updatedAt),
  }
}

export async function listKeyboardShortcuts(): Promise<KeyboardShortcut[]> {
  const snapshot = await getDocs(tenantCollectionRef('keyboard_shortcuts'))
  const merged = new Map(defaultKeyboardShortcuts.map((shortcut) => [shortcut.id, shortcut]))
  snapshot.docs.forEach((item) => {
    const mapped = mapShortcut(item.id, item.data())
    if (mapped) merged.set(mapped.id, mapped)
  })
  return defaultKeyboardShortcuts.map((shortcut) => merged.get(shortcut.id) ?? shortcut)
}

export async function updateKeyboardShortcut(
  action: KeyboardShortcutAction,
  input: KeyboardShortcutFormInput,
) {
  const fallback = defaultKeyboardShortcuts.find((shortcut) => shortcut.id === action)
  if (!fallback) throw new Error('Acción de atajo no válida.')

  const keys = normalizeKeys(input.keys)
  if (!keys) throw new Error('Ingresa una combinación de teclas.')

  await setDoc(
    tenantDocumentRef('keyboard_shortcuts', action),
    {
      label: fallback.label,
      keys,
      active: input.active,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
