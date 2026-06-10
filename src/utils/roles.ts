export const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  cashier: 'Cajero',
}

export const roleOptions = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Administrador' },
  { value: 'cashier', label: 'Cajero' },
] as const
