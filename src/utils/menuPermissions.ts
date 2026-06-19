import { navigation, type NavItem } from '../config/navigation'
import type { AppUser, UserRole } from '../types/user'

export interface MenuPermissionOption {
  id: string
  label: string
  group: string
}

const routePermissionEntries: Array<[string, string]> = [
  ['/', 'home'],
  ['/ventas/pos', 'pos'],
  ['/finanzas/cambio', 'currency-exchange'],
  ['/clientes/deudas', 'client-debts'],
  ['/clientes/directorio', 'client-debts'],
  ['/ventas/historial', 'sales-history'],
  ['/ventas/cierre', 'cash-closing'],
  ['/reportes', 'reports'],
  ['/inventario/productos', 'products'],
  ['/inventario/productos/nuevo', 'add-product'],
  ['/inventario/categorias', 'categories'],
  ['/inventario/stock', 'products'],
  ['/inventario/movimientos', 'products'],
  ['/ventas/facturas-pendientes', 'pending-invoices'],
  ['/inventario/proveedores', 'suppliers'],
  ['/finanzas/gastos', 'expenses'],
  ['/finanzas/monedas', 'currencies'],
  ['/finanzas/pagos', 'payments'],
  ['/admin/usuarios', 'users'],
  ['/admin/configuracion', 'settings'],
]

export const routePermissionMap = Object.fromEntries(routePermissionEntries) as Record<string, string>

function itemAllowedByRole(item: NavItem, role: UserRole) {
  return !item.roles || item.roles.includes(role)
}

export function listMenuPermissionOptions(): MenuPermissionOption[] {
  const options: MenuPermissionOption[] = []

  navigation.forEach((item) => {
    if (item.path) {
      options.push({ id: item.id, label: item.label, group: 'General' })
      return
    }

    item.children?.forEach((child) => {
      if (!child.path) return
      options.push({
        id: child.id,
        label: child.label,
        group: item.label,
      })
    })
  })

  return options
}

export function getAllMenuPermissionIds(): string[] {
  return listMenuPermissionOptions().map((option) => option.id)
}

export function getDefaultMenuPermissionsForRole(role: UserRole): string[] {
  if (role === 'cashier') {
    return ['home', 'pos', 'currency-exchange', 'client-debts', 'sales-history']
  }

  const allowed = new Set<string>()

  navigation.forEach((item) => {
    if (item.path) {
      if (itemAllowedByRole(item, role)) allowed.add(item.id)
      return
    }

    if (!itemAllowedByRole(item, role)) return

    item.children?.forEach((child) => {
      if (child.path && itemAllowedByRole(child, role)) {
        allowed.add(child.id)
      }
    })
  })

  return [...allowed]
}

export function resolveUserMenuPermissions(user: Pick<AppUser, 'role' | 'menuPermissions'>): string[] {
  if (user.role === 'super_admin') {
    return getAllMenuPermissionIds()
  }

  if (user.menuPermissions?.length) {
    const valid = new Set(getAllMenuPermissionIds())
    return user.menuPermissions.filter((id) => valid.has(id))
  }

  return getDefaultMenuPermissionsForRole(user.role)
}

export function userHasMenuPermission(
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
  permissionId: string,
) {
  if (!user) return false
  if (user.role === 'super_admin') return true
  return resolveUserMenuPermissions(user).includes(permissionId)
}

export function filterNavigationForUser(
  items: NavItem[],
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
): NavItem[] {
  if (!user) return []
  if (user.role === 'super_admin') return items

  const allowed = new Set(resolveUserMenuPermissions(user))

  return items
    .map((item) => {
      if (item.children?.length) {
        const children = item.children.filter((child) => allowed.has(child.id))
        if (children.length === 0) return null
        return { ...item, children }
      }

      if (item.path && allowed.has(item.id)) return item
      return null
    })
    .filter((item): item is NavItem => item !== null)
}

export function getPermissionIdForPath(pathname: string): string | null {
  if (routePermissionMap[pathname]) {
    return routePermissionMap[pathname]
  }

  const match = routePermissionEntries
    .filter(([path]) => path !== '/')
    .sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => pathname.startsWith(`${path}/`) || pathname === path)

  return match?.[1] ?? null
}

export function userCanAccessPath(
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
  pathname: string,
) {
  if (!user) return false
  if (user.role === 'super_admin') return true

  const permissionId = getPermissionIdForPath(pathname)
  if (!permissionId) return true

  return userHasMenuPermission(user, permissionId)
}

export function userHasAnyMenuPermission(
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
  permissionIds: string[],
) {
  return permissionIds.some((permissionId) => userHasMenuPermission(user, permissionId))
}

export function userCanViewProfit(
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
) {
  return userHasAnyMenuPermission(user, ['reports', 'expenses'])
}

export function userCanViewCost(
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
) {
  return userHasAnyMenuPermission(user, [
    'reports',
    'pending-invoices',
    'suppliers',
    'add-product',
    'categories',
  ])
}

export function getFirstAccessiblePath(
  user: Pick<AppUser, 'role' | 'menuPermissions'> | null | undefined,
): string {
  const items = filterNavigationForUser(navigation, user)

  for (const item of items) {
    if (item.path) return item.path
    const child = item.children?.find((entry) => entry.path)
    if (child?.path) return child.path
  }

  return '/'
}

export function normalizeMenuPermissions(ids: string[]): string[] {
  const valid = new Set(getAllMenuPermissionIds())
  return [...new Set(ids.filter((id) => valid.has(id)))]
}
