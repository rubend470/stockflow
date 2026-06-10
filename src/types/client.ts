export interface Client {
  id: string
  name: string
  phone?: string
  email?: string
  documentId?: string
  creditLimit: number
  balance: number
  active: boolean
  createdAt: string
  updatedAt?: string
}

export interface ClientFormInput {
  name: string
  phone: string
  email: string
  documentId: string
  creditLimit: number
  active: boolean
}

export const emptyClientForm = (): ClientFormInput => ({
  name: '',
  phone: '',
  email: '',
  documentId: '',
  creditLimit: 0,
  active: true,
})

export function clientFormFromClient(client: Client): ClientFormInput {
  return {
    name: client.name,
    phone: client.phone ?? '',
    email: client.email ?? '',
    documentId: client.documentId ?? '',
    creditLimit: client.creditLimit,
    active: client.active,
  }
}
