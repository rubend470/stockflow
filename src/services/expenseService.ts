import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { listSales } from './saleService'
import type { Expense, ExpenseCategory, ExpenseFormInput } from '../types/expense'
import { expenseCategories } from '../types/expense'
import type { Sale } from '../types/sale'
import { parseMoneyInput, roundMoney } from '../utils/formatMoney'
import { computeMarginPercent } from './reportService'

export interface ExpensePeriodSummary {
  startDate: string
  endDate: string
  salesCount: number
  revenue: number
  grossProfit: number
  expenseTotal: number
  netProfit: number
  grossMarginPercent: number
  netMarginPercent: number
  expenseRatioPercent: number
  expenses: Expense[]
  byCategory: Array<{
    category: ExpenseCategory
    total: number
    count: number
  }>
}

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return ''
}

function normalizeCategory(value: unknown): ExpenseCategory {
  const category = String(value ?? 'Otros') as ExpenseCategory
  return expenseCategories.includes(category) ? category : 'Otros'
}

function mapExpense(id: string, data: Record<string, unknown>): Expense {
  return {
    id,
    description: String(data.description ?? ''),
    category: normalizeCategory(data.category),
    amountInBase: Number(data.amountInBase ?? 0),
    expenseDate: String(data.expenseDate ?? ''),
    notes: data.notes ? String(data.notes) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: mapTimestamp(data.updatedAt) || undefined,
  }
}

function assertValidExpenseInput(input: ExpenseFormInput) {
  const description = input.description.trim()
  if (!description) {
    throw new Error('Ingresa una descripción del gasto.')
  }

  const amount = parseMoneyInput(input.amount)
  if (amount <= 0) {
    throw new Error('Ingresa un monto mayor a cero.')
  }

  if (!input.expenseDate) {
    throw new Error('Selecciona la fecha del gasto.')
  }

  if (!expenseCategories.includes(input.category)) {
    throw new Error('Selecciona una categoría válida.')
  }

  return { description, amount }
}

function getDateKeyFromIso(dateIso: string) {
  if (!dateIso) return ''
  const date = new Date(dateIso)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInRange(dateKey: string, startDate: string, endDate: string) {
  return dateKey >= startDate && dateKey <= endDate
}

function filterSalesByDateRange(sales: Sale[], startDate: string, endDate: string) {
  return sales.filter((sale) => {
    if (sale.status === 'cancelled') return false
    return dateInRange(getDateKeyFromIso(sale.createdAt), startDate, endDate)
  })
}

export async function listExpenses(): Promise<Expense[]> {
  const snapshot = await getDocs(collection(db, 'expenses'))
  return snapshot.docs
    .map((item) => mapExpense(item.id, item.data()))
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate) || b.createdAt.localeCompare(a.createdAt))
}

export async function createExpense(
  input: ExpenseFormInput,
  user: { uid: string; name: string },
) {
  const { description, amount } = assertValidExpenseInput(input)

  await addDoc(collection(db, 'expenses'), {
    description,
    category: input.category,
    amountInBase: roundMoney(amount),
    expenseDate: input.expenseDate,
    notes: input.notes.trim() || null,
    createdBy: user.uid,
    createdByName: user.name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateExpense(id: string, input: ExpenseFormInput) {
  const { description, amount } = assertValidExpenseInput(input)

  await updateDoc(doc(db, 'expenses', id), {
    description,
    category: input.category,
    amountInBase: roundMoney(amount),
    expenseDate: input.expenseDate,
    notes: input.notes.trim() || null,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteExpense(id: string) {
  await deleteDoc(doc(db, 'expenses', id))
}

export async function getExpensePeriodSummary(
  startDate: string,
  endDate: string,
): Promise<ExpensePeriodSummary> {
  if (!startDate || !endDate) {
    throw new Error('Selecciona el rango de fechas.')
  }
  if (startDate > endDate) {
    throw new Error('La fecha inicial no puede ser mayor a la fecha final.')
  }

  const [expenses, sales] = await Promise.all([listExpenses(), listSales(2000)])
  const periodExpenses = expenses.filter((expense) =>
    dateInRange(expense.expenseDate, startDate, endDate),
  )
  const periodSales = filterSalesByDateRange(sales, startDate, endDate)

  const revenue = roundMoney(periodSales.reduce((sum, sale) => sum + sale.total, 0))
  const grossProfit = roundMoney(
    periodSales.reduce((sum, sale) => sum + (sale.profitTotal ?? 0), 0),
  )
  const expenseTotal = roundMoney(
    periodExpenses.reduce((sum, expense) => sum + expense.amountInBase, 0),
  )
  const netProfit = roundMoney(grossProfit - expenseTotal)

  const byCategoryMap = new Map<ExpenseCategory, { category: ExpenseCategory; total: number; count: number }>()
  periodExpenses.forEach((expense) => {
    const current = byCategoryMap.get(expense.category) ?? {
      category: expense.category,
      total: 0,
      count: 0,
    }
    current.total = roundMoney(current.total + expense.amountInBase)
    current.count += 1
    byCategoryMap.set(expense.category, current)
  })

  return {
    startDate,
    endDate,
    salesCount: periodSales.length,
    revenue,
    grossProfit,
    expenseTotal,
    netProfit,
    grossMarginPercent: computeMarginPercent(revenue, grossProfit),
    netMarginPercent: computeMarginPercent(revenue, netProfit),
    expenseRatioPercent: revenue > 0 ? Number(((expenseTotal / revenue) * 100).toFixed(1)) : 0,
    expenses: periodExpenses,
    byCategory: [...byCategoryMap.values()].sort((a, b) => b.total - a.total),
  }
}
