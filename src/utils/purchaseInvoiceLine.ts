import type { Product } from '../types/product'
import type { PurchaseInvoiceLine, PurchaseInvoiceLineInput } from '../types/purchaseInvoice'
import type { StockCategory } from '../types/stockCategory'
import { roundMoney } from './formatMoney'
import {
  getUnitsPerBundle,
  productAllowsBundle,
  resolveProductStock,
  type StockInputMode,
} from './productUnits'

export function resolvePurchaseLineQuantity(
  line: PurchaseInvoiceLineInput,
  product: Product,
): number {
  if (line.receiveMode === 'bundles' && productAllowsBundle(product)) {
    return resolveProductStock(0, 'bundles', line.inputQuantity, product.unitsPerBundle)
  }
  return line.inputQuantity
}

export function resolvePurchaseLineUnitCost(
  line: PurchaseInvoiceLineInput,
  product: Product,
): number {
  if (line.receiveMode === 'bundles' && productAllowsBundle(product)) {
    const unitsPerBundle = getUnitsPerBundle(product)
    if (!unitsPerBundle || !line.bundleCost) return 0
    return roundMoney(line.bundleCost / unitsPerBundle)
  }
  return roundMoney(line.unitCost)
}

export function resolvePurchaseLineTotal(
  line: PurchaseInvoiceLineInput,
  product: Product,
): number {
  if (line.receiveMode === 'bundles' && productAllowsBundle(product)) {
    return roundMoney(line.inputQuantity * (line.bundleCost ?? 0))
  }
  return roundMoney(line.inputQuantity * line.unitCost)
}

export function getPurchaseLinePreview(
  line: PurchaseInvoiceLineInput,
  product: Product | undefined,
  _category?: StockCategory,
) {
  if (line.lineType === 'category') {
    return {
      stockUnits: line.inputQuantity,
      lineTotal: roundMoney(line.inputQuantity * line.unitCost),
      unitsPerBundle: null as number | null,
    }
  }

  if (!product) {
    return {
      stockUnits: line.inputQuantity,
      lineTotal:
        line.receiveMode === 'bundles'
          ? roundMoney(line.inputQuantity * (line.bundleCost ?? 0))
          : roundMoney(line.inputQuantity * line.unitCost),
      unitsPerBundle: null as number | null,
    }
  }

  return {
    stockUnits: resolvePurchaseLineQuantity(line, product),
    lineTotal: resolvePurchaseLineTotal(line, product),
    unitsPerBundle: productAllowsBundle(product) ? getUnitsPerBundle(product) : null,
  }
}

export function switchReceiveMode(
  line: PurchaseInvoiceLineInput,
  mode: StockInputMode,
  product: Product | undefined,
): Partial<PurchaseInvoiceLineInput> {
  if (!product || !productAllowsBundle(product)) {
    return { receiveMode: 'units' }
  }

  const unitsPerBundle = getUnitsPerBundle(product)

  if (mode === 'bundles') {
    const bundles =
      line.receiveMode === 'units'
        ? Number((line.inputQuantity / unitsPerBundle).toFixed(3))
        : line.inputQuantity
    return {
      receiveMode: 'bundles',
      inputQuantity: bundles > 0 ? bundles : 0,
      bundleCost: line.bundleCost || 0,
    }
  }

  const units =
    line.receiveMode === 'bundles'
      ? resolveProductStock(0, 'bundles', line.inputQuantity, unitsPerBundle)
      : line.inputQuantity

  return {
    receiveMode: 'units',
    inputQuantity: units > 0 ? units : 0,
    unitCost: line.unitCost,
  }
}

export function purchaseLineToInput(
  line: PurchaseInvoiceLine,
  category?: StockCategory,
): PurchaseInvoiceLineInput {
  if (line.stockCategoryId) {
    return {
      lineType: 'category',
      productId: '',
      stockCategoryId: line.stockCategoryId,
      description: line.description,
      isNewProduct: false,
      receiveMode: 'units',
      inputQuantity: line.quantity,
      unitLabel: line.unitLabel || category?.unitLabel || 'kg',
      unitCost: line.unitCost,
      bundleCost: 0,
    }
  }

  const receiveMode = line.receivedAsBundles ? 'bundles' : 'units'

  return {
    lineType: 'product',
    productId: line.productId,
    stockCategoryId: '',
    description: line.description,
    isNewProduct: false,
    receiveMode,
    inputQuantity:
      receiveMode === 'bundles' && line.bundleCount ? line.bundleCount : line.quantity,
    unitLabel: line.unitLabel,
    unitCost: line.unitCost,
    bundleCost: line.bundleUnitCost ?? line.unitCost * (line.unitsPerBundle ?? 1),
  }
}

export function validatePurchaseInvoiceLines(
  lines: PurchaseInvoiceLineInput[],
  products: Product[],
  stockCategories: StockCategory[] = [],
): string | null {
  const missingCategory = lines.find(
    (line) => line.lineType === 'category' && !line.stockCategoryId,
  )
  if (missingCategory) {
    return 'Cada línea de categoría debe tener una categoría global seleccionada.'
  }

  const missingCatalog = lines.find(
    (line) => line.lineType === 'product' && !line.productId,
  )
  if (missingCatalog) {
    const label = missingCatalog.description.trim() || 'Producto nuevo'
    return `«${label}» aún no está en el catálogo. Regístralo antes de guardar.`
  }

  const invalidCategory = lines.find((line) => {
    if (line.lineType !== 'category' || !line.stockCategoryId) return false
    return !stockCategories.some((category) => category.id === line.stockCategoryId)
  })
  if (invalidCategory) {
    return `La categoría «${invalidCategory.description}» no está disponible.`
  }

  const invalidQuantity = lines.find((line) => line.inputQuantity <= 0)
  if (invalidQuantity) {
    const label =
      invalidQuantity.lineType === 'category'
        ? invalidQuantity.description || 'Categoría'
        : invalidQuantity.description
    return `La cantidad debe ser mayor a cero en «${label}».`
  }

  const invalidCategoryCost = lines.find(
    (line) => line.lineType === 'category' && line.unitCost <= 0,
  )
  if (invalidCategoryCost) {
    return `Indica el costo unitario en «${invalidCategoryCost.description}».`
  }

  const invalidProductCost = lines.find((line) => {
    if (line.lineType !== 'product') return false
    const catalogProduct = products.find((entry) => entry.id === line.productId)
    if (line.receiveMode === 'bundles' && catalogProduct && productAllowsBundle(catalogProduct)) {
      return (line.bundleCost ?? 0) <= 0
    }
    return line.unitCost <= 0
  })
  if (invalidProductCost) {
    return `Indica el costo en la moneda de la factura para «${invalidProductCost.description}».`
  }

  return null
}

export function categorySelectionPatch(category: StockCategory): Partial<PurchaseInvoiceLineInput> {
  return {
    lineType: 'category',
    stockCategoryId: category.id,
    productId: '',
    isNewProduct: false,
    description: category.name,
    unitLabel: category.unitLabel,
    receiveMode: 'units',
  }
}

export function productSelectionPatch(product: Product): Partial<PurchaseInvoiceLineInput> {
  return {
    lineType: 'product',
    stockCategoryId: '',
    description: product.name,
    unitLabel: product.unitLabel,
    receiveMode: 'units',
    unitCost: 0,
    bundleCost: 0,
  }
}
