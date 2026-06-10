export type DebtStatus = 'active' | 'paid' | 'overdue'

export interface Debt {
  id: string
  clientId: string
  clientName: string
  saleId?: string
  originalAmount: number
  balance: number
  status: DebtStatus
  dueDate?: string
  notes?: string
  createdAt: string
  updatedAt?: string
}

export interface DebtPayment {
  id: string
  debtId: string
  clientId: string
  amount: number
  currencyCode: string
  amountInBase: number
  methodName: string
  reference?: string
  createdAt: string
  createdBy: string
  createdByName?: string
}

export interface CreateDebtInput {
  clientId: string
  originalAmount: number
  dueDate?: string
  notes?: string
}

export interface CreateDebtPaymentInput {
  debtId: string
  amount: number
  currencyCode: string
  amountInBase: number
  methodName: string
  reference?: string
}

export interface ClientDebtAccount {
  clientId: string
  clientName: string
  balance: number
  activeDebtCount: number
  lastActivityAt: string
}

export type DebtHistoryEntry =
  | {
      id: string
      kind: 'debt'
      date: string
      debtId: string
      amount: number
      balance: number
      status: DebtStatus
      notes?: string
      saleId?: string
    }
  | {
      id: string
      kind: 'payment'
      date: string
      debtId: string
      amount: number
      methodName: string
      reference?: string
      createdByName?: string
    }
