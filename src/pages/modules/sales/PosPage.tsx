import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { CartPanel } from '../../../components/pos/CartPanel'
import {
  PostSaleHardwareDialog,
  type PostSaleHardwareAction,
} from '../../../components/pos/PostSaleHardwareDialog'
import { PosSection } from '../../../components/pos/PosSection'
import { PaymentSection } from '../../../components/pos/PaymentSection'
import { ProductSearchField } from '../../../components/pos/ProductSearchField'
import { QuickSaleItemModal } from '../../../components/pos/QuickSaleItemModal'
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
import {
  enqueueOfflineSale,
  isNetworkError,
  listOfflineQueuedSales,
  loadPosOfflineCache,
  savePosOfflineCache,
  syncOfflineQueuedSales,
  type OfflineQueuedSale,
} from '../../../services/posOfflineService'
import { getQzFriendlyError, openCashDrawer, printSaleTicket } from '../../../services/qzService'
import { listStockCategories } from '../../../services/stockCategoryService'
import { getAppSettings } from '../../../services/settingsService'
import type { StockCategory } from '../../../types/stockCategory'
import { enrichProductWithCategoryStock, enrichProductsWithCategoryStock, getCategoryMap } from '../../../utils/stockCategory'
import { createSale } from '../../../services/saleService'
import type { Client } from '../../../types/client'
import { pickDefaultPaymentMethod, type Currency, type ExchangeRate, type PaymentMethod } from '../../../types/finance'
import type { Product, SaleMode } from '../../../types/product'
import type { CartItem, CreateSaleInput, SalePaymentInput, SaleResult } from '../../../types/sale'
import type { AppSettings } from '../../../types/settings'
import {
  buildCartItem,
  buildQuickCartItem,
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
import { isValidPhone, normalizePhone } from '../../../utils/phone'
import {
  getDefaultQuantity,
  getDefaultSaleMode,
  getQuantityStep,
  needsSaleQuantityModal,
} from '../../../utils/productUnits'
import { barcodeMatches, normalizeBarcode } from '../../../utils/barcode'
import { userCanViewProfit, userHasAnyMenuPermission } from '../../../utils/menuPermissions'

interface PostSaleRequest {
  sale: SaleResult
  items: CartItem[]
  payments: SalePaymentInput[]
  settings: AppSettings
  cashierName: string
  baseCurrencyCode: string
}

interface OpenSaleDraft {
  id: string
  label: string
  createdAt: string
  updatedAt: string
  cart: CartItem[]
  payments: SalePaymentInput[]
  selectedCurrencyCode: string
  selectedMethodId: string
  paymentAmount: string
  paymentReference: string
  creditEnabled: boolean
  creditAmount: string
  creditName: string
  creditPhone: string
  mixedPayment: boolean
}

interface StoredOpenSaleDrafts {
  version: 1
  activeDraftId: string
  drafts: OpenSaleDraft[]
}

const OPEN_SALE_DRAFTS_VERSION = 1

function openSaleDraftsStorageKey(userId: string) {
  return `stockflow:open-sales:v${OPEN_SALE_DRAFTS_VERSION}:${userId}`
}

function normalizeStoredDrafts(value: unknown): StoredOpenSaleDrafts | null {
  if (!value || typeof value !== 'object') return null

  const parsed = value as Partial<StoredOpenSaleDrafts>
  if (!Array.isArray(parsed.drafts) || parsed.drafts.length === 0) return null

  const drafts = parsed.drafts.filter((draft): draft is OpenSaleDraft => {
    return Boolean(
      draft &&
        typeof draft.id === 'string' &&
        typeof draft.label === 'string' &&
        Array.isArray(draft.cart) &&
        Array.isArray(draft.payments),
    )
  })

  if (drafts.length === 0) return null

  const activeDraftId =
    typeof parsed.activeDraftId === 'string' &&
    drafts.some((draft) => draft.id === parsed.activeDraftId)
      ? parsed.activeDraftId
      : drafts[0].id

  return {
    version: OPEN_SALE_DRAFTS_VERSION,
    activeDraftId,
    drafts,
  }
}

function loadStoredOpenSaleDrafts(userId: string) {
  try {
    const raw = window.localStorage.getItem(openSaleDraftsStorageKey(userId))
    if (!raw) return null
    return normalizeStoredDrafts(JSON.parse(raw))
  } catch {
    return null
  }
}

function saveStoredOpenSaleDrafts(userId: string, payload: StoredOpenSaleDrafts) {
  try {
    window.localStorage.setItem(openSaleDraftsStorageKey(userId), JSON.stringify(payload))
  } catch {
    // El POS sigue funcionando aunque el navegador no permita persistencia local.
  }
}

function formatOfflineCacheDate(value: string) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function PosPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const postSaleResolveRef = useRef<((action: PostSaleHardwareAction) => void) | null>(null)
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
  const [pendingEntryMode, setPendingEntryMode] = useState<'quantity' | 'amount'>('quantity')
  const [pendingQuantity, setPendingQuantity] = useState('1')
  const [pendingAmount, setPendingAmount] = useState('')
  const [pendingError, setPendingError] = useState('')
  const [quickSaleOpen, setQuickSaleOpen] = useState(false)
  const [quickSaleName, setQuickSaleName] = useState('')
  const [quickSalePrice, setQuickSalePrice] = useState('')
  const [quickSaleError, setQuickSaleError] = useState('')
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
  const [postSaleRequest, setPostSaleRequest] = useState<PostSaleRequest | null>(null)
  const [postSaleBusy, setPostSaleBusy] = useState(false)
  const [postSaleError, setPostSaleError] = useState('')
  const [openSaleDrafts, setOpenSaleDrafts] = useState<OpenSaleDraft[]>([])
  const [activeDraftId, setActiveDraftId] = useState('')
  const [offlineSales, setOfflineSales] = useState<OfflineQueuedSale[]>([])
  const [offlineMode, setOfflineMode] = useState(false)
  const [syncingOfflineSales, setSyncingOfflineSales] = useState(false)
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const loadedDraftsUserRef = useRef('')
  const draftsReadyRef = useRef(false)
  const syncingOfflineSalesRef = useRef(false)

  const canViewProfit = userCanViewProfit(user)
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
  const activeDraft = useMemo(
    () => openSaleDrafts.find((draft) => draft.id === activeDraftId) ?? openSaleDrafts[0],
    [openSaleDrafts, activeDraftId],
  )

  function getDefaultDraftCurrency() {
    return baseCurrency?.code ?? DEFAULT_BASE_CURRENCY_CODE
  }

  function getDefaultDraftMethod() {
    return pickDefaultPaymentMethod(paymentMethods)?.id ?? ''
  }

  function getNextDraftLabel(drafts = openSaleDrafts) {
    return `Venta ${drafts.length + 1}`
  }

  function createOpenSaleDraft(label?: string): OpenSaleDraft {
    const now = new Date().toISOString()

    return {
      id: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: label ?? getNextDraftLabel(),
      createdAt: now,
      updatedAt: now,
      cart: [],
      payments: [],
      selectedCurrencyCode: getDefaultDraftCurrency(),
      selectedMethodId: getDefaultDraftMethod(),
      paymentAmount: '',
      paymentReference: '',
      creditEnabled: false,
      creditAmount: '',
      creditName: '',
      creditPhone: '',
      mixedPayment: false,
    }
  }

  function applyOpenSaleDraft(draft: OpenSaleDraft) {
    setCart(draft.cart)
    setPayments(draft.payments)
    setSelectedCurrencyCode(draft.selectedCurrencyCode || getDefaultDraftCurrency())
    setSelectedMethodId(draft.selectedMethodId || getDefaultDraftMethod())
    setPaymentAmount(draft.paymentAmount)
    setPaymentReference(draft.paymentReference)
    setCreditEnabled(draft.creditEnabled)
    setCreditAmount(draft.creditAmount)
    setCreditName(draft.creditName)
    setCreditPhone(draft.creditPhone)
    setMixedPayment(draft.mixedPayment)
  }

  function snapshotOpenSaleDraft(draft: OpenSaleDraft): OpenSaleDraft {
    return {
      ...draft,
      updatedAt: new Date().toISOString(),
      cart,
      payments,
      selectedCurrencyCode,
      selectedMethodId,
      paymentAmount,
      paymentReference,
      creditEnabled,
      creditAmount,
      creditName,
      creditPhone,
      mixedPayment,
    }
  }

  function hydrateOpenSaleDrafts(currencyList: Currency[], methodList: PaymentMethod[]) {
    if (!user || loadedDraftsUserRef.current === user.uid) return

    const base = getBaseCurrency(currencyList)?.code ?? DEFAULT_BASE_CURRENCY_CODE
    const methodId = pickDefaultPaymentMethod(methodList)?.id ?? ''
    const stored = loadStoredOpenSaleDrafts(user.uid)
    const fallbackDraft: OpenSaleDraft = {
      ...createOpenSaleDraft('Venta 1'),
      selectedCurrencyCode: base,
      selectedMethodId: methodId,
    }
    const drafts = stored?.drafts.length ? stored.drafts : [fallbackDraft]
    const activeId = stored?.activeDraftId && drafts.some((draft) => draft.id === stored.activeDraftId)
      ? stored.activeDraftId
      : drafts[0].id
    const draft = drafts.find((item) => item.id === activeId) ?? drafts[0]

    loadedDraftsUserRef.current = user.uid
    draftsReadyRef.current = true
    setOpenSaleDrafts(drafts)
    setActiveDraftId(activeId)
    applyOpenSaleDraft(draft)
  }

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

  const refreshOfflineSales = useCallback(() => {
    if (!user) {
      setOfflineSales([])
      return []
    }

    const queuedSales = listOfflineQueuedSales(user.uid)
    setOfflineSales(queuedSales)
    return queuedSales
  }, [user])

  const syncPendingOfflineSales = useCallback(async () => {
    if (!user || syncingOfflineSalesRef.current || !isOnline) return

    const pendingSales = listOfflineQueuedSales(user.uid)
    if (pendingSales.length === 0) {
      setOfflineSales([])
      return
    }

    syncingOfflineSalesRef.current = true
    setSyncingOfflineSales(true)

    try {
      const synced = await syncOfflineQueuedSales(user.uid, createSale)
      const remainingQueuedSales = refreshOfflineSales()

      if (synced.length > 0) {
        setSuccess(
          remainingQueuedSales.length > 0
            ? `${synced.length} venta(s) offline sincronizada(s). ${remainingQueuedSales.length} pendiente(s).`
            : `${synced.length} venta(s) offline sincronizada(s) con la nube.`,
        )
      }
    } finally {
      syncingOfflineSalesRef.current = false
      setSyncingOfflineSales(false)
    }
  }, [user, isOnline, refreshOfflineSales])

  const loadPosData = useCallback(async () => {
    if (!user) return

    setLoading(true)
    setError('')

    try {
      if (userHasAnyMenuPermission(user, ['settings', 'add-product'])) {
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
      setOfflineMode(false)
      savePosOfflineCache(user.uid, {
        products: productList,
        categories: categoryList,
        currencies: currencyList,
        paymentMethods: methodList,
        exchangeRates: rates,
        clients: clientList,
      })

      if (loadedDraftsUserRef.current !== user.uid) {
        hydrateOpenSaleDrafts(currencyList, methodList)
      }
    } catch {
      const cached = loadPosOfflineCache(user.uid)
      if (!cached) {
        setError('No se pudo cargar la venta. Revisa Firestore y las reglas de seguridad.')
        return
      }

      setClients(cached.clients)
      setCategories(cached.categories)
      setProducts(enrichProductsWithCategoryStock(cached.products, cached.categories))
      setCurrencies(cached.currencies)
      setPaymentMethods(cached.paymentMethods)
      setExchangeRates(cached.exchangeRates)
      setOfflineMode(true)
      setError(`Modo offline: usando datos guardados del ${formatOfflineCacheDate(cached.savedAt)}.`)

      if (loadedDraftsUserRef.current !== user.uid) {
        hydrateOpenSaleDrafts(cached.currencies, cached.paymentMethods)
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadPosData()
  }, [loadPosData])

  useEffect(() => {
    refreshOfflineSales()
  }, [refreshOfflineSales])

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
    }

    function handleOffline() {
      setIsOnline(false)
      setOfflineMode(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (!user || !isOnline) return

    void syncPendingOfflineSales()
  }, [user, isOnline, syncPendingOfflineSales])

  useEffect(() => {
    loadedDraftsUserRef.current = ''
    draftsReadyRef.current = false
    setOpenSaleDrafts([])
    setActiveDraftId('')
  }, [user?.uid])

  useEffect(() => {
    if (!draftsReadyRef.current || !activeDraftId) return

    setOpenSaleDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraftId ? snapshotOpenSaleDraft(draft) : draft,
      ),
    )
  }, [
    activeDraftId,
    cart,
    payments,
    selectedCurrencyCode,
    selectedMethodId,
    paymentAmount,
    paymentReference,
    creditEnabled,
    creditAmount,
    creditName,
    creditPhone,
    mixedPayment,
  ])

  useEffect(() => {
    if (!user || !draftsReadyRef.current || openSaleDrafts.length === 0) return

    saveStoredOpenSaleDrafts(user.uid, {
      version: OPEN_SALE_DRAFTS_VERSION,
      activeDraftId,
      drafts: openSaleDrafts,
    })
  }, [user, activeDraftId, openSaleDrafts])

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

  function getDraftSubtotal(draft: OpenSaleDraft) {
    return getCartTotals(draft.id === activeDraftId ? cart : draft.cart).subtotal
  }

  function getDraftLineCount(draft: OpenSaleDraft) {
    return draft.id === activeDraftId ? cart.length : draft.cart.length
  }

  function handleCreateOpenSaleDraft() {
    const draft = createOpenSaleDraft()
    setOpenSaleDrafts((current) => [...current, draft])
    setActiveDraftId(draft.id)
    applyOpenSaleDraft(draft)
    setError('')
    setSuccess('')
  }

  function handleSwitchOpenSaleDraft(id: string) {
    if (id === activeDraftId) return

    const target = openSaleDrafts.find((draft) => draft.id === id)
    if (!target) return

    setOpenSaleDrafts((current) =>
      current.map((draft) =>
        draft.id === activeDraftId ? snapshotOpenSaleDraft(draft) : draft,
      ),
    )
    setActiveDraftId(target.id)
    applyOpenSaleDraft(target)
    setError('')
    setSuccess('')
  }

  async function handleCloseOpenSaleDraft(draft: OpenSaleDraft) {
    const hasContent = getDraftLineCount(draft) > 0 || draft.payments.length > 0
    const confirmed = hasContent
      ? await confirm({
          title: 'Cerrar venta abierta',
          message: `¿Cerrar ${draft.label}? Se perderá su carrito pendiente en este dispositivo.`,
          confirmLabel: 'Sí, cerrar',
          tone: 'danger',
        })
      : true
    if (!confirmed) return

    const remainingDrafts = openSaleDrafts.filter((item) => item.id !== draft.id)
    const nextDraft = remainingDrafts[0] ?? createOpenSaleDraft('Venta 1')

    setOpenSaleDrafts(remainingDrafts.length > 0 ? remainingDrafts : [nextDraft])
    setActiveDraftId(nextDraft.id)

    if (draft.id === activeDraftId || remainingDrafts.length === 0) {
      applyOpenSaleDraft(nextDraft)
    }
  }

  function completeActiveOpenSaleDraft() {
    const remainingDrafts = openSaleDrafts.filter((draft) => draft.id !== activeDraftId)
    const nextDraft = remainingDrafts[0] ?? createOpenSaleDraft('Venta 1')

    setOpenSaleDrafts(remainingDrafts.length > 0 ? remainingDrafts : [nextDraft])
    setActiveDraftId(nextDraft.id)
    applyOpenSaleDraft(nextDraft)
  }

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
    setPendingEntryMode('quantity')
    setPendingQuantity(getDefaultQuantity(product, saleMode))
    setPendingAmount('')
    setPendingError('')
  }

  function addProductToCart(product: Product, quantity: number, saleMode: SaleMode, enteredAmount?: number) {
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

    const existing = enteredAmount === undefined ? findMergeableCartItem(cart, product, saleMode) : undefined
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
    setCart((current) => [...current, buildCartItem(product, quantity, saleMode, categoryName, enteredAmount)])
  }

  function handleProductSelect(product: Product) {
    if (needsSaleQuantityModal(product)) {
      openSaleModal(product)
      return
    }

    addProductToCart(product, 1, 'retail')
  }

  function openQuickSaleModal() {
    setQuickSaleName('')
    setQuickSalePrice('')
    setQuickSaleError('')
    setQuickSaleOpen(true)
  }

  function closeQuickSaleModal() {
    setQuickSaleOpen(false)
    setQuickSaleError('')
  }

  function confirmQuickSaleItem() {
    const name = quickSaleName.trim()
    const price = parseMoneyInput(quickSalePrice)

    if (!name) {
      setQuickSaleError('Ingresa el nombre del producto.')
      return
    }

    if (!price || price <= 0) {
      setQuickSaleError('Ingresa un precio final válido.')
      return
    }

    setCart((current) => [...current, buildQuickCartItem(name, price)])
    setSuccess(`Producto rápido "${name}" agregado al carrito.`)
    setError('')
    setQuickSaleOpen(false)
    setQuickSaleName('')
    setQuickSalePrice('')
    setQuickSaleError('')
  }

  async function handleSearchSubmit() {
    const trimmed = searchQuery.trim()
    const barcodeQuery = normalizeBarcode(searchQuery)
    if (!trimmed) return

    try {
      const byBarcode = await findProductByBarcode(barcodeQuery || trimmed)
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
          barcodeMatches(product.barcode, barcodeQuery),
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

    if (offlineMode || !isOnline) {
      const normalizedPhone = normalizePhone(trimmedPhone)
      const cachedClient = clients.find(
        (client) =>
          (client.phone && normalizePhone(client.phone) === normalizedPhone) ||
          client.name.toLowerCase() === trimmedName.toLowerCase(),
      )

      if (!cachedClient) {
        setError('Para vender a crédito offline, el cliente debe existir en este dispositivo.')
        return null
      }

      return buildCreditPayment({ ...cachedClient, phone: trimmedPhone }, amountInBase)
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

  function buildCreateSaleInput(salePayments: SalePaymentInput[]): CreateSaleInput | null {
    if (!user) return null
    const creditClient = salePayments.find((payment) => payment.isCredit && payment.clientId)
    return {
      cashierId: user.uid,
      cashierName: user.name,
      clientId: creditClient?.clientId,
      clientName: creditClient?.clientName,
      baseCurrency: baseCurrencyCode,
      exchangeRateSnapshot: buildExchangeRateSnapshot(exchangeRates, baseCurrencyCode),
      items: cart,
      payments: salePayments,
      canViewProfit,
    }
  }

  async function executeCreateSale(salePayments: SalePaymentInput[]) {
    if (!user) return

    const saleInput = buildCreateSaleInput(salePayments)
    if (!saleInput) return

    const creditClient = salePayments.find((payment) => payment.isCredit && payment.clientId)
    const soldItems = [...cart]

    const result = await createSale(saleInput)

    const hasCredit = salePayments.some((payment) => payment.isCredit)
    const clientLabel = creditClient?.clientName
    setSuccess(
      hasCredit
        ? `Venta ${result.saleNumber}${clientLabel ? ` · ${clientLabel}` : ''} por ${formatBaseMoney(result.total)}.`
        : `Venta ${result.saleNumber} registrada por ${formatBaseMoney(result.total)}.`,
    )

    const settings = await getAppSettings().catch<AppSettings>(() => ({
      businessName: 'StockFlow',
      address: '',
      phone: '',
      baseCurrency: baseCurrencyCode,
      taxEnabled: false,
      taxRate: 0,
      lowStockAlertEnabled: true,
    }))

    await requestPostSaleHardwareAction({
      sale: result,
      items: soldItems,
      payments: salePayments,
      settings,
      cashierName: user.name,
      baseCurrencyCode,
    })

    completeActiveOpenSaleDraft()
    await loadPosData()
  }

  function queueOfflineSale(salePayments: SalePaymentInput[]) {
    if (!user) return false

    const saleInput = buildCreateSaleInput(salePayments)
    if (!saleInput) return false

    const queuedSale = enqueueOfflineSale(user.uid, saleInput)
    const pendingCount = refreshOfflineSales().length
    const total = saleInput.items.reduce((sum, item) => sum + item.lineRevenue, 0)

    setOfflineMode(true)
    setSuccess(
      `Venta guardada offline por ${formatBaseMoney(total)}. Se sincronizará al volver internet. Pendientes: ${pendingCount}.`,
    )
    completeActiveOpenSaleDraft()

    if (queuedSale.status === 'pending' && isOnline) {
      void syncPendingOfflineSales()
    }

    return true
  }

  function requestPostSaleHardwareAction(request: PostSaleRequest) {
    setPostSaleRequest(request)
    setPostSaleBusy(false)
    setPostSaleError('')

    return new Promise<PostSaleHardwareAction>((resolve) => {
      postSaleResolveRef.current = resolve
    })
  }

  function closePostSaleDialog(action: PostSaleHardwareAction) {
    postSaleResolveRef.current?.(action)
    postSaleResolveRef.current = null
    setPostSaleRequest(null)
    setPostSaleBusy(false)
    setPostSaleError('')
  }

  async function handlePostSaleAction(action: PostSaleHardwareAction) {
    if (action === 'skip') {
      closePostSaleDialog(action)
      return
    }

    if (!postSaleRequest) return

    setPostSaleBusy(true)
    setPostSaleError('')

    try {
      if (action === 'print-ticket') {
        await printSaleTicket(postSaleRequest)
        setSuccess(`Ticket de venta ${postSaleRequest.sale.saleNumber} enviado a impresión.`)
      } else {
        await openCashDrawer()
        setSuccess(`Gaveta abierta para la venta ${postSaleRequest.sale.saleNumber}.`)
      }
      closePostSaleDialog(action)
    } catch (err) {
      setPostSaleError(getQzFriendlyError(err))
      setPostSaleBusy(false)
    }
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

    let salePayments: SalePaymentInput[] | null = null

    try {
      salePayments = await resolveSalePayments()
      if (!salePayments) {
        setSubmitting(false)
        return
      }

      if (offlineMode || !isOnline) {
        queueOfflineSale(salePayments)
        return
      }

      await executeCreateSale(salePayments)
    } catch (err) {
      if (salePayments && isNetworkError(err)) {
        queueOfflineSale(salePayments)
        return
      }
      setError(err instanceof Error ? err.message : 'No se pudo confirmar la venta.')
    } finally {
      setSubmitting(false)
    }
  }

  function confirmPendingProduct() {
    if (!pendingProduct) return

    const product = pendingProduct
    const saleMode = pendingSaleMode
    const canEnterAmount =
      saleMode === 'retail' && (product.soldBy === 'weight' || product.type === 'charcuteria')
    const enteredAmount = canEnterAmount && pendingEntryMode === 'amount' ? parseMoneyInput(pendingAmount) : undefined
    const quantity =
      enteredAmount === undefined ? Number(pendingQuantity) : Number((enteredAmount / product.salePrice).toFixed(3))

    if (enteredAmount !== undefined && (!enteredAmount || enteredAmount <= 0)) {
      setPendingError('Ingresa un importe válido.')
      return
    }

    if (!quantity || quantity <= 0) {
      setPendingError(enteredAmount === undefined ? 'Ingresa una cantidad válida.' : 'El importe es muy bajo para este producto.')
      return
    }

    if (!canAddProduct(product, cart, quantity, saleMode)) {
      const unit = saleMode === 'bundle' ? 'al mayor' : product.unitLabel
      setPendingError(`Stock insuficiente. Disponible: ${product.stock} ${product.unitLabel} (${unit}).`)
      return
    }

    addProductToCart(product, quantity, saleMode, enteredAmount)
    setPendingProduct(null)
    setPendingEntryMode('quantity')
    setPendingQuantity('1')
    setPendingAmount('')
    setPendingError('')
  }

  if (loading) {
    return (
      <AppLayout title="Venta" subtitle="Cargando catálogo y formas de pago..." contentClassName="app-content-pos">
        <div className="pos-loading">Preparando venta...</div>
      </AppLayout>
    )
  }

  const failedOfflineSales = offlineSales.filter((sale) => sale.status === 'failed').length
  const pendingOfflineSales = offlineSales.length

  return (
    <AppLayout title="Venta" subtitle="Registra ventas en mostrador" contentClassName="app-content-pos">
      <div className="pos-page pos-page-register">
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        {(offlineMode || pendingOfflineSales > 0) && (
          <div className="pos-offline-status">
            <div>
              <strong>{offlineMode ? 'Modo offline activo' : 'Ventas offline pendientes'}</strong>
              <span>
                {pendingOfflineSales > 0
                  ? `${pendingOfflineSales} venta(s) por sincronizar${
                      failedOfflineSales > 0 ? ` · ${failedOfflineSales} con error` : ''
                    }.`
                  : 'Las ventas se guardarán en este dispositivo hasta recuperar conexión.'}
              </span>
            </div>
            <button
              type="button"
              className="pos-btn pos-btn-secondary"
              onClick={syncPendingOfflineSales}
              disabled={syncingOfflineSales || pendingOfflineSales === 0 || !isOnline}
            >
              {syncingOfflineSales ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        )}

        <section className="pos-open-sales" aria-label="Ventas abiertas">
          <div className="pos-open-sales-header">
            <div>
              <strong>Ventas abiertas</strong>
              <p>
                Puedes dejar varias ventas pendientes y volver a ellas antes de confirmar.
              </p>
            </div>
            <button
              type="button"
              className="pos-btn pos-btn-primary"
              onClick={handleCreateOpenSaleDraft}
            >
              + Nueva venta
            </button>
          </div>

          <div className="pos-open-sales-list">
            {openSaleDrafts.map((draft) => {
              const isActive = draft.id === activeDraft?.id
              const lineCount = getDraftLineCount(draft)
              const draftSubtotal = getDraftSubtotal(draft)

              return (
                <article
                  key={draft.id}
                  className={`pos-open-sale-tab ${isActive ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="pos-open-sale-select"
                    onClick={() => handleSwitchOpenSaleDraft(draft.id)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <strong>{draft.label}</strong>
                    <span>
                      {lineCount} línea(s) · {formatBaseMoney(draftSubtotal)}
                    </span>
                  </button>
                  <div className="pos-open-sale-actions">
                    <button
                      type="button"
                      className="pos-link-btn danger"
                      onClick={() => handleCloseOpenSaleDraft(draft)}
                    >
                      Cerrar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <div className="pos-register-main">
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
            <button
              type="button"
              className="pos-btn pos-btn-secondary pos-btn-block pos-quick-sale-btn"
              onClick={openQuickSaleModal}
            >
              + Producto rápido
            </button>
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
        </div>

        <div className="pos-register-side">
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
      </div>

      <SaleProcessingOverlay open={submitting} />

      {pendingProduct && (
        <SaleQuantityModal
          product={pendingProduct}
          open
          saleMode={pendingSaleMode}
          entryMode={pendingEntryMode}
          quantity={pendingQuantity}
          amount={pendingAmount}
          error={pendingError}
          onSaleModeChange={setPendingSaleMode}
          onEntryModeChange={setPendingEntryMode}
          onQuantityChange={setPendingQuantity}
          onAmountChange={setPendingAmount}
          onConfirm={confirmPendingProduct}
          onClose={() => setPendingProduct(null)}
        />
      )}

      <QuickSaleItemModal
        open={quickSaleOpen}
        name={quickSaleName}
        price={quickSalePrice}
        error={quickSaleError}
        onNameChange={setQuickSaleName}
        onPriceChange={setQuickSalePrice}
        onConfirm={confirmQuickSaleItem}
        onClose={closeQuickSaleModal}
      />

      <PostSaleHardwareDialog
        open={postSaleRequest !== null}
        saleNumber={postSaleRequest?.sale.saleNumber}
        totalLabel={postSaleRequest ? formatBaseMoney(postSaleRequest.sale.total) : undefined}
        busy={postSaleBusy}
        error={postSaleError}
        onSelect={handlePostSaleAction}
      />
    </AppLayout>
  )
}
