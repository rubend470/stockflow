import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import {
  createExpense,
  deleteExpense,
  getExpensePeriodSummary,
  updateExpense,
  type ExpensePeriodSummary,
} from '../../../services/expenseService'
import {
  emptyExpenseForm,
  expenseCategories,
  expenseFormFromExpense,
  type Expense,
  type ExpenseFormInput,
} from '../../../types/expense'
import { formatBaseMoney, formatMoneyInputValue } from '../../../utils/formatMoney'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function getMonthStartKey() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function formatPercent(value: number) {
  return `${value.toFixed(1)} %`
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
}

function getBalanceTone(value: number) {
  if (value > 0) return 'positive'
  if (value < 0) return 'negative'
  return 'neutral'
}

const emptySummary = (startDate = getMonthStartKey(), endDate = getTodayKey()): ExpensePeriodSummary => ({
  startDate,
  endDate,
  salesCount: 0,
  revenue: 0,
  grossProfit: 0,
  expenseTotal: 0,
  netProfit: 0,
  grossMarginPercent: 0,
  netMarginPercent: 0,
  expenseRatioPercent: 0,
  expenses: [],
  byCategory: [],
})

export function ExpensesPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { loading, refreshing, run } = usePanelLoader()
  const [startDate, setStartDate] = useState(getMonthStartKey())
  const [endDate, setEndDate] = useState(getTodayKey())
  const [summary, setSummary] = useState<ExpensePeriodSummary>(() => emptySummary())
  const [formValues, setFormValues] = useState<ExpenseFormInput>(() => emptyExpenseForm())
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canAccess = userHasMenuPermission(user, 'expenses')
  const balanceTone = useMemo(() => getBalanceTone(summary.netProfit), [summary.netProfit])

  useEffect(() => {
    if (canAccess) {
      loadSummary()
    }
  }, [canAccess, startDate, endDate])

  async function loadSummary() {
    setError('')

    try {
      await run(async () => {
        const data = await getExpensePeriodSummary(startDate, endDate)
        setSummary(data)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el control de gastos.')
      setSummary(emptySummary(startDate, endDate))
    }
  }

  function resetForm() {
    setEditingExpense(null)
    setFormValues(emptyExpenseForm())
  }

  function editExpense(expense: Expense) {
    setEditingExpense(expense)
    setFormValues({
      ...expenseFormFromExpense(expense),
      amount: formatMoneyInputValue(expense.amountInBase),
    })
    setMessage('')
    setError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, formValues)
        setMessage('Gasto actualizado correctamente.')
      } else {
        await createExpense(formValues, { uid: user.uid, name: user.name })
        setMessage('Gasto registrado correctamente.')
      }

      resetForm()
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el gasto.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(expense: Expense) {
    const confirmed = await confirm({
      title: 'Eliminar gasto',
      message: `¿Eliminar "${expense.description}" por ${formatBaseMoney(expense.amountInBase)}?`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteExpense(expense.id)
      if (editingExpense?.id === expense.id) resetForm()
      setMessage('Gasto eliminado.')
      await loadSummary()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el gasto.')
    }
  }

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Control de gastos" subtitle="Gastos vs ganancias por periodo">
      <div className="expenses-layout">
        <AnimatedPanel className="finance-panel expenses-entry-panel">
          <div className="finance-panel-header">
            <div>
              <h2>{editingExpense ? 'Editar gasto' : 'Registrar gasto'}</h2>
              <p>Anota pagos operativos, servicios, nómina, transporte u otros egresos.</p>
            </div>
          </div>

          <form className="expense-form" onSubmit={handleSubmit}>
            <label className="finance-field">
              <span>Descripción</span>
              <input
                type="text"
                value={formValues.description}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Ej. Pago de luz"
              />
            </label>

            <div className="expense-form-grid">
              <label className="finance-field">
                <span>Categoría</span>
                <select
                  value={formValues.category}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      category: event.target.value as ExpenseFormInput['category'],
                    }))
                  }
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field">
                <span>Fecha</span>
                <input
                  type="date"
                  value={formValues.expenseDate}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, expenseDate: event.target.value }))
                  }
                />
              </label>
            </div>

            <label className="finance-field">
              <span>Monto (COP)</span>
              <MoneyInput
                min="0"
                value={formValues.amount}
                onChange={(value) =>
                  setFormValues((current) => ({ ...current, amount: value }))
                }
                showCurrencyPrefix
                currencyCode="COP"
                blankWhenZero
              />
            </label>

            <label className="finance-field">
              <span>Notas</span>
              <textarea
                value={formValues.notes}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Detalle opcional"
                rows={3}
              />
            </label>

            <div className="expense-form-actions">
              {editingExpense && (
                <button type="button" className="finance-btn finance-btn-secondary" onClick={resetForm}>
                  Cancelar edición
                </button>
              )}
              <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : editingExpense ? 'Actualizar gasto' : 'Registrar gasto'}
              </button>
            </div>
          </form>
        </AnimatedPanel>

        <AnimatedPanel className="finance-panel expenses-summary-panel panel-with-overlay">
          <PanelRefreshOverlay show={refreshing} />
          <div className="finance-panel-header">
            <div>
              <h2>Resumen del periodo</h2>
              <p>Compara gastos contra ventas y ganancia bruta.</p>
            </div>
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadSummary}>
              Actualizar
            </button>
          </div>

          <div className="expense-range">
            <label className="finance-field">
              <span>Desde</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="finance-field">
              <span>Hasta</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {loading ? (
            <div className="finance-empty">Cargando gastos...</div>
          ) : (
            <>
              <div className="expense-metrics">
                <article>
                  <span>Ventas</span>
                  <strong>{formatBaseMoney(summary.revenue)}</strong>
                  <small>{summary.salesCount} venta(s)</small>
                </article>
                <article>
                  <span>Ganancia bruta</span>
                  <strong className="finance-profit">{formatBaseMoney(summary.grossProfit)}</strong>
                  <small>Margen {formatPercent(summary.grossMarginPercent)}</small>
                </article>
                <article>
                  <span>Gastos</span>
                  <strong className="expense-negative">{formatBaseMoney(summary.expenseTotal)}</strong>
                  <small>{formatPercent(summary.expenseRatioPercent)} de ventas</small>
                </article>
                <article className={`expense-net-card ${balanceTone}`}>
                  <span>Ganancia neta</span>
                  <strong>{formatBaseMoney(summary.netProfit)}</strong>
                  <small>Margen neto {formatPercent(summary.netMarginPercent)}</small>
                </article>
              </div>

              <div className="expense-category-list">
                {summary.byCategory.length === 0 ? (
                  <span>Sin gastos registrados en este periodo.</span>
                ) : (
                  summary.byCategory.map((row) => (
                    <div key={row.category}>
                      <span>{row.category}</span>
                      <strong>{formatBaseMoney(row.total)}</strong>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </AnimatedPanel>
      </div>

      <AnimatedPanel className="finance-panel expenses-table-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Gastos del rango</h2>
            <p>
              Del {formatDate(summary.startDate)} al {formatDate(summary.endDate)}.
            </p>
          </div>
        </div>

        {summary.expenses.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin gastos en este periodo</strong>
            <p>Registra gastos o cambia el rango de fechas.</p>
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table expenses-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Gasto</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th>Registrado por</th>
                  <th className="table-actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {summary.expenses.map((expense, index) => (
                  <AnimatedTableRow key={expense.id} index={index}>
                    <td data-label="Fecha">{formatDate(expense.expenseDate)}</td>
                    <td data-label="Gasto">
                      <strong>{expense.description}</strong>
                      {expense.notes && <small className="expense-note">{expense.notes}</small>}
                    </td>
                    <td data-label="Categoría">
                      <span className="finance-badge inactive">{expense.category}</span>
                    </td>
                    <td data-label="Monto">
                      <strong>{formatBaseMoney(expense.amountInBase)}</strong>
                    </td>
                    <td data-label="Registrado por">{expense.createdByName || '-'}</td>
                    <td className="table-actions-col" data-label="Acciones">
                      <TableActions>
                        <TableAction icon="edit" onClick={() => editExpense(expense)}>
                          Editar
                        </TableAction>
                        <TableAction icon="delete" tone="danger" onClick={() => handleDelete(expense)}>
                          Eliminar
                        </TableAction>
                      </TableActions>
                    </td>
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnimatedPanel>
    </AppLayout>
  )
}
