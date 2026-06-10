import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { CartPanel } from '../../../components/pos/CartPanel'
import { PosSection } from '../../../components/pos/PosSection'
import { PaymentSection } from '../../../components/pos/PaymentSection'
import { ProductSearchField } from '../../../components/pos/ProductSearchField'
import { SaleProcessingOverlay } from '../../../components/pos/SaleProcessingOverlay'
import { SaleQuantityModal } from '../../../components/pos/SaleQuantityModal'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../../constants/currency'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  buildExchangeRateSnapshot,
  convertFromBaseForPayment,
  convertToBase,
  paymentCoversBaseTarget,
  ensureFinanceDefaults,
  findRateForConversion,
  formatExchangeRateLabel,
  getBaseCurrency,
  listCurrencies,
  listLatestExchangeRates,
  listPaymentMethods,
} from '../../../services/financeService'
import { findOrCreateClientForCredit, getFrequentCreditClients, listClients } from '../../../services/clientService'
import { findProductByBarcode, listProducts, seedSampleProducts } from '../../../services/productService'
import { listStockCategories } from '../../../services/stockCategoryService'
import type { StockCategory } from '../../../types/stockCategory'
import { enrichProductWithCategoryStock, enrichProductsWithCategoryStock, getCategoryMap } from '../../../utils/stockCategory'
import { createSale } from '../../../services/saleService'
import type { Client } from '../../../types/client'
import { pickDefaultPaymentMethod, type Currency, type ExchangeRate, type PaymentMethod } from '../../../types/finance'
import type { Product, SaleMode } from '../../../types/product'
import type { CartItem, SalePaymentInput } from '../../../types/sale'
import {
  buildCartItem,
  canAddProduct,
  findMergeableCartItem,
  getCartTotals,
  removeCartItem,
  updateCartItemQuantity,
} from '../../../utils/cart'
import {
  formatBaseMoney,
  formatMoneyInputValue,
  parseMoneyInput,
  roundMoney,
} from '../../../utils/formatMoney'
import { isValidPhone } from '../../../utils/phone'
import {
  getDefaultQuantity,
  getDefaultSaleMode,
  getQuantityStep,
  needsSaleQuantityModal,
} from '../../../utils/productUnits'

