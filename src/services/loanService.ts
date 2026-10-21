import {
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import type {
  CreateLoanInput,
  CreateLoanPaymentInput,
  Loan,
  LoanBorrowerAccount,
  LoanHistoryEntry,
  LoanPayment,
} from '../types/loan'
import { borrowerKey } from '../utils/phone'
import { roundMoney } from '../utils/formatMoney'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return new Date().toISOString()
}

function mapLoan(id: string, data: Record<string, unknown>): Loan {
  return {
    id,
    borrowerName: String(data.borrowerName ?? ''),
    borrowerPhone: String(data.borrowerPhone ?? ''),
    currencyCode: String(data.currencyCode ?? 'COP'),
    originalAmount: Number(data.originalAmount ?? 0),
    amountInBase: Number(data.amountInBase ?? 0),
    balance: Number(data.balance ?? data.originalAmount ?? 0),
    balanceInBase: Number(data.balanceInBase ?? data.amountInBase ?? 0),
    status: (data.status as Loan['status']) ?? 'active',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: data.updatedAt ? mapTimestamp(data.updatedAt) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

function mapLoanPayment(id: string, data: Record<string, unknown>): LoanPayment {
  return {
    id,
    loanId: String(data.loanId ?? ''),
    borrowerPhone: String(data.borrowerPhone ?? ''),
    amount: Number(data.amount ?? 0),
    currencyCode: String(data.currencyCode ?? 'COP'),
    amountInBase: Number(data.amountInBase ?? 0),
    methodName: String(data.methodName ?? ''),
    reference: data.reference ? String(data.reference) : undefined,
    createdAt: mapTimestamp(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

export async function listLoans(): Promise<Loan[]> {
  const snapshot = await getDocs(tenantCollectionRef('loans'))
  return snapshot.docs
    .map((item) => mapLoan(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listActiveLoans(): Promise<Loan[]> {
  return (await listLoans()).filter((loan) => loan.status === 'active' && loan.balanceInBase > 0)
}

export async function createLoan(input: CreateLoanInput, userId: string, userName: string) {
  const name = input.borrowerName.trim()
  const phone = input.borrowerPhone.trim()

  if (!name) throw new Error('El nombre del prestatario es obligatorio.')
  if (!phone) throw new Error('El teléfono es obligatorio.')
  if (input.amount <= 0 || input.amountInBase <= 0) {
    throw new Error('El monto del préstamo debe ser mayor a cero.')
  }

  const batch = writeBatch(db)
  const loanRef = doc(tenantCollectionRef('loans'))

  batch.set(loanRef, {
    borrowerName: name,
    borrowerPhone: phone,
    currencyCode: input.currencyCode,
    originalAmount: input.amount,
    amountInBase: input.amountInBase,
    balance: input.amount,
    balanceInBase: input.amountInBase,
    status: 'active',
    notes: input.notes?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  await batch.commit()
  return loanRef.id
}

export async function recordBorrowerLoanPayment(
  borrowerPhone: string,
  borrowerName: string,
  input: Omit<CreateLoanPaymentInput, 'loanId'>,
  userId: string,
  userName: string,
) {
  if (input.amount <= 0 || input.amountInBase <= 0) {
    throw new Error('El monto del abono debe ser mayor a cero.')
  }

  const activeLoans = (await listLoansByBorrower(borrowerPhone, borrowerName))
    .filter((loan) => loan.status === 'active' && loan.balanceInBase > 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (activeLoans.length === 0) {
    throw new Error('Este prestatario no tiene préstamos activos.')
  }

  const totalOwed = activeLoans.reduce((sum, loan) => sum + loan.balanceInBase, 0)
  if (input.amountInBase > totalOwed + 0.01) {
    throw new Error('El abono supera el saldo pendiente del prestatario.')
  }

  let remaining = input.amountInBase
  const batch = writeBatch(db)

  for (const loan of activeLoans) {
    if (remaining <= 0.001) break

    const payInBase = roundMoney(Math.min(remaining, loan.balanceInBase))
    const ratio = loan.balanceInBase > 0 ? loan.balance / loan.balanceInBase : 1
    const payAmount = roundMoney(payInBase * ratio)
    const newBalanceInBase = roundMoney(loan.balanceInBase - payInBase)
    const newBalance = roundMoney(newBalanceInBase * ratio)

    const paymentRef = doc(tenantCollectionRef('loan_payments'))
    batch.set(paymentRef, {
      loanId: loan.id,
      borrowerPhone: loan.borrowerPhone,
      amount: payAmount,
      currencyCode: input.currencyCode,
      amountInBase: payInBase,
      methodName: input.methodName,
      reference: input.reference?.trim() || null,
      createdAt: serverTimestamp(),
      createdBy: userId,
      createdByName: userName,
    })

    batch.update(tenantDocumentRef('loans', loan.id), {
      balance: newBalance,
      balanceInBase: newBalanceInBase,
      status: newBalanceInBase <= 0.01 ? 'paid' : 'active',
      updatedAt: serverTimestamp(),
    })

    remaining = roundMoney(remaining - payInBase)
  }

  await batch.commit()
}

export async function recordLoanPayment(
  input: CreateLoanPaymentInput,
  userId: string,
  userName: string,
) {
  if (input.amount <= 0 || input.amountInBase <= 0) {
    throw new Error('El monto del abono debe ser mayor a cero.')
  }

  const snapshot = await getDocs(tenantCollectionRef('loans'))
  const loanDoc = snapshot.docs.find((item) => item.id === input.loanId)
  if (!loanDoc) throw new Error('Préstamo no encontrado.')

  const loan = mapLoan(loanDoc.id, loanDoc.data())
  if (input.amountInBase > loan.balanceInBase + 0.01) {
    throw new Error('El abono supera el saldo pendiente del préstamo.')
  }

  const newBalanceInBase = roundMoney(loan.balanceInBase - input.amountInBase)
  const ratio = loan.balanceInBase > 0 ? loan.balance / loan.balanceInBase : 1
  const newBalance = roundMoney(newBalanceInBase * ratio)

  const batch = writeBatch(db)
  const paymentRef = doc(tenantCollectionRef('loan_payments'))

  batch.set(paymentRef, {
    loanId: loan.id,
    borrowerPhone: loan.borrowerPhone,
    amount: input.amount,
    currencyCode: input.currencyCode,
    amountInBase: input.amountInBase,
    methodName: input.methodName,
    reference: input.reference?.trim() || null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(tenantDocumentRef('loans', loan.id), {
    balance: newBalance,
    balanceInBase: newBalanceInBase,
    status: newBalanceInBase <= 0.01 ? 'paid' : 'active',
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  return paymentRef.id
}

export async function listLoanPayments(loanId: string): Promise<LoanPayment[]> {
  const snapshot = await getDocs(tenantCollectionRef('loan_payments'))
  return snapshot.docs
    .map((item) => mapLoanPayment(item.id, item.data()))
    .filter((payment) => payment.loanId === loanId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listLoanPaymentsByBorrower(phone: string): Promise<LoanPayment[]> {
  const key = borrowerKey('', phone)
  const snapshot = await getDocs(tenantCollectionRef('loan_payments'))

  return snapshot.docs
    .map((item) => mapLoanPayment(item.id, item.data()))
    .filter((payment) => borrowerKey('', payment.borrowerPhone) === key)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listLoansByBorrower(phone: string, name: string): Promise<Loan[]> {
  const key = borrowerKey(name, phone)
  return (await listLoans()).filter(
    (loan) => borrowerKey(loan.borrowerName, loan.borrowerPhone) === key,
  )
}

export function listFrequentBorrowers(loans: Loan[], limit = 10): LoanBorrowerAccount[] {
  const accounts = new Map<string, LoanBorrowerAccount>()

  loans.forEach((loan) => {
    const key = borrowerKey(loan.borrowerName, loan.borrowerPhone)
    const current = accounts.get(key) ?? {
      borrowerKey: key,
      borrowerName: loan.borrowerName,
      borrowerPhone: loan.borrowerPhone,
      balanceInBase: 0,
      activeLoanCount: 0,
      lastActivityAt: loan.createdAt,
    }

    if (loan.status === 'active' && loan.balanceInBase > 0) {
      current.balanceInBase = roundMoney(current.balanceInBase + loan.balanceInBase)
      current.activeLoanCount += 1
    }

    const activityDate = loan.updatedAt ?? loan.createdAt
    if (activityDate.localeCompare(current.lastActivityAt) > 0) {
      current.lastActivityAt = activityDate
    }

    accounts.set(key, current)
  })

  return Array.from(accounts.values())
    .sort(
      (a, b) =>
        b.lastActivityAt.localeCompare(a.lastActivityAt) ||
        a.borrowerName.localeCompare(b.borrowerName, 'es'),
    )
    .slice(0, limit)
}

export function groupLoansByBorrower(loans: Loan[]): LoanBorrowerAccount[] {
  const accounts = new Map<string, LoanBorrowerAccount>()

  loans.forEach((loan) => {
    const key = borrowerKey(loan.borrowerName, loan.borrowerPhone)
    const current = accounts.get(key) ?? {
      borrowerKey: key,
      borrowerName: loan.borrowerName,
      borrowerPhone: loan.borrowerPhone,
      balanceInBase: 0,
      activeLoanCount: 0,
      lastActivityAt: loan.createdAt,
    }

    if (loan.status === 'active' && loan.balanceInBase > 0) {
      current.balanceInBase = roundMoney(current.balanceInBase + loan.balanceInBase)
      current.activeLoanCount += 1
    }

    const activityDate = loan.updatedAt ?? loan.createdAt
    if (activityDate.localeCompare(current.lastActivityAt) > 0) {
      current.lastActivityAt = activityDate
    }

    accounts.set(key, current)
  })

  return Array.from(accounts.values())
    .filter((account) => account.balanceInBase > 0)
    .sort(
      (a, b) =>
        b.balanceInBase - a.balanceInBase ||
        a.borrowerName.localeCompare(b.borrowerName, 'es'),
    )
}

export function buildLoanHistory(loans: Loan[], payments: LoanPayment[]): LoanHistoryEntry[] {
  const loanEntries: LoanHistoryEntry[] = loans.map((loan) => ({
    id: `loan-${loan.id}`,
    kind: 'loan',
    date: loan.createdAt,
    loanId: loan.id,
    amount: loan.originalAmount,
    amountInBase: loan.amountInBase,
    balanceInBase: loan.balanceInBase,
    status: loan.status,
    notes: loan.notes,
    currencyCode: loan.currencyCode,
  }))

  const paymentEntries: LoanHistoryEntry[] = payments.map((payment) => ({
    id: `payment-${payment.id}`,
    kind: 'payment',
    date: payment.createdAt,
    loanId: payment.loanId,
    amount: payment.amount,
    amountInBase: payment.amountInBase,
    methodName: payment.methodName,
    reference: payment.reference,
    createdByName: payment.createdByName,
    currencyCode: payment.currencyCode,
  }))

  return [...loanEntries, ...paymentEntries].sort((a, b) => b.date.localeCompare(a.date))
}
