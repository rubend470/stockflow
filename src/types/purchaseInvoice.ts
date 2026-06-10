export type PurchaseInvoiceStatus = 'pending' | 'received' | 'partial' | 'paid' | 'cancelled'

export interface PurchaseInvoiceLine {
  productId: string
  description: string
  quantity: number
  unitLabel: string
  unitCost: number
  unitCostInBase: number
  lineTotal: number
}

export interface PurchaseInvoice {
  id: string
  number: string
  supplierName: string
  supplierInvoiceNumber?: string
  currencyCode: string
  amountInBase: number
  exchangeRateSnapshot: Record<string, number>
  status: PurchaseInvoiceStatus
  totalAmount: number
  amountPaid: number
  amountDue: number
  notes?: string
  expectedDate?: string
  lines: PurchaseInvoiceLine[]
  createdAt: string
  updatedAt?: string
  receivedAt?: string
}

export interface PurchaseInvoiceLineInput {
  productId: string
  description: string
  quantity: number
  unitLabel: string
  unitCost: number
}

export interface CreatePurchaseInvoiceInput {
  supplierName: string
  supplierInvoiceNumber?: string
  currencyCode: string
  notes?: string
  expectedDate?: string
  amountPaid?: number
  lines: PurchaseInvoiceLineInput[]
}

export interface ReceivedProductLine {
  productId: string
  productName: string
  unitLabel: string
  currencyCode: string
  previousSalePrice: number
  newCostPrice: number
}

export interface CreatePurchaseInvoiceResult {
  id: string
  number: string
  receivedLines: ReceivedProductLine[]
}

export interface SalePriceUpdateInput {
  productId: string
  salePrice: number
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
