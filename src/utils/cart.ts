import type { Product, SaleMode } from '../types/product'
import type { SalesOffer } from '../types/offer'
import type { CartItem } from '../types/sale'
import { formatBaseMoney, roundMoney } from './formatMoney'
import { getStockQuantity, productAllowsBundle } from './productUnits'

export function buildCartItem(
  product: Product,
  quantity: number,
  saleMode: SaleMode,
  categoryName?: string,
  enteredAmount?: number,
  offer?: SalesOffer,
  customUnitPrice?: number,
): CartItem {
  const isBundle = saleMode === 'bundle'
  const isCombo = offer?.type === 'combo'

  const originalUnitPrice = roundMoney(isBundle ? product.bundleSalePrice ?? 0 : product.salePrice)
  const manualUnitPrice =
    !isCombo && customUnitPrice !== undefined && roundMoney(customUnitPrice) !== originalUnitPrice
  const unitPrice =
    isCombo && quantity > 0
      ? roundMoney(offer.price / quantity)
      : manualUnitPrice
        ? roundMoney(customUnitPrice)
        : originalUnitPrice
  const unitCost = roundMoney(isBundle ? product.bundleCostPrice ?? 0 : product.costPrice)
  const unitLabel = product.unitLabel
  const stockQuantity = getStockQuantity(product, quantity, saleMode)
  const pricedQuantity = isBundle ? stockQuantity : quantity
  const lineCost = roundMoney(unitCost * stockQuantity)
  const normalRevenue = roundMoney(originalUnitPrice * pricedQuantity)
  const lineRevenue =
    isCombo && offer
      ? roundMoney(offer.price)
      : enteredAmount === undefined
        ? roundMoney(unitPrice * pricedQuantity)
        : roundMoney(enteredAmount)

  return {
    key: `${product.id}-${saleMode}-${offer?.id ?? 'normal'}-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    barcode: product.barcode,
    saleMode,
    soldBy: product.soldBy,
    unitLabel,
    unitsPerBundle: product.unitsPerBundle,
    quantity,
    stockQuantity,
    unitCost,
    unitPrice,
    originalUnitPrice,
    manualUnitPrice,
    saleLossPerUnit: saleMode === 'retail' && product.hasSaleLoss ? product.saleLossPerUnit ?? 0 : 0,
    enteredAmount,
    offerId: offer?.id,
    offerType: offer?.type,
    offerName: offer?.name,
    discountAmount: offer ? roundMoney(Math.max(normalRevenue - lineRevenue, 0)) : undefined,
    lineCost,
    lineRevenue,
    lineProfit: roundMoney(lineRevenue - lineCost),
    stockAvailable: product.stock,
    stockCategoryId: product.stockCategoryId,
    stockCategoryName: categoryName,
  }
}

export function buildQuickCartItem(name: string, finalPrice: number): CartItem {
  const price = roundMoney(finalPrice)

  return {
    key: `quick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: `quick-${Date.now()}`,
    productName: name.trim(),
    isQuickItem: true,
    saleMode: 'retail',
    soldBy: 'unit',
    unitLabel: 'venta',
    quantity: 1,
    stockQuantity: 0,
    unitCost: 0,
    unitPrice: price,
    originalUnitPrice: price,
    lineCost: 0,
    lineRevenue: price,
    lineProfit: price,
    stockAvailable: 0,
  }
}

export function getCartStockUsed(cart: CartItem[], productId: string, stockCategoryId?: string) {
  if (stockCategoryId) {
    return cart
      .filter((item) => item.stockCategoryId === stockCategoryId)
      .reduce((sum, item) => sum + item.stockQuantity, 0)
  }

  return cart
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.stockQuantity, 0)
}

export function canAddProduct(
  product: Product,
  cart: CartItem[],
  quantity: number,
  saleMode: SaleMode,
) {
  if (saleMode === 'bundle' && !productAllowsBundle(product)) {
    return false
  }

  const inCart = getCartStockUsed(cart, product.id, product.stockCategoryId)
  const needed = getStockQuantity(product, quantity, saleMode)
  return product.stock >= inCart + needed
}

export function findMergeableCartItem(cart: CartItem[], product: Product, saleMode: SaleMode) {
  return cart.find(
    (item) =>
      item.productId === product.id &&
      !item.offerId &&
      !item.manualUnitPrice &&
      item.enteredAmount === undefined &&
      item.saleMode === saleMode &&
      (saleMode === 'bundle' || product.soldBy === 'unit'),
  )
}

