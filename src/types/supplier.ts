export interface Supplier {
  id: string
  name: string
  phone?: string
  email?: string
  taxId?: string
  notes?: string
  active: boolean
  createdAt: string
  updatedAt?: string
}

export interface SupplierFormInput {
  name: string
  phone: string
  email: string
  taxId: string
  notes: string
  active: boolean
}

export const emptySupplierForm = (): SupplierFormInput => ({
  name: '',
  phone: '',
  email: '',
  taxId: '',
  notes: '',
  active: true,
})

export function supplierFormFromSupplier(supplier: Supplier): SupplierFormInput {
  return {
    name: supplier.name,
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    taxId: supplier.taxId ?? '',
    notes: supplier.notes ?? '',
    active: supplier.active,
  }
}
