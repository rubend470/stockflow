export type PurchaseInvoiceStatus = 'pending' | 'received' | 'partial' | 'paid' | 'cancelled'

export interface PurchaseInvoiceLine {
  productId?: string
  description: string
  quantity: number
  unitLabel: string
  unitCost: number
  lineTotal: number
}

export interface PurchaseInvoice {
  id: string
  number: string
  supplierName: string
  status: PurchaseInvoiceStatus
  totalAmount: number
  amountPaid: number
  amountDue: number
  notes?: string
  expectedDate?: string
  lines: PurchaseInvoiceLine[]
  createdAt: string
  updatedAt?: string
}

export interface PurchaseInvoiceLineInput {
  productId?: string
  description: string
  quantity: number
  unitLabel: string
  unitCost: number
}

export interface CreatePurchaseInvoiceInput {
  supplierName: string
  notes?: string
  expectedDate?: string
  amountPaid?: number
  lines: PurchaseInvoiceLineInput[]
}

export const purchaseInvoiceStatusLabels: Record<PurchaseInvoiceStatus, string> = {
  pending: 'Pendiente de entrada',
  received: 'Recibida · por pagar',
  partial: 'Pago parcial',
  paid: 'Pagada',
  cancelled: 'Anulada',
}

export function emptyPurchaseInvoiceLine(): PurchaseInvoiceLineInput {
  return {
    productId: '',
    description: '',
    quantity: 1,
    unitLabel: 'und',
    unitCost: 0,
  }
}