export function updateCartItemQuantity(cart: CartItem[], key: string, quantity: number) {
  return cart
    .map((item) => {
      if (item.key !== key) return item

      const stockQuantity =
        item.saleMode === 'bundle'
          ? quantity * (item.unitsPerBundle ?? 1)
          : Number((quantity + quantity * (item.saleLossPerUnit ?? 0)).toFixed(3))
      const lineCost = roundMoney(item.unitCost * stockQuantity)
      const effectiveUnitPrice = item.manualUnitPrice
        ? item.unitPrice
        : item.originalUnitPrice ?? item.unitPrice
      const pricedQuantity = item.saleMode === 'bundle' ? stockQuantity : quantity
      const lineRevenue =
        item.offerType === 'combo'
          ? item.lineRevenue
          : roundMoney(effectiveUnitPrice * pricedQuantity)

      return {
        ...item,
        quantity,
        stockQuantity,
        enteredAmount: undefined,
        unitPrice: effectiveUnitPrice,
        offerId: item.manualUnitPrice ? item.offerId : undefined,
        offerType: item.manualUnitPrice ? item.offerType : undefined,
        offerName: item.manualUnitPrice ? item.offerName : undefined,
        discountAmount: item.manualUnitPrice ? item.discountAmount : undefined,
        lineCost,
        lineRevenue,
        lineProfit: roundMoney(lineRevenue - lineCost),
      }
    })
    .filter((item) => item.quantity > 0)
}

export function applyPromotionsToCart(cart: CartItem[], offers: SalesOffer[]): CartItem[] {
  const activePromotions = offers
    .filter((offer) => offer.active && offer.type === 'promotion')
    .sort((a, b) => b.quantity - a.quantity)

  return cart.map((item) => {
    if (
      item.isQuickItem ||
      item.saleMode !== 'retail' ||
      item.offerType === 'combo' ||
      item.manualUnitPrice ||
      item.enteredAmount !== undefined
    ) {
      return item
    }

    const originalUnitPrice = item.originalUnitPrice ?? item.unitPrice
    const promotion = activePromotions.find(
      (offer) => offer.productId === item.productId && item.quantity + 0.0001 >= offer.quantity,
    )
    const unitPrice = promotion ? promotion.price : originalUnitPrice
    const lineRevenue = roundMoney(unitPrice * item.quantity)
    const lineProfit = roundMoney(lineRevenue - item.lineCost)
    const normalRevenue = roundMoney(originalUnitPrice * item.quantity)

    const pricedItem: CartItem = {
      ...item,
      unitPrice,
      originalUnitPrice,
      offerId: promotion?.id,
      offerType: promotion ? 'promotion' : undefined,
      offerName: promotion?.name,
      discountAmount: promotion ? roundMoney(Math.max(normalRevenue - lineRevenue, 0)) : undefined,
      lineRevenue,
      lineProfit,
    }
    return pricedItem
  })
}

export function removeCartItem(cart: CartItem[], key: string) {
  return cart.filter((item) => item.key !== key)
}

export function getCartTotals(cart: CartItem[]) {
  const subtotal = roundMoney(cart.reduce((sum, item) => sum + item.lineRevenue, 0))
  const profit = roundMoney(cart.reduce((sum, item) => sum + item.lineProfit, 0))
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0)

  return { subtotal, profit, itemsCount }
}

export function formatCartQuantity(item: CartItem) {
  if (item.isQuickItem) return 'Producto rápido · precio manual'
  if (item.offerType === 'combo') {
    return `${item.offerName ?? 'Combo'} · ${item.quantity} ${item.unitLabel}`
  }

  const mode = item.saleMode === 'bundle' ? 'al mayor' : 'detal'

  if (item.enteredAmount !== undefined) {
    const lossLabel =
      item.stockQuantity > item.quantity
        ? ` · Desc. inventario: ${item.stockQuantity} ${item.unitLabel}`
        : ''
    return `${mode}: ${item.quantity} ${item.unitLabel}${lossLabel} · Importe: ${formatBaseMoney(item.enteredAmount)}`
  }

  if (item.saleMode === 'bundle' && item.unitsPerBundle) {
    const baseTotal = item.quantity * item.unitsPerBundle
    const baseLabel = item.soldBy === 'weight' ? item.unitLabel : item.unitLabel
    return `${mode}: ${item.quantity} al mayor · ${baseTotal} ${baseLabel}`
  }

  if (item.stockQuantity > item.quantity) {
    return `${mode}: ${item.quantity} ${item.unitLabel} · Desc. inventario: ${item.stockQuantity} ${item.unitLabel}`
  }

  const offerLabel = item.offerType === 'promotion' && item.offerName ? ` · ${item.offerName}` : ''
  const manualPriceLabel = item.manualUnitPrice ? ' · Precio manual' : ''
  return `${mode}: ${item.quantity} ${item.unitLabel}${offerLabel}${manualPriceLabel}`
}
