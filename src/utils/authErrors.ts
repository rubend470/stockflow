import type { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use':
    'Ya existe una cuenta con ese correo. Usa otro correo o restablece la contraseña.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
  'auth/network-request-failed': 'Error de conexión. Revisa tu internet.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as FirebaseError).code
    if (messages[code]) return messages[code]
  }

  if (error instanceof Error) {
    const match = error.message.match(/\((auth\/[^)]+)\)/)
    if (match && messages[match[1]]) return messages[match[1]]
  }

  return 'Ocurrió un error. Intenta de nuevo.'
}

export function formatAppError(error: unknown, fallback = 'Ocurrió un error. Intenta de nuevo.'): string {
  const authMessage = getAuthErrorMessage(error)
  if (authMessage !== 'Ocurrió un error. Intenta de nuevo.') {
    return authMessage
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}
