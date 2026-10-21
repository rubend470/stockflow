import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { MoneyText } from '../../../components/ui/MoneyText'
import { BarcodeScannerButton } from '../../../components/ui/BarcodeScannerButton'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import {
  createSalesOffer,
  deleteSalesOffer,
  listSalesOffers,
  setSalesOfferActive,
  updateSalesOffer,
} from '../../../services/offerService'
import { listProducts } from '../../../services/productService'
import {
  emptySalesOfferForm,
  salesOfferFormFromOffer,
  salesOfferTypeLabels,
  type SalesOffer,
  type SalesOfferFormInput,
  type SalesOfferType,
} from '../../../types/offer'
import type { Product } from '../../../types/product'
import { formatMoneyInputValue } from '../../../utils/formatMoney'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

export function CombosPromotionsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const { loading, refreshing, run } = usePanelLoader()
  const [offers, setOffers] = useState<SalesOffer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [formValues, setFormValues] = useState<SalesOfferFormInput>(() => emptySalesOfferForm())
  const [productCodeQuery, setProductCodeQuery] = useState('')
  const [editingOffer, setEditingOffer] = useState<SalesOffer | null>(null)
  const [filter, setFilter] = useState<'all' | SalesOfferType>('all')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = userHasMenuPermission(user, 'offers')
  const selectedProduct = products.find((product) => product.id === formValues.productId)

  const filteredOffers = useMemo(() => {
    if (filter === 'all') return offers
    return offers.filter((offer) => offer.type === filter)
  }, [offers, filter])

  useEffect(() => {
    if (canManage) void loadData()
  }, [canManage])

  async function loadData() {
    setError('')
    try {
      await run(async () => {
        const [offerList, productList] = await Promise.all([listSalesOffers(), listProducts()])
        setOffers(offerList)
        setProducts(productList)
      })
    } catch {
      setError('No se pudieron cargar combos y promociones.')
    }
  }

  function resetForm(type: SalesOfferType = formValues.type) {
    setEditingOffer(null)
    setFormValues(emptySalesOfferForm(type))
    setProductCodeQuery('')
  }

  function editOffer(offer: SalesOffer) {
    const product = products.find((item) => item.id === offer.productId)
    setEditingOffer(offer)
    setFormValues({
      ...salesOfferFormFromOffer(offer),
      price: formatMoneyInputValue(offer.price),
    })
    setProductCodeQuery(product?.barcode || product?.sku || '')
    setError('')
    setMessage('')
  }

  function selectProduct(product: Product, code = product.barcode || product.sku || '') {
    setFormValues((current) => ({ ...current, productId: product.id }))
    setProductCodeQuery(code)
    setError('')
  }

  function findProductByCode(code: string) {
    const query = code.trim().toLowerCase()
    if (!query) return undefined

    return products.find(
      (product) =>
        product.barcode?.trim().toLowerCase() === query ||
        product.sku?.trim().toLowerCase() === query,
    )
  }

  function handleProductCodeChange(value: string) {
    setProductCodeQuery(value)
    const product = findProductByCode(value)
    if (product) selectProduct(product, value)
  }

  function handleProductScan(code: string) {
    const product = findProductByCode(code)
    if (!product) {
      setProductCodeQuery(code)
      setError('No se encontró un producto con ese código para la oferta.')
      setMessage('')
      return
    }

    selectProduct(product, code)
    setMessage(`Producto "${product.name}" seleccionado para la oferta.`)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user || !canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (editingOffer) {
        await updateSalesOffer(editingOffer.id, formValues, products)
        setMessage('Oferta actualizada correctamente.')
      } else {
        await createSalesOffer(formValues, products, user.uid)
        setMessage('Oferta creada correctamente.')
      }

      resetForm(formValues.type)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la oferta.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(offer: SalesOffer) {
    setError('')
    setMessage('')

    try {
      await setSalesOfferActive(offer.id, !offer.active)
      setOffers((current) =>
        current.map((item) => (item.id === offer.id ? { ...item, active: !item.active } : item)),
      )
      setMessage(offer.active ? 'Oferta deshabilitada.' : 'Oferta habilitada.')
    } catch {
      setError('No se pudo cambiar el estado de la oferta.')
    }
  }

  async function handleDelete(offer: SalesOffer) {
    const confirmed = await confirm({
      title: 'Eliminar oferta',
      message: `¿Eliminar "${offer.name}"? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteSalesOffer(offer.id)
      setOffers((current) => current.filter((item) => item.id !== offer.id))
      if (editingOffer?.id === offer.id) resetForm()
      setMessage('Oferta eliminada.')
    } catch {
      setError('No se pudo eliminar la oferta.')
    }
  }

  if (!canManage) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Combos y promociones" subtitle="Ofertas aplicadas al punto de venta">
      <div className="cash-movements-layout">
        <AnimatedPanel className="finance-panel">
          <div className="finance-panel-header">
            <div>
              <h2>{editingOffer ? 'Editar oferta' : 'Nueva oferta'}</h2>
              <p>Define combos de precio total o promociones automáticas por cantidad.</p>
            </div>
          </div>

          <form className="expense-form" onSubmit={handleSubmit}>
            <label className="finance-field">
              <span>Tipo</span>
              <select
                value={formValues.type}
                onChange={(event) =>
                  setFormValues((current) => ({
                    ...current,
                    type: event.target.value as SalesOfferType,
                  }))
                }
              >
                <option value="combo">Combo</option>
                <option value="promotion">Promoción</option>
              </select>
            </label>

            <label className="finance-field">
              <span>Nombre</span>
              <input
                type="text"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Ej. Combo familiar pollo"
              />
            </label>

            <div className="finance-field">
              <span>Producto</span>
              <div className="barcode-input-row offer-product-scan-row">
                <input
                  type="search"
                  value={productCodeQuery}
                  onChange={(event) => handleProductCodeChange(event.target.value)}
                  placeholder="Escanear o escribir código"
                  autoComplete="off"
                />
                <BarcodeScannerButton label="Cámara" onDetected={handleProductScan} />
              </div>
              <select
                value={formValues.productId}
                onChange={(event) => {
                  const product = products.find((item) => item.id === event.target.value)
                  setFormValues((current) => ({ ...current, productId: event.target.value }))
                  setProductCodeQuery(product?.barcode || product?.sku || '')
                }}
              >
                <option value="">Selecciona producto</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.soldBy === 'weight' ? product.unitLabel : 'unidad'}
                  </option>
                ))}
              </select>
            </div>

            <div className="expense-form-grid">
              <label className="finance-field">
                <span>
                  {formValues.type === 'combo' ? 'Cantidad del combo' : 'Desde cantidad'}
                </span>
                <input
                  type="number"
                  min="0"
                  step={selectedProduct?.soldBy === 'weight' ? '0.001' : '1'}
                  value={formValues.quantity}
                  onChange={(event) =>
                    setFormValues((current) => ({ ...current, quantity: event.target.value }))
                  }
                  placeholder={selectedProduct?.soldBy === 'weight' ? '3.000' : '3'}
                />
              </label>

              <label className="finance-field">
                <span>{formValues.type === 'combo' ? 'Precio total' : 'Precio por unidad/kg'}</span>
                <MoneyInput
                  min="0"
                  value={formValues.price}
                  onChange={(value) =>
                    setFormValues((current) => ({ ...current, price: value }))
                  }
                  showCurrencyPrefix
                  blankWhenZero
                />
              </label>
            </div>

            <label className="finance-check-row">
              <input
                type="checkbox"
                checked={formValues.active}
                onChange={(event) =>
                  setFormValues((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>Oferta habilitada</span>
            </label>

            <div className="expense-form-actions">
              {editingOffer && (
                <button type="button" className="finance-btn finance-btn-secondary" onClick={() => resetForm()}>
                  Cancelar edición
                </button>
              )}
              <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : editingOffer ? 'Actualizar' : 'Crear oferta'}
              </button>
            </div>
          </form>
        </AnimatedPanel>

        <AnimatedPanel className="finance-panel panel-with-overlay">
          <PanelRefreshOverlay show={refreshing} />
          <div className="finance-panel-header">
            <div>
              <h2>Ofertas registradas</h2>
              <p>Las promociones activas se aplican solas; los combos aparecen en POS.</p>
            </div>
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadData}>
              Actualizar
            </button>
          </div>

          <div className="finance-filters finance-filters-row">
            <label className="finance-filter-field">
              <span>Tipo</span>
              <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
                <option value="all">Todas</option>
                <option value="combo">Combos</option>
                <option value="promotion">Promociones</option>
              </select>
            </label>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {message && <div className="alert alert-success">{message}</div>}

          {loading ? (
            <div className="finance-empty">Cargando ofertas...</div>
          ) : filteredOffers.length === 0 ? (
            <div className="finance-empty">
              <strong>Sin ofertas</strong>
              <p>Crea combos o promociones para aplicarlos en el punto de venta.</p>
            </div>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Oferta</th>
                    <th>Producto</th>
                    <th>Condición</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th className="table-actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOffers.map((offer, index) => (
                    <AnimatedTableRow key={offer.id} index={index}>
                      <td>
                        <strong>{offer.name}</strong>
                        <small className="expense-note">{salesOfferTypeLabels[offer.type]}</small>
                      </td>
                      <td>{offer.productName}</td>
                      <td>
                        {offer.type === 'combo' ? 'Combo de ' : 'Desde '}
                        {offer.quantity} {offer.unitLabel}
                      </td>
                      <td>
                        <MoneyText amount={offer.price} />
                        <small className="expense-note">
                          {offer.type === 'combo' ? 'total' : `por ${offer.unitLabel}`}
                        </small>
                      </td>
                      <td>
                        <span className={`finance-badge ${offer.active ? 'ok' : 'inactive'}`}>
                          {offer.active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction icon="edit" onClick={() => editOffer(offer)}>
                            Editar
                          </TableAction>
                          <TableAction icon="toggle" onClick={() => handleToggleActive(offer)}>
                            {offer.active ? 'Deshabilitar' : 'Habilitar'}
                          </TableAction>
                          <TableAction icon="delete" tone="danger" onClick={() => handleDelete(offer)}>
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
