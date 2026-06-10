export type UserRole = 'super_admin' | 'admin' | 'cashier'

export interface AppUser {
  uid: string
  name: string
  email: string
  role: UserRole
  active: boolean
  createdAt: string
}

export interface UserFormInput {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: UserRole
  active: boolean
}

export const emptyUserForm = (): UserFormInput => ({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'cashier',
  active: true,
})

export function userFormFromUser(user: AppUser): UserFormInput {
  return {
    name: user.name,
    email: user.email,
    password: '',
    confirmPassword: '',
    role: user.role,
    active: user.active,
  }
}