export function PosPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<StockCategory[]>([])
  const categoryMap = useMemo(() => getCategoryMap(categories), [categories])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [payments, setPayments] = useState<SalePaymentInput[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCurrencyCode, setSelectedCurrencyCode] = useState(DEFAULT_BASE_CURRENCY_CODE)
  const [selectedMethodId, setSelectedMethodId] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentReference, setPaymentReference] = useState('')
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [pendingSaleMode, setPendingSaleMode] = useState<SaleMode>('retail')
  const [pendingQuantity, setPendingQuantity] = useState('1')
  const [pendingError, setPendingError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [creditEnabled, setCreditEnabled] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditName, setCreditName] = useState('')
  const [creditPhone, setCreditPhone] = useState('')
  const [creditSubmitting, setCreditSubmitting] = useState(false)
  const [mixedPayment, setMixedPayment] = useState(false)

  const canViewProfit = user?.role !== 'cashier'
  const baseCurrency = useMemo(() => getBaseCurrency(currencies), [currencies])
  const baseCurrencyCode = baseCurrency?.code ?? DEFAULT_BASE_CURRENCY_CODE
  const { subtotal } = useMemo(() => getCartTotals(cart), [cart])
  const totalPaid = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.amountInBase, 0),
    [payments],
  )
  const remaining = Math.max(subtotal - totalPaid, 0)
  const canConfirm = cart.length > 0 && (mixedPayment ? remaining <= 0.01 : true)
  const canCredit = cart.length > 0
  const frequentCreditClients = useMemo(() => getFrequentCreditClients(clients), [clients])

  const conversionRateLabel = useMemo(() => {
    if (selectedCurrencyCode === baseCurrencyCode) return null

    const toPayment = findRateForConversion(
      baseCurrencyCode,
      selectedCurrencyCode,
      exchangeRates,
    )
    if (toPayment) return formatExchangeRateLabel(toPayment)

    const toBase = findRateForConversion(
      selectedCurrencyCode,
      baseCurrencyCode,
      exchangeRates,
    )
    if (toBase) return formatExchangeRateLabel(toBase)

    return null
  }, [selectedCurrencyCode, baseCurrencyCode, exchangeRates])

  const paymentEquivalentBase = useMemo(() => {
    const amount = parseMoneyInput(paymentAmount)
    if (!amount || amount <= 0 || selectedCurrencyCode === baseCurrencyCode) return null

    try {
      return convertToBase(amount, selectedCurrencyCode, baseCurrencyCode, exchangeRates)
    } catch {
      return null
    }
  }, [paymentAmount, selectedCurrencyCode, baseCurrencyCode, exchangeRates])

  const loadPosData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      if (user.role === 'super_admin' || user.role === 'admin') {
        await ensureFinanceDefaults(user.uid)
        await seedSampleProducts(user.uid)
      }

      const [productList, currencyList, methodList, rates, clientList, categoryList] = await Promise.all([
        listProducts(),
        listCurrencies(),
        listPaymentMethods(),
        listLatestExchangeRates(),
        listClients(),
        listStockCategories(),
      ])

      setClients(clientList)
      setCategories(categoryList)
      setProducts(enrichProductsWithCategoryStock(productList, categoryList))
      setCurrencies(currencyList)
      setPaymentMethods(methodList)
      setExchangeRates(rates)

      const base = getBaseCurrency(currencyList)
      setSelectedCurrencyCode(base?.code ?? DEFAULT_BASE_CURRENCY_CODE)
      setSelectedMethodId(pickDefaultPaymentMethod(methodList)?.id ?? '')
    } catch {
      setError('No se pudo cargar la venta. Revisa Firestore y las reglas de seguridad.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPosData()
  }, [loadPosData])

  useEffect(() => {
    if (mixedPayment || subtotal <= 0) return

    const creditInBase = creditEnabled ? parseMoneyInput(creditAmount) ?? 0 : 0
    const pendingInBase = Math.max(subtotal - totalPaid - creditInBase, 0)

    if (pendingInBase <= 0.01) {
      setPaymentAmount('')
      return
    }

    try {
      const amountInCurrency = convertFromBaseForPayment(
        pendingInBase,
        selectedCurrencyCode,
        baseCurrencyCode,
        exchangeRates,
      )
      setPaymentAmount(formatMoneyInputValue(amountInCurrency))
    } catch {
      setPaymentAmount('')
    }
  }, [
    mixedPayment,
    creditEnabled,
    creditAmount,
    subtotal,
    totalPaid,
    selectedCurrencyCode,
    baseCurrencyCode,
    exchangeRates,
  ])

  function resetCreditFields() {
    setCreditEnabled(false)
    setCreditAmount('')
    setCreditName('')
    setCreditPhone('')
  }

  function handleCreditEnabledChange(enabled: boolean) {
    setCreditEnabled(enabled)
    setError('')
    if (enabled) {
      const target = mixedPayment ? remaining : Math.max(subtotal - totalPaid, 0)
      setCreditAmount(formatMoneyInputValue(target))
    } else {
      setCreditAmount('')
      setCreditName('')
      setCreditPhone('')
    }
  }

  function handleUseFullCredit() {
    const target = mixedPayment ? remaining : Math.max(subtotal - totalPaid, 0)
    if (target <= 0) return
    setCreditAmount(formatMoneyInputValue(target))
  }

  function openSaleModal(product: Product) {
    const saleMode = getDefaultSaleMode(product)
    setPendingProduct(product)
    setPendingSaleMode(saleMode)
    setPendingQuantity(getDefaultQuantity(product, saleMode))
    setPendingError('')
  }

  function addProductToCart(product: Product, quantity: number, saleMode: SaleMode) {
    if (quantity <= 0) {
      setError('La cantidad debe ser mayor a cero.')
      return
    }

    if (!canAddProduct(product, cart, quantity, saleMode)) {
      setError(`Stock insuficiente para ${product.name}.`)
      return
    }

    setError('')
    setSuccess('')
    setSearchQuery('')

    const existing = findMergeableCartItem(cart, product, saleMode)
    if (existing) {
      const nextQty = Number((existing.quantity + quantity).toFixed(3))
      if (!canAddProduct(product, cart, quantity, saleMode)) {
        setError(`Stock insuficiente para ${product.name}.`)
        return
      }
      setCart(updateCartItemQuantity(cart, existing.key, nextQty))
      return
    }

    const categoryName = product.stockCategoryId
      ? categoryMap.get(product.stockCategoryId)?.name
      : undefined
    setCart((current) => [...current, buildCartItem(product, quantity, saleMode, categoryName)])
  }

  function handleProductSelect(product: Product) {
    if (needsSaleQuantityModal(product)) {
      openSaleModal(product)
      return
    }

    addProductToCart(product, 1, 'retail')
  }

  async function handleSearchSubmit() {
    const trimmed = searchQuery.trim()
    if (!trimmed) return

    try {
      const byBarcode = await findProductByBarcode(trimmed)
      if (byBarcode) {
        const enriched =
          products.find((product) => product.id === byBarcode.id) ??
          enrichProductWithCategoryStock(byBarcode, categoryMap)
        handleProductSelect(enriched)
        return
      }

      const matches = products.filter(
        (product) =>
          product.name.toLowerCase().includes(trimmed.toLowerCase()) ||
          product.barcode === trimmed,
      )

      if (matches.length === 1) {
        handleProductSelect(matches[0])
        return
      }

      if (matches.length > 1) {
        setError('Hay varios productos. Elige uno de la lista.')
        return
      }

      setError('Producto no encontrado.')
    } catch {
      setError('Error al buscar el producto.')
    }
  }

  function handleIncrease(key: string) {
    const item = cart.find((entry) => entry.key === key)
    if (!item) return

    const product = products.find((entry) => entry.id === item.productId)
    if (!product) return

    const step = getQuantityStep(item.soldBy, item.saleMode)
    const nextQty = Number((item.quantity + step).toFixed(3))

    if (!canAddProduct(product, cart, step, item.saleMode)) {
      setError(`Stock insuficiente para ${item.productName}.`)
      return
    }

    setCart(updateCartItemQuantity(cart, key, nextQty))
  }

  function handleDecrease(key: string) {
    const item = cart.find((entry) => entry.key === key)
    if (!item) return

    const step = getQuantityStep(item.soldBy, item.saleMode)
    const nextQty = Number((item.quantity - step).toFixed(3))
    setCart(updateCartItemQuantity(cart, key, nextQty))
  }

  function handleRemove(key: string) {
    setCart(removeCartItem(cart, key))
  }

  function buildFormPayment(
    targetInBase: number,
    options: { allowPartial?: boolean } = {},
  ): SalePaymentInput | null {
    const method = paymentMethods.find((entry) => entry.id === selectedMethodId)

    if (!method) {
      setError('Selecciona una forma de pago.')
      return null
    }

    const acceptsCurrency =
      method.allowedCurrencies.length === 0 ||
      method.allowedCurrencies.includes(selectedCurrencyCode)

    if (!acceptsCurrency) {
      setError('Esta forma de pago no acepta la moneda seleccionada.')
      return null
    }

    if (method.requiresReference && !paymentReference.trim()) {
      setError('Esta forma de pago requiere referencia.')
      return null
    }

    let amount = parseMoneyInput(paymentAmount)
    let amountInBase = 0

    try {
      if (!amount || amount <= 0) {
        if (options.allowPartial) {
          setError('Ingresa un monto mayor a cero.')
          return null
        }

        amount = convertFromBaseForPayment(
          targetInBase,
          selectedCurrencyCode,
          baseCurrencyCode,
          exchangeRates,
        )
      }

      amountInBase = convertToBase(
        amount,
        selectedCurrencyCode,
        baseCurrencyCode,
        exchangeRates,
      )

      if (
        !options.allowPartial &&
        paymentCoversBaseTarget(
          amount,
          amountInBase,
          targetInBase,
          selectedCurrencyCode,
          baseCurrencyCode,
          exchangeRates,
        )
      ) {
        amountInBase = roundMoney(Math.max(amountInBase, targetInBase))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hay tasa para esta moneda.')
      return null
    }

    if (options.allowPartial) {
      if (amountInBase > targetInBase + 0.001) {
        setError(`El monto supera lo pendiente (${formatBaseMoney(targetInBase)}).`)
        return null
      }
    } else if (
      !paymentCoversBaseTarget(
        amount,
        amountInBase,
        targetInBase,
        selectedCurrencyCode,
        baseCurrencyCode,
        exchangeRates,
      )
    ) {
      setError(`El monto no cubre el total. Faltan ${formatBaseMoney(targetInBase - amountInBase)}.`)
      return null
    }

    return {
      methodId: method.id,
      methodName: method.name,
      currencyCode: selectedCurrencyCode,
      amount,
      amountInBase,
      reference: paymentReference.trim() || undefined,
    }
  }

  function handleAddPayment() {
    const pendingInBase = remaining > 0.01 ? remaining : subtotal

    if (pendingInBase <= 0.01) {
      setError('El total de la venta ya está cubierto.')
      return
    }

    const payment = buildFormPayment(pendingInBase, { allowPartial: true })
    if (!payment) return

    setPayments((current) => [...current, payment])
    setPaymentReference('')
    setError('')

    const nextPending = pendingInBase - payment.amountInBase
    if (nextPending <= 0.01) {
      setPaymentAmount('')
      return
    }

    try {
      const amountInCurrency = convertFromBaseForPayment(
        nextPending,
        selectedCurrencyCode,
        baseCurrencyCode,
        exchangeRates,
      )
      setPaymentAmount(formatMoneyInputValue(amountInCurrency))
    } catch {
      setPaymentAmount('')
    }
  }

  async function buildInlineCreditPayment(): Promise<SalePaymentInput | null> {
    if (!creditEnabled) return null

    const amountInBase = parseMoneyInput(creditAmount)
    if (!amountInBase || amountInBase <= 0) {
      setError('Ingresa el monto a crédito.')
      return null
    }

    const maxCredit = mixedPayment ? remaining : Math.max(subtotal - totalPaid, 0)
    if (amountInBase > maxCredit + 0.01) {
      setError(`El crédito no puede superar ${formatBaseMoney(maxCredit)}.`)
      return null
    }

    const trimmedName = creditName.trim()
    const trimmedPhone = creditPhone.trim()

    if (!trimmedName) {
      setError('Ingresa el nombre de quien compra a crédito.')
      return null
    }

    if (!isValidPhone(trimmedPhone)) {
      setError('Ingresa un teléfono válido para el crédito.')
      return null
    }

    try {
      const client = await findOrCreateClientForCredit(trimmedName, trimmedPhone, clients)
      setClients((current) => {
        if (current.some((entry) => entry.id === client.id)) {
          return current.map((entry) => (entry.id === client.id ? client : entry))
        }
        return [...current, client].sort((a, b) => a.name.localeCompare(b.name, 'es'))
      })

      return buildCreditPayment(client, amountInBase)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el cliente del crédito.')
      return null
    }
  }

  async function resolveSalePayments(): Promise<SalePaymentInput[] | null> {
    let workingPayments = [...payments]

    if (creditEnabled) {
      const inlineCredit = await buildInlineCreditPayment()
      if (!inlineCredit) return null
      workingPayments = [...workingPayments, inlineCredit]
    }

    const paidTotal = workingPayments.reduce((sum, payment) => sum + payment.amountInBase, 0)
    const pendingInBase = Math.max(subtotal - paidTotal, 0)

    if (mixedPayment) {
      if (pendingInBase > 0.01) {
        setError('Agrega los pagos hasta cubrir el total de la venta.')
        return null
      }
      return workingPayments
    }

    if (pendingInBase <= 0.01) {
      return workingPayments
    }

    const formPayment = buildFormPayment(pendingInBase)
    if (!formPayment) return null

    return [...workingPayments, formPayment]
  }

  function handleMixedPaymentChange(enabled: boolean) {
    setMixedPayment(enabled)
    setError('')
    if (!enabled) {
      setPayments((current) => current.filter((payment) => payment.isCredit))
    }
  }

  async function handleAddInlineCredit() {
    if (!creditEnabled) return

    setCreditSubmitting(true)
    setError('')

    try {
      const creditPayment = await buildInlineCreditPayment()
      if (!creditPayment) return

      setPayments((current) => [...current, creditPayment])
      resetCreditFields()
      setSuccess(
        `Crédito de ${formatBaseMoney(creditPayment.amountInBase)} agregado para ${creditPayment.clientName}.`,
      )
    } finally {
      setCreditSubmitting(false)
    }
  }

  function handlePayExactRemaining() {
    const creditInBase = creditEnabled ? parseMoneyInput(creditAmount) ?? 0 : 0
    const cashTarget = Math.max(remaining - creditInBase, 0)
    if (cashTarget <= 0) {
      setPaymentAmount('')
      return
    }

    try {
      const amountInSelectedCurrency = convertFromBaseForPayment(
        cashTarget,
        selectedCurrencyCode,
        baseCurrencyCode,
        exchangeRates,
      )
      setPaymentAmount(formatMoneyInputValue(amountInSelectedCurrency))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No hay tasa para esta moneda.')
    }
  }

  function buildCreditPayment(client: Client, amountInBase: number): SalePaymentInput | null {
    const creditTarget = mixedPayment
      ? remaining
      : Math.max(subtotal - totalPaid, 0)

    if (amountInBase > creditTarget + 0.01) {
      setError(`El crédito no puede superar ${formatBaseMoney(creditTarget)}.`)
      return null
    }

    if (client.creditLimit > 0 && client.balance + amountInBase > client.creditLimit + 0.01) {
      setError(
        `El crédito de ${client.name} excede su límite disponible (${formatBaseMoney(client.creditLimit - client.balance)}).`,
      )
      return null
    }

    return {
      methodId: 'credit',
      methodName: 'Crédito',
      currencyCode: baseCurrencyCode,
      amount: amountInBase,
      amountInBase,
      isCredit: true,
      clientId: client.id,
      clientName: client.name,
    }
  }

  function handleRemovePayment(index: number) {
    setPayments((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function executeCreateSale(salePayments: SalePaymentInput[]) {
    if (!user) return

    const creditClient = salePayments.find((payment) => payment.isCredit && payment.clientId)

    const result = await createSale({
      cashierId: user.uid,
      cashierName: user.name,
      clientId: creditClient?.clientId,
      clientName: creditClient?.clientName,
      baseCurrency: baseCurrencyCode,
      exchangeRateSnapshot: buildExchangeRateSnapshot(exchangeRates, baseCurrencyCode),
      items: cart,
      payments: salePayments,
      canViewProfit,
    })

    const hasCredit = salePayments.some((payment) => payment.isCredit)
    const clientLabel = creditClient?.clientName
    setSuccess(
      hasCredit
        ? `Venta ${result.saleNumber}${clientLabel ? ` · ${clientLabel}` : ''} por ${formatBaseMoney(result.total)}.`
        : `Venta ${result.saleNumber} registrada por ${formatBaseMoney(result.total)}.`,
    )
    setCart([])
    setPayments([])
    setPaymentAmount('')
    setPaymentReference('')
    setMixedPayment(false)
    resetCreditFields()
    await loadPosData()
  }

  async function handleConfirmSale() {
    if (!user || !canConfirm) return

    const creditClientName =
      payments.find((payment) => payment.isCredit)?.clientName ||
      (creditEnabled ? creditName.trim() : '')
    const confirmed = await confirm({
      title: 'Confirmar venta',
      message: creditClientName
        ? `¿Registrar la venta por ${formatBaseMoney(subtotal)} con crédito para ${creditClientName}?`
        : `¿Registrar la venta por ${formatBaseMoney(subtotal)}?`,
      confirmLabel: 'Sí, confirmar venta',
      tone: 'success',
    })
    if (!confirmed) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const salePayments = await resolveSalePayments()
      if (!salePayments) {
        setSubmitting(false)
        return
      }
      await executeCreateSale(salePayments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la venta.')
    } finally {
      setSubmitting(false)
    }
  }

  function confirmPendingProduct() {
    if (!pendingProduct) return

    const quantity = Number(pendingQuantity)
    if (!quantity || quantity <= 0) {
      setPendingError('Ingresa una cantidad válida.')
      return
    }

    const product = pendingProduct
    const saleMode = pendingSaleMode

    if (!canAddProduct(product, cart, quantity, saleMode)) {
      const unit = saleMode === 'bundle' ? 'al mayor' : product.unitLabel
      setPendingError(`Stock insuficiente. Disponible: ${product.stock} ${product.unitLabel} (${unit}).`)
      return
    }

    addProductToCart(product, quantity, saleMode)
    setPendingProduct(null)
    setPendingQuantity('1')
    setPendingError('')
  }

  if (loading) {
    return (
      <AppLayout title="Venta" subtitle="Cargando catálogo y formas de pago..." contentClassName="app-content-pos">
        <div className="pos-loading">Preparando venta...</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="Venta" subtitle="Registra ventas en mostrador" contentClassName="app-content-pos">
      <div className="pos-page pos-page-stack">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <PosSection
          step={1}
          title="Buscar producto"
          hint="Escanea el código o escribe el nombre"
          tone="green"
        >
          <ProductSearchField
            value={searchQuery}
            products={products}
            onChange={setSearchQuery}
            onSubmit={handleSearchSubmit}
            onSelectProduct={handleProductSelect}
          />
        </PosSection>

        <PosSection
          step={2}
          title="Productos agregados"
          hint={`${cart.length} línea(s) en el carrito`}
          tone="blue"
        >
          <CartPanel
            items={cart}
            onIncrease={handleIncrease}
            onDecrease={handleDecrease}
            onRemove={handleRemove}
            subtotal={subtotal}
          />
        </PosSection>

        <PosSection
          step={3}
          title="Cobro"
          hint="Efectivo, transferencia o crédito"
          tone="amber"
        >
          <PaymentSection
          currencies={currencies}
          paymentMethods={paymentMethods}
          baseCurrencyCode={baseCurrencyCode}
          selectedCurrencyCode={selectedCurrencyCode}
          conversionRateLabel={conversionRateLabel}
          paymentEquivalentBase={paymentEquivalentBase}
          selectedMethodId={selectedMethodId}
          paymentAmount={paymentAmount}
          paymentReference={paymentReference}
          payments={payments}
          totalDue={subtotal}
          remaining={remaining}
          mixedPayment={mixedPayment}
          canCredit={canCredit}
          creditEnabled={creditEnabled}
          creditAmount={creditAmount}
          creditName={creditName}
          creditPhone={creditPhone}
          frequentCreditClients={frequentCreditClients}
          onCreditEnabledChange={handleCreditEnabledChange}
          onCreditAmountChange={setCreditAmount}
          onCreditNameChange={setCreditName}
          onCreditPhoneChange={setCreditPhone}
          onUseFullCredit={handleUseFullCredit}
          onAddCreditPayment={mixedPayment ? handleAddInlineCredit : undefined}
          creditSubmitting={creditSubmitting}
          onMixedPaymentChange={handleMixedPaymentChange}
          onCurrencyChange={setSelectedCurrencyCode}
          onMethodChange={setSelectedMethodId}
          onAmountChange={setPaymentAmount}
          onReferenceChange={setPaymentReference}
          onUseTotalAmount={handlePayExactRemaining}
          onAddPayment={handleAddPayment}
          onRemovePayment={handleRemovePayment}
          onConfirmSale={handleConfirmSale}
          submitting={submitting}
          canConfirm={canConfirm}
          error={error}
          />
        </PosSection>
      </div>

      <SaleProcessingOverlay open={submitting} />

      {pendingProduct && (
        <SaleQuantityModal
          product={pendingProduct}
          open
          saleMode={pendingSaleMode}
          quantity={pendingQuantity}
          error={pendingError}
          onSaleModeChange={setPendingSaleMode}
          onQuantityChange={setPendingQuantity}
          onConfirm={confirmPendingProduct}
          onClose={() => setPendingProduct(null)}
        />
      )}
    </AppLayout>
  )
}
