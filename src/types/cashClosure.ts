import type { CurrencyCashTotal } from '../utils/salePayments'

export interface CashClosureSaleLine {
  saleId: string
  saleNumber: string
  createdAt: string
  clientName?: string
  cashierName: string
  total: number
  cashPaid: number
  creditPaid: number
}

export interface CashClosureLoanLine {
  id: string
  createdAt: string
  borrowerName: string
  borrowerPhone: string
  currencyCode: string
  amount: number
  amountInBase: number
  notes?: string
}

export interface CashClosurePaymentLine {
  id: string
  source: 'sale' | 'debt' | 'loan'
  reference: string
  createdAt: string
  methodName: string
  currencyCode: string
  amount: number
  amountInBase: number
  clientName?: string
  isCredit?: boolean
}

export interface CashClosureExchangeLine {
  id: string
  createdAt: string
  cashInCurrency: string
  cashInAmount: number
  cashInMethodName: string
  cashInReference?: string
  cashOutCurrency: string
  cashOutAmount: number
  cashOutMethodName: string
  cashOutReference?: string
  fromCurrency: string
  toCurrency: string
  fromAmount: number
  toAmount: number
  rateLabel: string
  amountInBase: number
  clientName?: string
  createdByName: string
}

export interface CashClosureMethodTotal {
  methodName: string
  currencyCode: string
  amount: number
  amountInBase: number
}

export interface CashClosureReport {
  closureDate: string
  salesCount: number
  totalSoldInBase: number
  cashInSalesInBase: number
  creditSalesInBase: number
  debtCollectionsInBase: number
  loansGivenInBase: number
  loanRepaymentsInBase: number
  exchangesCount: number
  exchangesVolumeInBase: number
  totalCashInBase: number
  sales: CashClosureSaleLine[]
  payments: CashClosurePaymentLine[]
  loansGiven: CashClosureLoanLine[]
  exchanges: CashClosureExchangeLine[]
  cashByCurrency: CurrencyCashTotal[]
  netByCurrency: Array<{
    currencyCode: string
    cashIn: number
    cashOut: number
    net: number
  }>
  byMethod: CashClosureMethodTotal[]
}

export interface CashClosure {
  id: string
  closureDate: string
  report: CashClosureReport
  createdAt: string
  createdBy: string
  createdByName: string
}
