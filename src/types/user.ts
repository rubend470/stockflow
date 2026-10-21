import { getDefaultMenuPermissionsForRole, resolveUserMenuPermissions } from '../utils/menuPermissions'

export type UserRole = 'super_admin' | 'admin' | 'cashier'

export interface AppUser {
  uid: string
  name: string
  email: string
  role: UserRole
  active: boolean
  menuPermissions?: string[]
  businessIds?: string[]
  currentBusinessId?: string
  presence?: UserPresence
  createdAt: string
}

export interface UserPresence {
  state: 'online' | 'offline'
  lastSeenAt: string
  activePath?: string
}

export interface UserFormInput {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: UserRole
  active: boolean
  menuPermissions: string[]
}

export const emptyUserForm = (): UserFormInput => ({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'cashier',
  active: true,
  menuPermissions: getDefaultMenuPermissionsForRole('cashier'),
})

export function userFormFromUser(user: AppUser): UserFormInput {
  return {
    name: user.name,
    email: user.email,
    password: '',
    confirmPassword: '',
    role: user.role,
    active: user.active,
    menuPermissions: resolveUserMenuPermissions(user),
  }
}
