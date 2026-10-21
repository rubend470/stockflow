import type { Product, ProductFormInput, SaleMode, SoldBy } from '../types/product'
import { normalizeBarcode } from './barcode'
import { formatBaseMoney } from './formatMoney'

export type StockInputMode = 'units' | 'bundles'

export function productAllowsBundle(product: Pick<Product, 'allowsBundle' | 'unitsPerBundle'>) {
  return product.allowsBundle && Boolean(product.unitsPerBundle && product.unitsPerBundle > 0)
}

export function getUnitsPerBundle(product: Pick<Product, 'unitsPerBundle'>) {
  return product.unitsPerBundle && product.unitsPerBundle > 0 ? product.unitsPerBundle : 1
}

export function getStockQuantity(product: Product, quantity: number, saleMode: SaleMode) {
  if (saleMode === 'bundle') {
    return quantity * getUnitsPerBundle(product)
  }

  if (!product.hasSaleLoss || !product.saleLossPerUnit || product.saleLossPerUnit <= 0) {
    return quantity
  }

  return Number((quantity + quantity * product.saleLossPerUnit).toFixed(3))
}

export function normalizeLegacyProduct(data: Record<string, unknown>): Partial<Product> {
  const legacySoldBy = String(data.soldBy ?? 'unit')

  if (legacySoldBy !== 'bundle') {
    return {
      soldBy: legacySoldBy as SoldBy,
      allowsBundle: data.allowsBundle === true,
    }
  }

  const baseUnitLabel = String(data.baseUnitLabel ?? 'kg')
  return {
    soldBy: baseUnitLabel === 'und' ? 'unit' : 'weight',
    unitLabel: baseUnitLabel === 'und' ? 'und' : baseUnitLabel,
    allowsBundle: true,
    unitsPerBundle: Number(data.unitsPerBundle ?? 24),
    bundleSalePrice: Number(data.bundleSalePrice ?? data.salePrice ?? 0),
    bundleCostPrice: Number(data.bundleCostPrice ?? data.costPrice ?? 0),
    salePrice: Number(data.retailSalePrice ?? 0),
    costPrice: Number(data.retailCostPrice ?? 0),
  }
}

export function normalizeProductInput(input: ProductFormInput) {
  const linkedToCategory = Boolean(input.stockCategoryId?.trim())
  const stock = linkedToCategory ? 0 : input.stock
  const minStock = linkedToCategory ? 0 : input.minStock
  const barcode = normalizeBarcode(input.barcode)

  if (!input.allowsBundle) {
    return {
      ...input,
      barcode,
      stockCategoryId: input.stockCategoryId?.trim() || undefined,
      costPrice: linkedToCategory ? 0 : input.costPrice,
      unitsPerBundle: null,
      bundleCostPrice: null,
      bundleSalePrice: null,
      hasSaleLoss: input.soldBy === 'weight' && input.hasSaleLoss,
      saleLossPerUnit: input.soldBy === 'weight' && input.hasSaleLoss ? input.saleLossPerUnit : 0,
      unitLabel: input.soldBy === 'weight' ? input.unitLabel : input.unitLabel || 'und',
      stock,
      minStock,
    }
  }

  if (!input.unitsPerBundle || input.unitsPerBundle <= 0) {
    throw new Error('Indica cuántas unidades trae cada venta al mayor (ej. 24 kg).')
  }

  if (!input.bundleSalePrice || input.bundleSalePrice <= 0) {
    throw new Error('Indica el precio de venta al mayor.')
  }

  return {
    ...input,
    barcode,
    stockCategoryId: input.stockCategoryId?.trim() || undefined,
    costPrice: linkedToCategory ? 0 : input.costPrice,
    unitLabel: input.soldBy === 'weight' ? input.unitLabel : input.unitLabel || 'und',
    unitsPerBundle: input.unitsPerBundle,
    bundleCostPrice: linkedToCategory ? null : input.bundleCostPrice ?? 0,
    bundleSalePrice: input.bundleSalePrice,
    hasSaleLoss: input.soldBy === 'weight' && input.hasSaleLoss,
    saleLossPerUnit: input.soldBy === 'weight' && input.hasSaleLoss ? input.saleLossPerUnit : 0,
    stock,
    minStock,
  }
}

