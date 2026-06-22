import type { StockInputMode } from '../utils/productUnits'

export type PurchaseInvoiceStatus = 'pending' | 'received' | 'partial' | 'paid' | 'cancelled'
export type PurchaseInvoiceLineType = 'product' | 'category'

export interface PurchaseInvoiceLine {
  productId: string
  stockCategoryId?: string
  description: string
  quantity: number
  unitLabel: string
  unitCost: number
  unitCostInBase: number
  lineTotal: number
  receivedAsBundles?: boolean
  bundleCount?: number
  bundleUnitCost?: number
  unitsPerBundle?: number
}

export interface PurchaseInvoice {
  id: string
  number: string
  supplierId?: string
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
  invoiceDate?: string
  expectedDate?: string
  lines: PurchaseInvoiceLine[]
  createdAt: string
  updatedAt?: string
  receivedAt?: string
}

export interface PurchaseInvoiceLineInput {
  lineType: PurchaseInvoiceLineType
  productId: string
  stockCategoryId: string
  description: string
  isNewProduct: boolean
  receiveMode: StockInputMode
  inputQuantity: number
  unitLabel: string
  unitCost: number
  bundleCost: number
}

export interface CreatePurchaseInvoiceInput {
  supplierId?: string
  supplierName: string
  supplierInvoiceNumber?: string
  currencyCode: string
  notes?: string
  invoiceDate?: string
  amountPaid?: number
  lines: PurchaseInvoiceLineInput[]
}

export interface UpdatePurchaseInvoiceInput {
  supplierId?: string
  supplierName: string
  supplierInvoiceNumber?: string
  notes?: string
  invoiceDate: string
  lines: PurchaseInvoiceLineInput[]
}

export interface CreatePurchaseInvoiceResult {
  id: string
  number: string
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
    lineType: 'product',
    productId: '',
    stockCategoryId: '',
    description: '',
    isNewProduct: false,
    receiveMode: 'units',
    inputQuantity: 0,
    unitLabel: 'und',
    unitCost: 0,
    bundleCost: 0,
  }
}
