export type KeyboardShortcutAction =
  | 'focus-search'
  | 'new-sale'
  | 'quick-product'
  | 'exact-payment'
  | 'add-mixed-payment'
  | 'toggle-mixed-payment'
  | 'remove-last-payment'
  | 'clear-search'
  | 'clear-cart'
  | 'sync-offline'
  | 'confirm-sale'

export interface KeyboardShortcut {
  id: KeyboardShortcutAction
  label: string
  keys: string
  active: boolean
  updatedAt?: string
}

export interface KeyboardShortcutFormInput {
  keys: string
  active: boolean
}

export const defaultKeyboardShortcuts: KeyboardShortcut[] = [
  { id: 'focus-search', label: 'Buscar producto', keys: 'Ctrl+K', active: true },
  { id: 'new-sale', label: 'Nueva venta', keys: 'Ctrl+N', active: true },
  { id: 'quick-product', label: 'Producto rápido', keys: 'Ctrl+R', active: true },
  { id: 'exact-payment', label: 'Pago exacto', keys: 'Ctrl+M', active: true },
  { id: 'add-mixed-payment', label: 'Agregar pago mixto', keys: 'Ctrl+Enter', active: true },
  { id: 'toggle-mixed-payment', label: 'Activar pago mixto', keys: 'Ctrl+B', active: true },
  { id: 'remove-last-payment', label: 'Quitar último pago', keys: 'Ctrl+Backspace', active: true },
  { id: 'clear-search', label: 'Limpiar búsqueda', keys: 'Ctrl+L', active: true },
  { id: 'clear-cart', label: 'Vaciar carrito', keys: 'Ctrl+Delete', active: true },
  { id: 'sync-offline', label: 'Sincronizar offline', keys: 'Ctrl+U', active: true },
  { id: 'confirm-sale', label: 'Confirmar venta', keys: 'Ctrl+S', active: true },
]
