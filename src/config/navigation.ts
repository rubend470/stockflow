import type { UserRole } from '../types/user'

export interface NavItem {
  id: string
  label: string
  path?: string
  icon: string
  roles?: UserRole[]
  children?: NavItem[]
}

export const navigation: NavItem[] = [
  {
    id: 'home',
    label: 'Inicio',
    path: '/',
    icon: 'home',
  },
  {
    id: 'sales',
    label: 'Ventas y caja',
    icon: 'sales',
    children: [
      { id: 'pos', label: 'Venta', path: '/ventas/pos', icon: 'pos' },
      { id: 'currency-exchange', label: 'Cambio de moneda', path: '/finanzas/cambio', icon: 'currency' },
      { id: 'client-debts', label: 'Deudas y créditos', path: '/clientes/deudas', icon: 'clients' },
      { id: 'sales-history', label: 'Historial de ventas', path: '/ventas/historial', icon: 'invoice' },
      { id: 'cash-closing', label: 'Cierre de caja', path: '/ventas/cierre', icon: 'invoice' },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventario',
    icon: 'inventory',
    children: [
      { id: 'products', label: 'Productos', path: '/inventario/productos', icon: 'products' },
      { id: 'categories', label: 'Categorías', path: '/inventario/categorias', icon: 'products', roles: ['super_admin', 'admin'] },
      { id: 'add-product', label: 'Ingresar producto', path: '/inventario/productos/nuevo', icon: 'products', roles: ['super_admin', 'admin'] },
      { id: 'stock', label: 'Stock actual', path: '/inventario/stock', icon: 'stock' },
      { id: 'movements', label: 'Entradas y salidas', path: '/inventario/movimientos', icon: 'movements' },
      {
        id: 'pending-invoices',
        label: 'Entradas de mercancía',
        path: '/ventas/facturas-pendientes',
        icon: 'invoice',
        roles: ['super_admin', 'admin'],
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finanzas',
    icon: 'finance',
    roles: ['super_admin', 'admin'],
    children: [
      { id: 'currencies', label: 'Monedas y tasas', path: '/finanzas/monedas', icon: 'currency', roles: ['super_admin', 'admin'] },
      { id: 'payments', label: 'Formas de pago', path: '/finanzas/pagos', icon: 'payments', roles: ['super_admin', 'admin'] },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    path: '/reportes',
    icon: 'reports',
  },
  {
    id: 'admin',
    label: 'Administración',
    icon: 'admin',
    roles: ['super_admin', 'admin'],
    children: [
      { id: 'users', label: 'Usuarios', path: '/admin/usuarios', icon: 'users', roles: ['super_admin'] },
      { id: 'settings', label: 'Configuración', path: '/admin/configuracion', icon: 'settings', roles: ['super_admin', 'admin'] },
    ],
  },
]

export function filterNavigation(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: item.children ? filterNavigation(item.children, role) : undefined,
    }))
    .filter((item) => item.path || (item.children && item.children.length > 0))
}
