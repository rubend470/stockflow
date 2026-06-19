import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CurrencyFormModal } from '../../../components/finance/CurrencyFormModal'
import { ExchangeRateFormModal } from '../../../components/finance/ExchangeRateFormModal'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  createCurrency,
  createExchangeRate,
  deleteCurrency,
  deleteExchangeRate,
  formatExchangeRateLabel,
  listAllCurrencies,
  listLatestExchangeRates,
  updateCurrency,
  updateExchangeRate,
} from '../../../services/financeService'
import {
  currencyFormFromCurrency,
  emptyCurrencyForm,
  emptyExchangeRateForm,
  exchangeRateFormFromRate,
  type Currency,
  type CurrencyFormInput,
  type ExchangeRate,
  type ExchangeRateFormInput,
} from '../../../types/finance'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function CurrenciesPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const { loading, refreshing, run } = usePanelLoader()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formValues, setFormValues] = useState<CurrencyFormInput>(emptyCurrencyForm())
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null)
  const [rateModalOpen, setRateModalOpen] = useState(false)
  const [rateModalMode, setRateModalMode] = useState<'create' | 'edit'>('create')
  const [editingRate, setEditingRate] = useState<ExchangeRate | null>(null)
  const [rateFormValues, setRateFormValues] = useState<ExchangeRateFormInput>(emptyExchangeRateForm())

  const canManage = userHasMenuPermission(user, 'currencies')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setError('')

    try {
      await run(async () => {
        const [currencyList, rateList] = await Promise.all([
          listAllCurrencies(),
          listLatestExchangeRates(),
        ])
        setCurrencies(currencyList)
        setRates(rateList)
      })
    } catch {
      setError('No se pudieron cargar las monedas.')
    }
  }

  const baseCurrency = useMemo(
    () => currencies.find((currency) => currency.isBase) ?? currencies[0],
    [currencies],
  )

  function openCreateModal() {
    setModalMode('create')
    setEditingCurrency(null)
    setFormValues(emptyCurrencyForm())
    setModalOpen(true)
  }

  function openEditModal(currency: Currency) {
    setModalMode('edit')
    setEditingCurrency(currency)
    setFormValues(currencyFormFromCurrency(currency))
    setModalOpen(true)
  }

  function openRateModal() {
    const firstForeign = currencies.find((currency) => !currency.isBase && currency.active)
    setRateModalMode('create')
    setEditingRate(null)
    setRateFormValues(
      emptyExchangeRateForm(firstForeign?.code ?? '', baseCurrency?.code ?? 'COP'),
    )
    setRateModalOpen(true)
  }

  function openEditRateModal(rate: ExchangeRate) {
    setRateModalMode('edit')
    setEditingRate(rate)
    setRateFormValues(exchangeRateFormFromRate(rate))
    setRateModalOpen(true)
  }

  async function handleSubmit(values: CurrencyFormInput) {
    if (!user || !canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (modalMode === 'create') {
        await createCurrency(values, user.uid)
        setMessage('Moneda creada correctamente.')
      } else if (editingCurrency) {
        await updateCurrency(editingCurrency.id, values)
        setMessage('Moneda actualizada correctamente.')
      }

      setModalOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la moneda.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(currency: Currency) {
    if (!canManage) return
    const confirmed = await confirm({
      title: 'Eliminar moneda',
      message: `¿Eliminar la moneda ${currency.code}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteCurrency(currency.id)
      setCurrencies((current) => current.filter((item) => item.id !== currency.id))
      setMessage(`Moneda ${currency.code} eliminada.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la moneda.')
    }
  }

  async function handleSaveRate(values: ExchangeRateFormInput) {
    if (!user || !canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (rateModalMode === 'create') {
        await createExchangeRate(values, user.uid)
        const operationLabel = values.operation === 'divide' ? 'dividir entre' : 'multiplicar por'
        setMessage(
          `Tasa guardada: ${values.fromCurrency} → ${values.toCurrency}, ${operationLabel} ${values.toAmount}.`,
        )
      } else if (editingRate) {
        await updateExchangeRate(editingRate.id, values)
        const operationLabel = values.operation === 'divide' ? 'dividir entre' : 'multiplicar por'
        setMessage(
          `Tasa actualizada: ${values.fromCurrency} → ${values.toCurrency}, ${operationLabel} ${values.toAmount}.`,
        )
      }

      setRateModalOpen(false)
      setEditingRate(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tasa.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteRate(rate: ExchangeRate) {
    if (!canManage) return

    const confirmed = await confirm({
      title: 'Eliminar tasa',
      message: `¿Eliminar la tasa ${formatExchangeRateLabel(rate)}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteExchangeRate(rate.id)
      setRates((current) => current.filter((item) => item.id !== rate.id))
      setMessage('Tasa eliminada correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la tasa.')
    }
  }

  if (!canManage) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Monedas y tasas" subtitle="Configuración multimoneda">
      <AnimatedPanel className="finance-panel panel-with-overlay">
        <PanelRefreshOverlay show={refreshing} />
        <div className="finance-panel-header">
          <div>
            <h2>Monedas del sistema</h2>
            <p>
              Moneda principal: <strong>{baseCurrency?.code ?? '—'}</strong>. Configura conversiones
              en ambos sentidos, por ejemplo USD → COP y COP → USD.
            </p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadData}>
              Actualizar
            </button>
            <button type="button" className="finance-btn finance-btn-secondary" onClick={openRateModal}>
              Nueva tasa
            </button>
            <button type="button" className="finance-btn finance-btn-primary" onClick={openCreateModal}>
              Nueva moneda
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando monedas...</div>
        ) : (
          <>
            <AnimatedPanel delay={1} className="finance-rates-card">
              <h3>Tasas de conversión</h3>
              <p>
                Cada tasa es independiente. Puedes definir montos como{' '}
                <strong>1 USD = 4000 COP</strong> y otra distinta para{' '}
                <strong>4000 COP = 1 USD</strong>.
              </p>

              {rates.length === 0 ? (
                <div className="finance-empty">
                  <strong>Sin tasas configuradas</strong>
                  <p>Agrega al menos una conversión hacia y desde {baseCurrency?.code ?? 'COP'}.</p>
                  <button type="button" className="finance-btn finance-btn-primary" onClick={openRateModal}>
                    Nueva tasa
                  </button>
                </div>
              ) : (
                <div className="finance-table-wrap">
                  <table className="finance-table">
                    <thead>
                      <tr>
                        <th>Conversión</th>
                        <th>Actualizado</th>
                        <th className="table-actions-col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rates.map((rate, index) => (
                        <AnimatedTableRow key={rate.id} index={index}>
                          <td>
                            <strong>{formatExchangeRateLabel(rate)}</strong>
                          </td>
                          <td>{formatDate(rate.effectiveDate)}</td>
                          <td className="table-actions-col">
                            <TableActions>
                              <TableAction icon="edit" onClick={() => openEditRateModal(rate)}>
                                Editar
                              </TableAction>
                              <TableAction icon="delete" tone="danger" onClick={() => handleDeleteRate(rate)}>
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

            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Símbolo</th>
                    <th>Principal</th>
                    <th>Estado</th>
                    <th className="table-actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((currency, index) => (
                    <AnimatedTableRow key={currency.id} index={index}>
                      <td>
                        <strong>{currency.code}</strong>
                      </td>
                      <td>{currency.name}</td>
                      <td>{currency.symbol}</td>
                      <td>{currency.isBase ? 'Sí' : 'No'}</td>
                      <td>
                        <span className={`finance-badge ${currency.active ? 'ok' : 'inactive'}`}>
                          {currency.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction icon="edit" onClick={() => openEditModal(currency)}>
                            Editar
                          </TableAction>
                          {!currency.isBase && (
                            <TableAction icon="delete" tone="danger" onClick={() => handleDelete(currency)}>
                              Eliminar
                            </TableAction>
                          )}
                        </TableActions>
                      </td>
                    </AnimatedTableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </AnimatedPanel>

      <CurrencyFormModal
        open={modalOpen}
        mode={modalMode}
        initialValues={formValues}
        submitting={submitting}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <ExchangeRateFormModal
        open={rateModalOpen}
        mode={rateModalMode}
        currencies={currencies}
        baseCurrencyCode={baseCurrency?.code ?? 'COP'}
        initialValues={rateFormValues}
        submitting={submitting}
        onClose={() => {
          setRateModalOpen(false)
          setEditingRate(null)
        }}
        onSubmit={handleSaveRate}
      />
    </AppLayout>
  )
}
