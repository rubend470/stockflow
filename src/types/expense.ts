export const expenseCategories = [
  'Arriendo',
  'Nomina',
  'Servicios',
  'Transporte',
  'Mercancia',
  'Mantenimiento',
  'Impuestos',
  'Otros',
] as const

export type ExpenseCategory = (typeof expenseCategories)[number]

export interface Expense {
  id: string
  description: string
  category: ExpenseCategory
  amountInBase: number
  expenseDate: string
  notes?: string
  createdBy: string
  createdByName: string
  createdAt: string
  updatedAt?: string
}

export interface ExpenseFormInput {
  description: string
  category: ExpenseCategory
  amount: string
  expenseDate: string
  notes: string
}

export function emptyExpenseForm(today = new Date()): ExpenseFormInput {
  return {
    description: '',
    category: 'Otros',
    amount: '',
    expenseDate: today.toISOString().slice(0, 10),
    notes: '',
  }
}

export function expenseFormFromExpense(expense: Expense): ExpenseFormInput {
  return {
    description: expense.description,
    category: expense.category,
    amount: String(expense.amountInBase),
    expenseDate: expense.expenseDate,
    notes: expense.notes ?? '',
  }
}
