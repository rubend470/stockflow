export type UserRole = 'super_admin' | 'admin' | 'cashier'

export interface AppUser {
  uid: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
}
