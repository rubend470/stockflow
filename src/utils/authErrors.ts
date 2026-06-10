import type { FirebaseError } from 'firebase/app'

const messages: Record<string, string> = {
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/user-disabled': 'Esta cuenta ha sido deshabilitada.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Intenta más tarde.',
  'auth/network-request-failed': 'Error de conexión. Revisa tu internet.',
}

export function getAuthErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as FirebaseError).code
    if (messages[code]) return messages[code]
  }

  return 'Ocurrió un error. Intenta de nuevo.'
}
