import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { MoneyText } from '../../../components/ui/MoneyText'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import {
  convertToBase,
  formatExchangeRateLabel,
  getBaseCurrency,
  listCurrencies,
  listLatestExchangeRates,
  listPaymentMethods,
  findRateForConversion,
} from '../../../services/financeService'
import {
  createCashMovement,
  deleteCashMovement,
  listCashMovements,
  updateCashMovement,
} from '../../../services/cashMovementService'
import {
  cashMovementFormFromMovement,
  cashMovementTypeLabels,
  emptyCashMovementForm,
  type CashMovement,
  type CashMovementFormInput,
  type CashMovementType,
} from '../../../types/cashMovement'
import type { Currency, ExchangeRate, PaymentMethod } from '../../../types/finance'
import { todayDateInputValue } from '../../../utils/dates'
import { formatBaseMoney, formatMoney, formatMoneyInputValue, parseMoneyInput } from '../../../utils/formatMoney'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

type CashMovementsPageMode = 'movements' | 'opening'

interface CashMovementsPageProps {
  mode?: CashMovementsPageMode
}

function getTodayKey() {
  return todayDateInputValue()
}

function formatDate(value: string) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`))
}

function getDefaultType(mode: CashMovementsPageMode): CashMovementType {
  return mode === 'opening' ? 'opening' : 'in'
}

function getPermission(mode: CashMovementsPageMode) {
  return mode === 'opening' ? 'cash-opening' : 'cash-movements'
}

export function CashMovementsPage({ mode = 'movements' }: CashMovementsPageProps) {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { loading, refreshing, run } = usePanelLoader()
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [formValues, setFormValues] = useState<CashMovementFormInput>(() =>
    emptyCashMovementForm(getDefaultType(mode)),
  )
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null)
  const [filterDate, setFilterDate] = useState(getTodayKey())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const isOpeningMode = mode === 'opening'
  const canAccess = userHasMenuPermission(user, getPermission(mode))
  const pageTitle = isOpeningMode ? 'Base de caja' : 'Entradas y salidas'
  const pageSubtitle = isOpeningMode
    ? 'Dinero inicial para iniciar el día con vueltos'
    : 'Movimientos adicionales que afectan el cierre'
  const baseCurrencyCode = getBaseCurrency(currencies)?.code ?? 'COP'
  const selectedCurrency = currencies.find((currency) => currency.code === formValues.currencyCode)
  const availableMethods = paymentMethods.filter(
    (method) =>
      method.allowedCurrencies.length === 0 ||
      method.allowedCurrencies.includes(formValues.currencyCode),
  )
  const enteredAmount = parseMoneyInput(formValues.amount)
  const amountInBasePreview = useMemo(() => {
    if (!enteredAmount || enteredAmount <= 0) return null
    try {
      return convertToBase(enteredAmount, formValues.currencyCode, baseCurrencyCode, exchangeRates)
    } catch {
      return null
    }
  }, [enteredAmount, formValues.currencyCode, baseCurrencyCode, exchangeRates])
  const conversionRateLabel = useMemo(() => {
    if (formValues.currencyCode === baseCurrencyCode) return null
    const direct = findRateForConversion(formValues.currencyCode, baseCurrencyCode, exchangeRates)
    if (direct) return formatExchangeRateLabel(direct)
    const inverse = findRateForConversion(baseCurrencyCode, formValues.currencyCode, exchangeRates)
    if (inverse) return `Inversa de ${formatExchangeRateLabel(inverse)}`
    return null
  }, [formValues.currencyCode, baseCurrencyCode, exchangeRates])

  const visibleMovements = useMemo(() => {
    const allowedTypes: CashMovementType[] = isOpeningMode ? ['opening'] : ['in', 'out']
    return movements.filter(
      (movement) =>
        allowedTypes.includes(movement.type) &&
        (!filterDate || movement.movementDate === filterDate),
    )
  }, [movements, filterDate, isOpeningMode])

  const totals = useMemo(() => {
    return visibleMovements.reduce(
      (acc, movement) => {
        if (movement.type === 'opening') acc.opening += movement.amountInBase
        if (movement.type === 'in') acc.in += movement.amountInBase
        if (movement.type === 'out') acc.out += movement.amountInBase
        return acc
      },
      { opening: 0, in: 0, out: 0 },
    )
  }, [visibleMovements])

  useEffect(() => {
    if (canAccess) void loadMovements()
  }, [canAccess])

  useEffect(() => {
    resetForm()
  }, [mode])

  async function loadMovements() {
    setError('')

    try {
      await run(async () => {
        const [movementList, currencyList, methodList, rateList] = await Promise.all([
          listCashMovements(),
          listCurrencies(),
          listPaymentMethods(),
          listLatestExchangeRates(),
        ])
        setMovements(movementList)
        setCurrencies(currencyList)
        setPaymentMethods(methodList)
        setExchangeRates(rateList)
        setFormValues((current) => {
          const currencyCode = current.currencyCode || getBaseCurrency(currencyList)?.code || 'COP'
          const method =
            methodList.find(
              (entry) =>
                entry.id === current.methodId &&
                (entry.allowedCurrencies.length === 0 || entry.allowedCurrencies.includes(currencyCode)),
            ) ??
            methodList.find(
              (entry) =>
                entry.allowedCurrencies.length === 0 || entry.allowedCurrencies.includes(currencyCode),
            )
          return {
            ...current,
            currencyCode,
            methodId: method?.id ?? '',
            methodName: method?.name,
          }
        })
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los movimientos de caja.')
    }
  }

  function resetForm() {
    setEditingMovement(null)
    const baseCode = getBaseCurrency(currencies)?.code ?? 'COP'
    const method = paymentMethods.find(
      (entry) => entry.allowedCurrencies.length === 0 || entry.allowedCurrencies.includes(baseCode),
    )
    setFormValues({
      ...emptyCashMovementForm(getDefaultType(mode)),
      currencyCode: baseCode,
      methodId: method?.id ?? '',
      methodName: method?.name,
    })
  }

  function editMovement(movement: CashMovement) {
    setEditingMovement(movement)
    setFormValues({
      ...cashMovementFormFromMovement(movement),
      amount: formatMoneyInputValue(movement.amount),
    })
    setMessage('')
    setError('')
  }

  function handleCurrencyChange(currencyCode: string) {
    const method =
      paymentMethods.find(
        (entry) =>
          entry.id === formValues.methodId &&
          (entry.allowedCurrencies.length === 0 || entry.allowedCurrencies.includes(currencyCode)),
      ) ??
      paymentMethods.find(
        (entry) =>
          entry.allowedCurrencies.length === 0 || entry.allowedCurrencies.includes(currencyCode),
      )

    setFormValues((current) => ({
      ...current,
      currencyCode,
      methodId: method?.id ?? '',
      methodName: method?.name,
    }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const method = paymentMethods.find((entry) => entry.id === formValues.methodId)
      const convertedAmount = amountInBasePreview
      if (!method) {
        setError('Selecciona la forma de pago del movimiento.')
        return
      }
      if (convertedAmount === null) {
        setError(`No hay tasa configurada de ${formValues.currencyCode} a ${baseCurrencyCode}.`)
        return
      }

      const input = {
        ...(isOpeningMode ? { ...formValues, type: 'opening' as const } : formValues),
        amountInBase: convertedAmount,
        methodName: method.name,
      }

      if (editingMovement) {
        await updateCashMovement(editingMovement.id, input)
        setMessage('Movimiento actualizado correctamente.')
      } else {
        await createCashMovement(input, { uid: user.uid, name: user.name })
        setMessage(
          isOpeningMode
            ? 'Base inicial registrada correctamente.'
            : 'Movimiento registrado correctamente.',
        )
      }

      resetForm()
      await loadMovements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el movimiento.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(movement: CashMovement) {
    const confirmed = await confirm({
      title: 'Eliminar movimiento',
      message: `¿Eliminar "${movement.description}" por ${formatMoney(movement.amount, movement.currencyCode)}?`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteCashMovement(movement.id)
      if (editingMovement?.id === movement.id) resetForm()
      setMessage('Movimiento eliminado.')
      await loadMovements()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el movimiento.')
    }
  }

  if (!canAccess) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title={pageTitle} subtitle={pageSubtitle}>
      <div className="cash-movements-layout">
        <AnimatedPanel className="finance-panel cash-movement-entry-panel">
          <div className="finance-panel-header">
            <div>
              <h2>{editingMovement ? 'Editar movimiento' : isOpeningMode ? 'Registrar base' : 'Registrar movimiento'}</h2>
              <p>
                {isOpeningMode
                  ? 'Anota el dinero que se deja en la caja al iniciar el día.'
                  : 'Anota entradas o salidas que no vienen de una venta principal.'}
              </p>
            </div>
          </div>

          <form className="expense-form" onSubmit={handleSubmit}>
            {!isOpeningMode && (
              <label className="finance-field">
                <span>Tipo</span>
                <select
                  value={formValues.type}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      type: event.target.value as CashMovementType,
                    }))
                  }
                >
                  <option value="in">Entrada</option>
                  <option value="out">Salida</option>
                </select>
              </label>
            )}

            <label className="finance-field">
              <span>Descripción</span>
              <input
                type="text"
                value={formValues.description}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, description: event.target.value }))
                }
                placeholder={isOpeningMode ? 'Ej. Base inicial de caja' : 'Ej. Venta externa, retiro, ajuste'}
              />
            </label>

            <div className="expense-form-grid">
              <label className="finance-field">
                <span>Fecha</span>
                <input
                  type="date"
                  value={formValues.movementDate}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, movementDate: event.target.value }))
                  }
                />
              </label>

              <label className="finance-field">
                <span>Moneda</span>
                <select
                  value={formValues.currencyCode}
                  onChange={(event) => handleCurrencyChange(event.target.value)}
                >
                  {currencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} · {currency.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field">
                <span>Forma de pago</span>
                <select
                  value={formValues.methodId}
                  onChange={(event) => {
                    const method = paymentMethods.find((entry) => entry.id === event.target.value)
                    setFormValues((current) => ({
                      ...current,
                      methodId: method?.id ?? '',
                      methodName: method?.name,
                    }))
                  }}
                >
                  <option value="">Selecciona</option>
                  {availableMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="finance-field">
                <span>Monto ({selectedCurrency?.symbol ?? formValues.currencyCode})</span>
                <MoneyInput
                  min="0"
                  value={formValues.amount}
                  onChange={(value) =>
                    setFormValues((current) => ({ ...current, amount: value }))
                  }
                  showCurrencyPrefix
                  currencyCode={formValues.currencyCode}
                  blankWhenZero
                />
                {formValues.currencyCode !== baseCurrencyCode && (
                  <small className="finance-field-hint">
                    {amountInBasePreview === null
                      ? `Falta tasa de ${formValues.currencyCode} a ${baseCurrencyCode}.`
                      : `Equivale a ${formatBaseMoney(amountInBasePreview)}${
                          conversionRateLabel ? ` · ${conversionRateLabel}` : ''
                        }`}
                  </small>
                )}
              </label>

              <label className="finance-field">
                <span>Referencia</span>
                <input
                  type="text"
                  value={formValues.reference}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, reference: event.target.value }))
                  }
                  placeholder="Opcional"
                />
              </label>
            </div>

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
              {editingMovement && (
                <button type="button" className="finance-btn finance-btn-secondary" onClick={resetForm}>
                  Cancelar edición
                </button>
              )}
              <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : editingMovement ? 'Actualizar' : 'Registrar'}
              </button>
            </div>
          </form>
        </AnimatedPanel>

        <AnimatedPanel className="finance-panel panel-with-overlay">
          <PanelRefreshOverlay show={refreshing} />
          <div className="finance-panel-header">
            <div>
              <h2>{isOpeningMode ? 'Base registrada' : 'Movimientos del día'}</h2>
              <p>Estos valores entran en el cierre de caja de la fecha seleccionada.</p>
            </div>
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadMovements}>
              Actualizar
            </button>
          </div>

          <div className="cash-movement-summary">
            <label className="finance-field">
              <span>Fecha</span>
              <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
            </label>
            <article>
              <span>{isOpeningMode ? 'Base del día' : 'Entradas'}</span>
              <strong>
                <MoneyText amount={isOpeningMode ? totals.opening : totals.in} />
              </strong>
            </article>
            {!isOpeningMode && (
              <article>
                <span>Salidas</span>
                <strong className="text-danger">
                  <MoneyText amount={totals.out} />
                </strong>
              </article>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {loading ? (
            <div className="finance-empty">Cargando movimientos...</div>
          ) : visibleMovements.length === 0 ? (
            <div className="finance-empty">
              <strong>Sin registros</strong>
              <p>No hay movimientos para esta fecha.</p>
            </div>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Descripción</th>
                    <th>Moneda / forma</th>
                    <th>Monto</th>
                    <th>Equiv. COP</th>
                    <th>Usuario</th>
                    <th className="table-actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleMovements.map((movement, index) => (
                    <AnimatedTableRow key={movement.id} index={index}>
                      <td>{formatDate(movement.movementDate)}</td>
                      <td>
                        <span className={`finance-badge cash-movement-${movement.type}`}>
                          {cashMovementTypeLabels[movement.type]}
                        </span>
                      </td>
                      <td>
                        <strong>{movement.description}</strong>
                        {movement.notes && <small className="expense-note">{movement.notes}</small>}
                      </td>
                      <td>
                        <strong>{movement.currencyCode}</strong>
                        <small className="expense-note">
                          {movement.methodName || 'Caja'}
                          {movement.reference ? ` · Ref. ${movement.reference}` : ''}
                        </small>
                      </td>
                      <td>
                        <MoneyText amount={movement.amount} currencyCode={movement.currencyCode} />
                      </td>
                      <td>
                        <MoneyText amount={movement.amountInBase} />
                      </td>
                      <td>{movement.createdByName || '—'}</td>
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction icon="edit" onClick={() => editMovement(movement)}>
                            Editar
                          </TableAction>
                          <TableAction icon="delete" tone="danger" onClick={() => handleDelete(movement)}>
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
      </div>
    </AppLayout>
  )
}
