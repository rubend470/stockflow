import type { SaleMode, SoldBy } from './product'

export type { SaleMode }

export interface CartItem {
  key: string
  productId: string
  productName: string
  barcode?: string
  saleMode: SaleMode
  soldBy: SoldBy
  unitLabel: string
  unitsPerBundle?: number
  quantity: number
  stockQuantity: number
  unitCost: number
  unitPrice: number
  lineCost: number
  lineRevenue: number
  lineProfit: number
  stockAvailable: number
  stockCategoryId?: string
  stockCategoryName?: string
}

export interface SalePaymentInput {
  methodId: string
  methodName: string
  currencyCode: string
  amount: number
  amountInBase: number
  reference?: string
  isCredit?: boolean
  clientId?: string
  clientName?: string
}

export interface CreateSaleInput {
  cashierId: string
  cashierName: string
  cashSessionId?: string
  clientId?: string
  clientName?: string
  baseCurrency: string
  exchangeRateSnapshot: Record<string, number>
  items: CartItem[]
  payments: SalePaymentInput[]
  canViewProfit: boolean
}

export interface SaleResult {
  saleId: string
  saleNumber: string
  total: number
  profitTotal: number
}

export interface Sale {
  id: string
  number: string
  status: string
  cashierId: string
  cashierName: string
  cashSessionId?: string
  clientId?: string
  clientName?: string
  subtotal: number
  discount: number
  tax: number
  total: number
  baseCurrency: string
  exchangeRateSnapshot: Record<string, number>
  profitTotal: number | null
  paymentStatus: string
  cashPaid?: number
  creditPaid?: number
  createdAt: string
}

export interface SaleItem {
  id: string
  productId: string
  productName: string
  barcode?: string
  soldBy: SoldBy
  saleMode: SaleMode
  quantity: number
  unit: string
  unitsPerBundle?: number
  stockQuantity: number
  unitCost: number
  unitPrice: number
  lineCost: number
  lineRevenue: number
  lineProfit: number
}

export interface SalePayment {
  id: string
  methodId: string
  methodName: string
  currencyCode: string
  amount: number
  amountInBase: number
  reference?: string
  isCredit?: boolean
  isDebtCollection?: boolean
  debtPaymentId?: string
  clientId?: string
  clientName?: string
  createdAt?: string
}
