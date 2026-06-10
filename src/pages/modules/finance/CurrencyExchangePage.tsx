import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../../constants/currency'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { usePagination } from '../../../hooks/usePagination'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import {
  createCurrencyExchange,
  deleteCurrencyExchange,
  listCurrencyExchanges,
} from '../../../services/currencyExchangeService'
import {
  buildExchangeRateSnapshot,
  convertCurrencySmart,
  describeConversion,
  ensureFinanceDefaults,
  getBaseCurrency,
  listCurrencies,
  listLatestExchangeRates,
  listPaymentMethods,
} from '../../../services/financeService'
import type { CurrencyExchange } from '../../../types/currencyExchange'
import {
  pickDefaultPaymentMethod,
  type Currency,
  type ExchangeRate,
  type PaymentMethod,
} from '../../../types/finance'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import {
  formatMoney,
  formatMoneyInputValue,
  parseMoneyInput,
  roundMoney,
} from '../../../utils/formatMoney'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function currencyLabel(currency: Currency) {
  return `${currency.code} · ${currency.name}`
}

function methodsForCurrency(methods: PaymentMethod[], currencyCode: string) {
  return methods.filter(
    (method) =>
      method.allowedCurrencies.length === 0 ||
      method.allowedCurrencies.includes(currencyCode),
  )
}

function pickMethodForCurrency(methods: PaymentMethod[], currencyCode: string) {
  const eligible = methodsForCurrency(methods, currencyCode)
  return pickDefaultPaymentMethod(eligible) ?? eligible[0]
}

