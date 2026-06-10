export type LoanStatus = 'active' | 'paid'

export interface Loan {
  id: string
  borrowerName: string
  borrowerPhone: string
  currencyCode: string
  originalAmount: number
  amountInBase: number
  balance: number
  balanceInBase: number
  status: LoanStatus
  notes?: string
  createdAt: string
  updatedAt?: string
  createdBy: string
  createdByName?: string
}

export interface LoanPayment {
  id: string
  loanId: string
  borrowerPhone: string
  amount: number
  currencyCode: string
  amountInBase: number
  methodName: string
  reference?: string
  createdAt: string
  createdBy: string
  createdByName?: string
}

export interface LoanBorrowerAccount {
  borrowerKey: string
  borrowerName: string
  borrowerPhone: string
  balanceInBase: number
  activeLoanCount: number
  lastActivityAt: string
}

export interface CreateLoanInput {
  borrowerName: string
  borrowerPhone: string
  amount: number
  currencyCode: string
  amountInBase: number
  notes?: string
}

export interface CreateLoanPaymentInput {
  loanId: string
  amount: number
  currencyCode: string
  amountInBase: number
  methodName: string
  reference?: string
}

export type LoanHistoryEntry =
  | {
      id: string
      kind: 'loan'
      date: string
      loanId: string
      amount: number
      amountInBase: number
      balanceInBase: number
      status: LoanStatus
      notes?: string
      currencyCode: string
    }
  | {
      id: string
      kind: 'payment'
      date: string
      loanId: string
      amount: number
      amountInBase: number
      methodName: string
      reference?: string
      createdByName?: string
      currencyCode: string
    }
