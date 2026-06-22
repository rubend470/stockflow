import type { Product, SaleMode } from '../types/product'
import type { CartItem } from '../types/sale'
import { roundMoney } from './formatMoney'
import { getStockQuantity, productAllowsBundle } from './productUnits'

export function buildCartItem(
  product: Product,
  quantity: number,
  saleMode: SaleMode,
  categoryName?: string,
): CartItem {
  const isBundle = saleMode === 'bundle'

  const unitPrice = roundMoney(isBundle ? product.bundleSalePrice ?? 0 : product.salePrice)
  const unitCost = roundMoney(isBundle ? product.bundleCostPrice ?? 0 : product.costPrice)
  const unitLabel = isBundle ? 'al mayor' : product.unitLabel
  const stockQuantity = getStockQuantity(product, quantity, saleMode)
  const lineCost = roundMoney(unitCost * quantity)
  const lineRevenue = roundMoney(unitPrice * quantity)

  return {
    key: `${product.id}-${saleMode}-${Date.now()}`,
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
          : quantity
      const lineCost = item.unitCost * quantity
      const lineRevenue = item.unitPrice * quantity

      return {
        ...item,
        quantity,
        stockQuantity,
        lineCost,
        lineRevenue,
        lineProfit: lineRevenue - lineCost,
      }
    })
    .filter((item) => item.quantity > 0)
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

  const mode = item.saleMode === 'bundle' ? 'al mayor' : 'detal'

  if (item.saleMode === 'bundle' && item.unitsPerBundle) {
    const baseTotal = item.quantity * item.unitsPerBundle
    const baseLabel = item.soldBy === 'weight' ? item.unitLabel : item.unitLabel
    return `${mode}: ${item.quantity} al mayor · ${baseTotal} ${baseLabel}`
  }

  return `${mode}: ${item.quantity} ${item.unitLabel}`
}
