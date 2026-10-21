import {
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import { db } from '../lib/firebase'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import { getClientById, updateClientBalance } from './clientService'
import type {
  ClientDebtAccount,
  CreateDebtInput,
  CreateDebtPaymentInput,
  Debt,
  DebtHistoryEntry,
  DebtPayment,
} from '../types/debt'

function mapDebt(id: string, data: Record<string, unknown>): Debt {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined
  const dueDate = data.dueDate as { toDate?: () => Date } | string | undefined

  const toIso = (value: typeof createdAt) =>
    typeof value === 'object' && value?.toDate
      ? value.toDate().toISOString()
      : typeof value === 'string'
        ? value
        : undefined

  return {
    id,
    clientId: String(data.clientId ?? ''),
    clientName: String(data.clientName ?? ''),
    saleId: data.saleId ? String(data.saleId) : undefined,
    originalAmount: Number(data.originalAmount ?? 0),
    balance: Number(data.balance ?? 0),
    status: (data.status as Debt['status']) ?? 'active',
    dueDate: toIso(dueDate),
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: toIso(createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(updatedAt),
  }
}

const DEBT_COLLECTION_METHOD_ID = 'debt_collection'

function computeSalePaymentStatus(cashPaid: number, creditPaid: number) {
  if (creditPaid > 0.01) {
    return cashPaid > 0.01 ? 'partial' : 'pending'
  }
  return 'paid'
}

async function loadSaleStatesForDebts(debts: Debt[]) {
  const saleIds = [
    ...new Set(debts.map((debt) => debt.saleId).filter((saleId): saleId is string => Boolean(saleId))),
  ]
  const saleStates = new Map<string, Record<string, unknown>>()

  await Promise.all(
    saleIds.map(async (saleId) => {
      const snapshot = await getDoc(tenantDocumentRef('sales', saleId))
      if (snapshot.exists()) {
        saleStates.set(saleId, snapshot.data())
      }
    }),
  )

  return saleStates
}

function applyDebtPaymentToLinkedSale(
  batch: WriteBatch,
  saleStates: Map<string, Record<string, unknown>>,
  debt: Debt,
  payAmount: number,
  paymentInput: {
    methodName: string
    currencyCode: string
    reference?: string
  },
  debtPaymentId: string,
  userId: string,
  userName?: string,
) {
  if (!debt.saleId) return

  const saleData = saleStates.get(debt.saleId)
  if (!saleData) return

  const currentCash = Number(saleData.cashPaid ?? 0)
  const currentCredit = Number(saleData.creditPaid ?? 0)
  const newCash = Number((currentCash + payAmount).toFixed(2))
  const newCredit = Number(Math.max(currentCredit - payAmount, 0).toFixed(2))
  const paymentStatus = computeSalePaymentStatus(newCash, newCredit)

  batch.update(tenantDocumentRef('sales', debt.saleId), {
    cashPaid: newCash,
    creditPaid: newCredit,
    paymentStatus,
    updatedAt: serverTimestamp(),
  })

  saleStates.set(debt.saleId, {
    ...saleData,
    cashPaid: newCash,
    creditPaid: newCredit,
    paymentStatus,
  })

  const salePaymentRef = doc(tenantCollectionRef('sales', debt.saleId, 'payments'))
  batch.set(salePaymentRef, {
    methodId: DEBT_COLLECTION_METHOD_ID,
    methodName: paymentInput.methodName,
    currencyCode: paymentInput.currencyCode,
    amount: payAmount,
    amountInBase: payAmount,
    reference: paymentInput.reference?.trim() || null,
    isCredit: false,
    isDebtCollection: true,
    debtPaymentId,
    clientId: debt.clientId,
    clientName: debt.clientName,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName ?? null,
  })
}

function mapDebtPayment(id: string, data: Record<string, unknown>): DebtPayment {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined

  return {
    id,
    debtId: String(data.debtId ?? ''),
    clientId: String(data.clientId ?? ''),
    amount: Number(data.amount ?? 0),
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE),
    amountInBase: Number(data.amountInBase ?? 0),
    methodName: String(data.methodName ?? ''),
    reference: data.reference ? String(data.reference) : undefined,
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : typeof createdAt === 'string'
          ? createdAt
          : new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

export async function listDebts(): Promise<Debt[]> {
  const snapshot = await getDocs(tenantCollectionRef('debts'))

  return snapshot.docs
    .map((item) => mapDebt(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listActiveDebts(): Promise<Debt[]> {
  return (await listDebts()).filter((debt) => debt.status === 'active' && debt.balance > 0)
}

export async function createDebt(input: CreateDebtInput) {
  if (input.originalAmount <= 0) {
    throw new Error('El monto de la deuda debe ser mayor a cero.')
  }

  const client = await getClientById(input.clientId)
  if (!client) {
    throw new Error('Cliente no encontrado.')
  }

  if (client.creditLimit > 0 && client.balance + input.originalAmount > client.creditLimit) {
    throw new Error('El monto excede el límite de crédito del cliente.')
  }

  const batch = writeBatch(db)
  const debtRef = doc(tenantCollectionRef('debts'))

  batch.set(debtRef, {
    clientId: client.id,
    clientName: client.name,
    originalAmount: input.originalAmount,
    balance: input.originalAmount,
    status: 'active',
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    notes: input.notes?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  await updateClientBalance(client.id, input.originalAmount)

  return debtRef.id
}

export async function recordDebtPayment(
  input: CreateDebtPaymentInput,
  userId: string,
  userName: string,
) {
  if (input.amount <= 0) {
    throw new Error('El monto del abono debe ser mayor a cero.')
  }

  const snapshot = await getDocs(tenantCollectionRef('debts'))
  const debtDoc = snapshot.docs.find((item) => item.id === input.debtId)
  if (!debtDoc) {
    throw new Error('Deuda no encontrada.')
  }

  const debt = mapDebt(debtDoc.id, debtDoc.data())

  if (input.amountInBase > debt.balance + 0.01) {
    throw new Error('El abono supera el saldo pendiente.')
  }

  const newBalance = Number((debt.balance - input.amountInBase).toFixed(2))
  const batch = writeBatch(db)
  const saleStates = debt.saleId
    ? await loadSaleStatesForDebts([debt])
    : new Map<string, Record<string, unknown>>()

  const paymentRef = doc(tenantCollectionRef('debt_payments'))
  batch.set(paymentRef, {
    debtId: debt.id,
    clientId: debt.clientId,
    amount: input.amount,
    currencyCode: input.currencyCode,
    amountInBase: input.amountInBase,
    methodName: input.methodName,
    reference: input.reference?.trim() || null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  applyDebtPaymentToLinkedSale(
    batch,
    saleStates,
    debt,
    input.amountInBase,
    {
      methodName: input.methodName,
      currencyCode: input.currencyCode,
      reference: input.reference,
    },
    paymentRef.id,
    userId,
    userName,
  )

  batch.update(tenantDocumentRef('debts', debt.id), {
    balance: newBalance,
    status: newBalance <= 0.01 ? 'paid' : 'active',
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
  await updateClientBalance(debt.clientId, -input.amountInBase)

  return paymentRef.id
}

export async function listDebtPayments(debtId: string): Promise<DebtPayment[]> {
  const snapshot = await getDocs(tenantCollectionRef('debt_payments'))

  return snapshot.docs
    .map((item) => mapDebtPayment(item.id, item.data()))
    .filter((payment) => payment.debtId === debtId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listDebtPaymentsByClient(clientId: string): Promise<DebtPayment[]> {
  const snapshot = await getDocs(tenantCollectionRef('debt_payments'))

  return snapshot.docs
    .map((item) => mapDebtPayment(item.id, item.data()))
    .filter((payment) => payment.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function listDebtsByClient(clientId: string): Promise<Debt[]> {
  return (await listDebts())
    .filter((debt) => debt.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function groupDebtsByClient(debts: Debt[]): ClientDebtAccount[] {
  const accounts = new Map<string, ClientDebtAccount>()

  debts.forEach((debt) => {
    const current = accounts.get(debt.clientId) ?? {
      clientId: debt.clientId,
      clientName: debt.clientName,
      balance: 0,
      activeDebtCount: 0,
      lastActivityAt: debt.createdAt,
    }

    if (debt.status === 'active' && debt.balance > 0) {
      current.balance = Number((current.balance + debt.balance).toFixed(2))
      current.activeDebtCount += 1
    }

    const activityDate = debt.updatedAt ?? debt.createdAt
    if (activityDate.localeCompare(current.lastActivityAt) > 0) {
      current.lastActivityAt = activityDate
    }

    accounts.set(debt.clientId, current)
  })

  return Array.from(accounts.values())
    .filter((account) => account.balance > 0)
    .sort(
      (a, b) =>
        b.balance - a.balance || a.clientName.localeCompare(b.clientName, 'es'),
    )
}

export function buildClientDebtHistory(
  debts: Debt[],
  payments: DebtPayment[],
): DebtHistoryEntry[] {
  const debtEntries: DebtHistoryEntry[] = debts.map((debt) => ({
    id: `debt-${debt.id}`,
    kind: 'debt',
    date: debt.createdAt,
    debtId: debt.id,
    amount: debt.originalAmount,
    balance: debt.balance,
    status: debt.status,
    notes: debt.notes,
    saleId: debt.saleId,
  }))

  const paymentEntries: DebtHistoryEntry[] = payments.map((payment) => ({
    id: `payment-${payment.id}`,
    kind: 'payment',
    date: payment.createdAt,
    debtId: payment.debtId,
    amount: payment.amountInBase,
    methodName: payment.methodName,
    reference: payment.reference,
    createdByName: payment.createdByName,
  }))

  return [...debtEntries, ...paymentEntries].sort((a, b) =>
    b.date.localeCompare(a.date),
  )
}

export async function recordClientDebtPayment(
  clientId: string,
  input: Omit<CreateDebtPaymentInput, 'debtId'>,
  userId: string,
  userName: string,
) {
  if (input.amount <= 0) {
    throw new Error('El monto del abono debe ser mayor a cero.')
  }

  const activeDebts = (await listDebts())
    .filter(
      (debt) =>
        debt.clientId === clientId && debt.status === 'active' && debt.balance > 0,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  if (activeDebts.length === 0) {
    throw new Error('Este cliente no tiene deudas activas.')
  }

  const totalOwed = activeDebts.reduce((sum, debt) => sum + debt.balance, 0)
  if (input.amountInBase > totalOwed + 0.01) {
    throw new Error('El abono supera el saldo pendiente del cliente.')
  }

  let remaining = input.amountInBase
  const batch = writeBatch(db)
  const saleStates = await loadSaleStatesForDebts(activeDebts)

  for (const debt of activeDebts) {
    if (remaining <= 0.001) break

    const payAmount = Number(Math.min(remaining, debt.balance).toFixed(2))
    const newBalance = Number((debt.balance - payAmount).toFixed(2))

    const paymentRef = doc(tenantCollectionRef('debt_payments'))
    batch.set(paymentRef, {
      debtId: debt.id,
      clientId: debt.clientId,
      amount: payAmount,
      currencyCode: input.currencyCode,
      amountInBase: payAmount,
      methodName: input.methodName,
      reference: input.reference?.trim() || null,
      createdAt: serverTimestamp(),
      createdBy: userId,
      createdByName: userName,
    })

    applyDebtPaymentToLinkedSale(
      batch,
      saleStates,
      debt,
      payAmount,
      {
        methodName: input.methodName,
        currencyCode: input.currencyCode,
        reference: input.reference,
      },
      paymentRef.id,
      userId,
      userName,
    )

    batch.update(tenantDocumentRef('debts', debt.id), {
      balance: newBalance,
      status: newBalance <= 0.01 ? 'paid' : 'active',
      updatedAt: serverTimestamp(),
    })

    remaining = Number((remaining - payAmount).toFixed(2))
  }

  await batch.commit()
  await updateClientBalance(clientId, -input.amountInBase)
}