export function CurrencyExchangePage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [exchanges, setExchanges] = useState<CurrencyExchange[]>([])
  const { loading, refreshing, run } = usePanelLoader()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  const [cashInCurrency, setCashInCurrency] = useState('')
  const [cashOutCurrency, setCashOutCurrency] = useState('')
  const [cashInAmount, setCashInAmount] = useState('')
  const [cashOutAmount, setCashOutAmount] = useState('')
  const [cashInMethodId, setCashInMethodId] = useState('')
  const [cashOutMethodId, setCashOutMethodId] = useState('')
  const [cashInReference, setCashInReference] = useState('')
  const [cashOutReference, setCashOutReference] = useState('')
  const [clientName, setClientName] = useState('')
  const [notes, setNotes] = useState('')
  const [deletingId, setDeletingId] = useState('')

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  const baseCurrency = useMemo(() => getBaseCurrency(currencies), [currencies])
  const baseCurrencyCode = baseCurrency?.code ?? DEFAULT_BASE_CURRENCY_CODE

  const cashInMethods = useMemo(
    () => methodsForCurrency(paymentMethods, cashInCurrency),
    [paymentMethods, cashInCurrency],
  )

  const cashOutMethods = useMemo(
    () => methodsForCurrency(paymentMethods, cashOutCurrency),
    [paymentMethods, cashOutCurrency],
  )

  const selectedCashInMethod = useMemo(
    () => cashInMethods.find((method) => method.id === cashInMethodId),
    [cashInMethods, cashInMethodId],
  )

  const selectedCashOutMethod = useMemo(
    () => cashOutMethods.find((method) => method.id === cashOutMethodId),
    [cashOutMethods, cashOutMethodId],
  )

  useEffect(() => {
    if (!cashInCurrency || cashInMethods.length === 0) return
    if (!cashInMethods.some((method) => method.id === cashInMethodId)) {
      setCashInMethodId(pickMethodForCurrency(cashInMethods, cashInCurrency)?.id ?? '')
    }
  }, [cashInCurrency, cashInMethods, cashInMethodId])

  useEffect(() => {
    if (!cashOutCurrency || cashOutMethods.length === 0) return
    if (!cashOutMethods.some((method) => method.id === cashOutMethodId)) {
      setCashOutMethodId(pickMethodForCurrency(cashOutMethods, cashOutCurrency)?.id ?? '')
    }
  }, [cashOutCurrency, cashOutMethods, cashOutMethodId])

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setError('')

    try {
      await run(async () => {
        if (user) {
          await ensureFinanceDefaults(user.uid)
        }

        const [currencyList, rateList, methodList, exchangeList] = await Promise.all([
          listCurrencies(),
          listLatestExchangeRates(),
          listPaymentMethods(),
          listCurrencyExchanges(),
        ])

        setCurrencies(currencyList)
        setRates(rateList)
        setPaymentMethods(methodList)
        setExchanges(exchangeList)

        if (!cashInCurrency && currencyList.length > 0) {
          const foreign = currencyList.find((currency) => !currency.isBase) ?? currencyList[0]
          const base = currencyList.find((currency) => currency.isBase) ?? currencyList[0]
          setCashInCurrency(foreign.code)
          setCashOutCurrency(base.code)

          const inMethod = pickMethodForCurrency(methodList, foreign.code)
          const outMethod = pickMethodForCurrency(methodList, base.code)
          setCashInMethodId(inMethod?.id ?? '')
          setCashOutMethodId(outMethod?.id ?? '')
        }
      })
    } catch {
      setError('No se pudieron cargar las monedas y tasas.')
    }
  }

  const conversionPreview = useMemo(() => {
    const amount = parseMoneyInput(cashInAmount)
    if (!amount || amount <= 0 || !cashInCurrency || !cashOutCurrency || cashInCurrency === cashOutCurrency) {
      return null
    }

    try {
      const result = convertCurrencySmart(amount, cashInCurrency, cashOutCurrency, baseCurrencyCode, rates)
      const label = describeConversion(cashInCurrency, cashOutCurrency, baseCurrencyCode, rates)
      const amountInBase = convertCurrencySmart(
        amount,
        cashInCurrency,
        baseCurrencyCode,
        baseCurrencyCode,
        rates,
      ).amount

      return {
        cashOutAmount: result.amount,
        factor: result.factor,
        viaBase: result.viaBase,
        rateLabel: label ?? `${result.factor} ${cashOutCurrency} por ${cashInCurrency}`,
        amountInBase,
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'No hay tasa para esta conversión.',
      }
    }
  }, [cashInAmount, cashInCurrency, cashOutCurrency, baseCurrencyCode, rates])

  useEffect(() => {
    if (!conversionPreview || 'error' in conversionPreview) return
    setCashOutAmount(formatMoneyInputValue(conversionPreview.cashOutAmount))
  }, [conversionPreview])

  const filteredExchanges = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return exchanges

    return exchanges.filter((exchange) => {
      return (
        exchange.cashInCurrency.toLowerCase().includes(query) ||
        exchange.cashOutCurrency.toLowerCase().includes(query) ||
        exchange.cashInMethodName.toLowerCase().includes(query) ||
        exchange.cashOutMethodName.toLowerCase().includes(query) ||
        exchange.cashInReference?.toLowerCase().includes(query) ||
        exchange.cashOutReference?.toLowerCase().includes(query) ||
        exchange.clientName?.toLowerCase().includes(query) ||
        exchange.createdByName.toLowerCase().includes(query) ||
        exchange.notes?.toLowerCase().includes(query)
      )
    })
  }, [exchanges, search])

  const pagination = usePagination(filteredExchanges, 15)

  const todaySummary = useMemo(() => {
    const today = new Date().toDateString()
    const todayExchanges = exchanges.filter(
      (exchange) => new Date(exchange.createdAt).toDateString() === today,
    )

    const byCurrency = new Map<string, { cashIn: number; cashOut: number }>()

    todayExchanges.forEach((exchange) => {
      const inRow = byCurrency.get(exchange.cashInCurrency) ?? { cashIn: 0, cashOut: 0 }
      inRow.cashIn = roundMoney(inRow.cashIn + exchange.cashInAmount)
      byCurrency.set(exchange.cashInCurrency, inRow)

      const outRow = byCurrency.get(exchange.cashOutCurrency) ?? { cashIn: 0, cashOut: 0 }
      outRow.cashOut = roundMoney(outRow.cashOut + exchange.cashOutAmount)
      byCurrency.set(exchange.cashOutCurrency, outRow)
    })

    return {
      count: todayExchanges.length,
      volumeBase: todayExchanges.reduce((sum, exchange) => sum + exchange.amountInBase, 0),
      byCurrency: [...byCurrency.entries()]
        .map(([currencyCode, totals]) => ({ currencyCode, ...totals }))
        .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode, 'es')),
    }
  }, [exchanges])

  function swapCurrencies() {
    setCashInCurrency(cashOutCurrency)
    setCashOutCurrency(cashInCurrency)
    setCashInAmount(cashOutAmount)
    setCashOutAmount(cashInAmount)
    setCashInMethodId(cashOutMethodId)
    setCashOutMethodId(cashInMethodId)
    setCashInReference(cashOutReference)
    setCashOutReference(cashInReference)
  }

  function resetForm() {
    setCashInAmount('')
    setCashOutAmount('')
    setCashInReference('')
    setCashOutReference('')
    setClientName('')
    setNotes('')
  }

  async function handleDelete(exchange: CurrencyExchange) {
    if (!canManage) return

    const confirmed = await confirm({
      title: 'Eliminar cambio de moneda',
      message: `¿Eliminar el cambio del ${formatDate(exchange.createdAt)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setDeletingId(exchange.id)
    setError('')
    setMessage('')

    try {
      await deleteCurrencyExchange(exchange.id)
      setExchanges((current) => current.filter((item) => item.id !== exchange.id))
      setMessage('Cambio de moneda eliminado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el cambio.')
    } finally {
      setDeletingId('')
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user) return

    const parsedIn = parseMoneyInput(cashInAmount)
    const parsedOut = parseMoneyInput(cashOutAmount)
    const inMethod = cashInMethods.find((method) => method.id === cashInMethodId)
    const outMethod = cashOutMethods.find((method) => method.id === cashOutMethodId)

    if (!parsedIn || parsedIn <= 0) {
      setError('Indica el monto que entró a caja.')
      return
    }

    if (!parsedOut || parsedOut <= 0) {
      setError('Indica el monto que salió de caja.')
      return
    }

    if (!inMethod) {
      setError('Selecciona la forma de pago de la entrada.')
      return
    }

    if (!outMethod) {
      setError('Selecciona la forma de pago de la salida.')
      return
    }

    if (inMethod.requiresReference && !cashInReference.trim()) {
      setError('La forma de pago de la entrada requiere referencia.')
      return
    }

    if (outMethod.requiresReference && !cashOutReference.trim()) {
      setError('La forma de pago de la salida requiere referencia.')
      return
    }

    if (!conversionPreview || 'error' in conversionPreview) {
      const previewError =
        conversionPreview && 'error' in conversionPreview ? conversionPreview.error : undefined
      setError(previewError ?? 'No se pudo calcular la conversión.')
      return
    }

    const inMeta = currencies.find((currency) => currency.code === cashInCurrency)
    const outMeta = currencies.find((currency) => currency.code === cashOutCurrency)

    const inMethodLabel = inMethod.requiresReference
      ? `${inMethod.name} · Ref. ${cashInReference.trim()}`
      : inMethod.name
    const outMethodLabel = outMethod.requiresReference
      ? `${outMethod.name} · Ref. ${cashOutReference.trim()}`
      : outMethod.name

    const confirmed = await confirm({
      title: 'Confirmar cambio de moneda',
      message: `Entró ${formatMoney(parsedIn, cashInCurrency, inMeta?.symbol)} (${inMethodLabel}) y salió ${formatMoney(parsedOut, cashOutCurrency, outMeta?.symbol)} (${outMethodLabel}). ¿Registrar el cambio?`,
      confirmLabel: 'Sí, registrar',
    })
    if (!confirmed) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const id = await createCurrencyExchange(
        {
          cashInCurrency,
          cashInAmount: parsedIn,
          cashInMethodId: inMethod.id,
          cashInMethodName: inMethod.name,
          cashInReference: cashInReference.trim() || undefined,
          cashOutCurrency,
          cashOutAmount: parsedOut,
          cashOutMethodId: outMethod.id,
          cashOutMethodName: outMethod.name,
          cashOutReference: cashOutReference.trim() || undefined,
          conversionFactor: parsedOut / parsedIn,
          rateLabel: conversionPreview.rateLabel,
          amountInBase: conversionPreview.amountInBase,
          baseCurrency: baseCurrencyCode,
          exchangeRateSnapshot: buildExchangeRateSnapshot(rates, baseCurrencyCode),
          clientName,
          notes,
        },
        user.uid,
        user.name,
      )

      const created: CurrencyExchange = {
        id,
        cashInCurrency,
        cashInAmount: parsedIn,
        cashInMethodId: inMethod.id,
        cashInMethodName: inMethod.name,
        cashInReference: cashInReference.trim() || undefined,
        cashOutCurrency,
        cashOutAmount: parsedOut,
        cashOutMethodId: outMethod.id,
        cashOutMethodName: outMethod.name,
        cashOutReference: cashOutReference.trim() || undefined,
        fromCurrency: cashInCurrency,
        toCurrency: cashOutCurrency,
        fromAmount: parsedIn,
        toAmount: parsedOut,
        conversionFactor: parsedOut / parsedIn,
        rateLabel: conversionPreview.rateLabel,
        amountInBase: conversionPreview.amountInBase,
        baseCurrency: baseCurrencyCode,
        exchangeRateSnapshot: buildExchangeRateSnapshot(rates, baseCurrencyCode),
        clientName: clientName.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
        createdBy: user.uid,
        createdByName: user.name,
      }

      setExchanges((current) => [created, ...current])
      setMessage('Cambio de moneda registrado correctamente.')
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el cambio.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppLayout
      title="Cambio de moneda"
      subtitle="Registra entradas y salidas de caja por moneda"
    >
      <div className="exchange-layout">
        <section className="finance-panel exchange-form-panel" style={{ position: 'relative' }}>
          <PanelRefreshOverlay show={refreshing} />
          <div className="finance-panel-header">
            <div>
              <h2>Nueva operación</h2>
              <p>
                Indica qué dinero entró a caja, cómo entró, qué salió y por qué forma de pago.
              </p>
            </div>
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadData}>
              Actualizar tasas
            </button>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {loading ? (
            <div className="finance-empty">Cargando monedas y tasas...</div>
          ) : currencies.length < 2 ? (
            <div className="finance-empty">
              <strong>Se necesitan al menos dos monedas activas</strong>
              <p>Configura las monedas y sus tasas en Finanzas → Monedas y tasas.</p>
            </div>
          ) : (
            <form className="exchange-form" onSubmit={handleSubmit}>
              <div className="exchange-columns">
                <div className="exchange-side exchange-side-in">
                  <span className="exchange-side-label">Entró a caja</span>
                  <label className="exchange-field">
                    <span>Moneda</span>
                    <select
                      className="finance-select"
                      value={cashInCurrency}
                      onChange={(event) => setCashInCurrency(event.target.value)}
                      required
                    >
                      {currencies.map((currency) => (
                        <option key={currency.id} value={currency.code}>
                          {currencyLabel(currency)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="exchange-field">
                    <span>Monto</span>
                    <MoneyInput value={cashInAmount} onChange={setCashInAmount} required />
                  </label>
                  <label className="exchange-field">
                    <span>Forma de pago</span>
                    <select
                      className="finance-select"
                      value={cashInMethodId}
                      onChange={(event) => setCashInMethodId(event.target.value)}
                      required
                    >
                      {cashInMethods.length === 0 ? (
                        <option value="">Sin métodos para esta moneda</option>
                      ) : (
                        cashInMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  {selectedCashInMethod?.requiresReference && (
                    <label className="exchange-field">
                      <span>Referencia de entrada</span>
                      <input
                        type="text"
                        value={cashInReference}
                        onChange={(event) => setCashInReference(event.target.value)}
                        placeholder="Nº de referencia o comprobante"
                        required
                      />
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  className="exchange-swap-btn"
                  onClick={swapCurrencies}
                  title="Intercambiar lados"
                  aria-label="Intercambiar lados"
                >
                  ⇄
                </button>

                <div className="exchange-side exchange-side-out">
                  <span className="exchange-side-label">Salió de caja</span>
                  <label className="exchange-field">
                    <span>Moneda</span>
                    <select
                      className="finance-select"
                      value={cashOutCurrency}
                      onChange={(event) => setCashOutCurrency(event.target.value)}
                      required
                    >
                      {currencies.map((currency) => (
                        <option key={currency.id} value={currency.code}>
                          {currencyLabel(currency)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="exchange-field">
                    <span>Monto</span>
                    <MoneyInput value={cashOutAmount} onChange={setCashOutAmount} required />
                  </label>
                  <label className="exchange-field">
                    <span>Forma de pago</span>
                    <select
                      className="finance-select"
                      value={cashOutMethodId}
                      onChange={(event) => setCashOutMethodId(event.target.value)}
                      required
                    >
                      {cashOutMethods.length === 0 ? (
                        <option value="">Sin métodos para esta moneda</option>
                      ) : (
                        cashOutMethods.map((method) => (
                          <option key={method.id} value={method.id}>
                            {method.name}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  {selectedCashOutMethod?.requiresReference && (
                    <label className="exchange-field">
                      <span>Referencia de salida</span>
                      <input
                        type="text"
                        value={cashOutReference}
                        onChange={(event) => setCashOutReference(event.target.value)}
                        placeholder="Nº de referencia o comprobante"
                        required
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="exchange-rate-card">
                {conversionPreview && 'error' in conversionPreview ? (
                  <p className="exchange-rate-error">{conversionPreview.error}</p>
                ) : conversionPreview ? (
                  <>
                    <strong>Tasa aplicada:</strong> {conversionPreview.rateLabel}
                    {conversionPreview.viaBase && (
                      <span className="exchange-rate-via"> · vía {baseCurrencyCode}</span>
                    )}
                    <p>
                      Equivalente en {baseCurrencyCode}:{' '}
                      <strong>{formatMoney(conversionPreview.amountInBase, baseCurrencyCode)}</strong>
                    </p>
                  </>
                ) : (
                  <p>Ingresa un monto de entrada para ver la conversión según la tasa del día.</p>
                )}
              </div>

              <div className="exchange-extra-grid">
                <label className="exchange-field">
                  <span>Cliente (opcional)</span>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Nombre de quien cambia"
                  />
                </label>
                <label className="exchange-field">
                  <span>Notas (opcional)</span>
                  <input
                    type="text"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Referencia u observación"
                  />
                </label>
              </div>

              <div className="exchange-form-actions">
                <button
                  type="button"
                  className="finance-btn finance-btn-secondary"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Limpiar
                </button>
                <button
                  type="submit"
                  className="finance-btn finance-btn-primary"
                  disabled={
                    submitting ||
                    !conversionPreview ||
                    'error' in conversionPreview ||
                    cashInCurrency === cashOutCurrency ||
                    !cashInMethodId ||
                    !cashOutMethodId
                  }
                >
                  {submitting ? 'Registrando...' : 'Registrar cambio'}
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="exchange-summary-card">
          <h3>Hoy</h3>
          <div className="exchange-summary-stats">
            <article>
              <span>Operaciones</span>
              <strong>{todaySummary.count}</strong>
            </article>
            <article>
              <span>Volumen ({baseCurrencyCode})</span>
              <strong>{formatMoney(todaySummary.volumeBase, baseCurrencyCode)}</strong>
            </article>
          </div>
          {todaySummary.byCurrency.length > 0 && (
            <div className="exchange-summary-flow">
              {todaySummary.byCurrency.map((row) => (
                <article key={row.currencyCode} className="exchange-summary-flow-row">
                  <span>{row.currencyCode}</span>
                  <div>
                    {row.cashIn > 0 && (
                      <small className="exchange-flow-in">
                        Entró {formatMoney(row.cashIn, row.currencyCode)}
                      </small>
                    )}
                    {row.cashOut > 0 && (
                      <small className="exchange-flow-out">
                        Salió {formatMoney(row.cashOut, row.currencyCode)}
                      </small>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
          <p className="exchange-summary-hint">
            Cada cambio guarda entrada, salida y forma de pago para el cierre de caja.
          </p>
        </aside>
      </div>

      <section className="finance-panel finance-panel-spaced" style={{ position: 'relative' }}>
        <div className="finance-panel-header">
          <div>
            <h2>Historial de cambios</h2>
            <p>Movimientos de caja por operación de cambio.</p>
          </div>
        </div>

        <div className="finance-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por moneda, método, cliente o cajero..."
          />
        </div>

        {loading ? (
          <div className="finance-empty">Cargando historial...</div>
        ) : filteredExchanges.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin operaciones registradas</strong>
            <p>Los cambios de moneda aparecerán aquí.</p>
          </div>
        ) : (
          <>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Entró a caja</th>
                    <th>Salió de caja</th>
                    <th>Tasa</th>
                    <th>Cliente</th>
                    <th>Cajero</th>
                    {canManage && <th aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {pagination.paginatedItems.map((exchange) => {
                    const inMeta = currencies.find(
                      (currency) => currency.code === exchange.cashInCurrency,
                    )
                    const outMeta = currencies.find(
                      (currency) => currency.code === exchange.cashOutCurrency,
                    )

                    return (
                      <tr key={exchange.id}>
                        <td>{formatDate(exchange.createdAt)}</td>
                        <td>
                          <strong>
                            {formatMoney(
                              exchange.cashInAmount,
                              exchange.cashInCurrency,
                              inMeta?.symbol,
                            )}
                          </strong>
                          <small className="exchange-method-hint">
                            {exchange.cashInMethodName}
                            {exchange.cashInReference ? ` · Ref. ${exchange.cashInReference}` : ''}
                          </small>
                        </td>
                        <td>
                          <strong>
                            {formatMoney(
                              exchange.cashOutAmount,
                              exchange.cashOutCurrency,
                              outMeta?.symbol,
                            )}
                          </strong>
                          <small className="exchange-method-hint">
                            {exchange.cashOutMethodName}
                            {exchange.cashOutReference ? ` · Ref. ${exchange.cashOutReference}` : ''}
                          </small>
                        </td>
                        <td className="exchange-rate-cell">{exchange.rateLabel}</td>
                        <td>{exchange.clientName || '—'}</td>
                        <td>{exchange.createdByName}</td>
                        {canManage && (
                          <td>
                            <TableActions>
                              <TableAction
                                icon="delete"
                                tone="danger"
                                disabled={deletingId === exchange.id}
                                onClick={() => handleDelete(exchange)}
                              >
                                Eliminar
                              </TableAction>
                            </TableActions>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              pageSize={pagination.pageSize}
              onPageChange={pagination.setPage}
            />
          </>
        )}
      </section>
    </AppLayout>
  )
}
