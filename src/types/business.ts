export type BusinessStatus = 'active' | 'inactive'

export interface Business {
  id: string
  name: string
  status: BusinessStatus
  createdAt: string
  updatedAt?: string
}

export interface BusinessMembership {
  businessId: string
  active: boolean
  joinedAt?: string
}