export function formatStockSummary(
  product: Pick<Product, 'stock' | 'unitLabel' | 'allowsBundle' | 'unitsPerBundle'>,
) {
  const stock = Number(product.stock.toFixed(3))
  const base = `${stock} ${product.unitLabel}`

  if (!productAllowsBundle(product)) {
    return base
  }

  const bundles = Number((product.stock / getUnitsPerBundle(product)).toFixed(2))
  return `${base} · ${bundles} al mayor`
}

export function formatMinStockSummary(
  product: Pick<Product, 'minStock' | 'unitLabel' | 'allowsBundle' | 'unitsPerBundle'>,
) {
  const base = `${product.minStock} ${product.unitLabel}`

  if (!productAllowsBundle(product)) {
    return base
  }

  const bundles = Number((product.minStock / getUnitsPerBundle(product)).toFixed(2))
  return `${base} · ${bundles} al mayor mín.`
}

export function stockBundlesFromUnits(stock: number, unitsPerBundle?: number | null) {
  if (!unitsPerBundle || unitsPerBundle <= 0) return 0
  return Number((stock / unitsPerBundle).toFixed(3))
}

export function resolveProductStock(
  stock: number,
  mode: StockInputMode,
  bundles: number,
  unitsPerBundle?: number | null,
) {
  if (mode !== 'bundles' || !unitsPerBundle || unitsPerBundle <= 0) {
    return stock
  }

  const decimals = bundles % 1 !== 0 || unitsPerBundle % 1 !== 0 ? 3 : 0
  return Number((bundles * unitsPerBundle).toFixed(decimals))
}

export function formatProductPrices(product: Product) {
  const retail = `Detal: ${formatBaseMoney(product.salePrice)}/${product.unitLabel}`

  if (!productAllowsBundle(product)) {
    return retail
  }

  const unitsPerBundle = getUnitsPerBundle(product)
  const bundleUnitPrice = product.bundleSalePrice ?? 0
  const bundleTotal = bundleUnitPrice * unitsPerBundle

  return `${retail} · Al mayor: ${formatBaseMoney(bundleUnitPrice)}/${product.unitLabel} x ${unitsPerBundle} = ${formatBaseMoney(bundleTotal)}`
}

export function getSoldByLabel(soldBy: SoldBy) {
  if (soldBy === 'weight') return 'Peso'
  return 'Unidad'
}

export function getProductSaleSummary(product: Pick<Product, 'soldBy' | 'allowsBundle' | 'unitsPerBundle'>) {
  const base = getSoldByLabel(product.soldBy)
  if (productAllowsBundle(product)) {
    return `${base} · Al mayor`
  }
  return base
}

export function getStockInputStep(soldBy: SoldBy) {
  return soldBy === 'weight' ? '0.001' : '1'
}

export function getSaleModeLabel(saleMode: SaleMode) {
  return saleMode === 'bundle' ? 'Al mayor' : 'Detal'
}

export function needsSaleQuantityModal(product: Product) {
  return productAllowsAmountEntry(product) || productAllowsBundle(product)
}

export function getDefaultSaleMode(_product: Product): SaleMode {
  return 'retail'
}

export function getDefaultQuantity(_product: Product, _saleMode: SaleMode) {
  return '1'
}

export function productAllowsAmountEntry(product: Product) {
  return product.soldBy === 'weight'
}

export function getQuantityStep(soldBy: SoldBy, saleMode: SaleMode) {
  if (saleMode === 'bundle') return 1
  return soldBy === 'weight' ? 0.25 : 1
}
