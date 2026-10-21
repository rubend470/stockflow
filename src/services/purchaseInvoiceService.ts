import {
  Timestamp,
  doc,
  getDoc,
  getDocs,
  increment,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import { db } from '../lib/firebase'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import type { Product } from '../types/product'
import type {
  CreatePurchaseInvoiceInput,
  CreatePurchaseInvoiceResult,
  PurchaseInvoice,
  PurchaseInvoiceLine,
  PurchaseInvoiceLineInput,
  UpdatePurchaseInvoiceInput,
} from '../types/purchaseInvoice'
import { buildExchangeRateSnapshot, convertCurrency } from '../utils/exchangeRates'
import { invoiceDateToDate, todayInputValue } from '../utils/invoiceDate'
import { roundMoney } from '../utils/formatMoney'
import {
  resolvePurchaseLineQuantity,
  resolvePurchaseLineTotal,
  resolvePurchaseLineUnitCost,
} from '../utils/purchaseInvoiceLine'
import { productAllowsBundle } from '../utils/productUnits'
import { listLatestExchangeRates } from './financeService'
import { getProductById } from './productService'
import { getStockCategoryById } from './stockCategoryService'
import { findOrCreateSupplierByName, getSupplierById } from './supplierService'
import type { StockCategory } from '../types/stockCategory'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return undefined
}

function mapLine(data: Record<string, unknown>): PurchaseInvoiceLine {
  return {
    productId: String(data.productId ?? ''),
    stockCategoryId: data.stockCategoryId ? String(data.stockCategoryId) : undefined,
    description: String(data.description ?? ''),
    quantity: Number(data.quantity ?? 0),
    unitLabel: String(data.unitLabel ?? 'und'),
    unitCost: Number(data.unitCost ?? 0),
    unitCostInBase: Number(data.unitCostInBase ?? data.unitCost ?? 0),
    lineTotal: Number(data.lineTotal ?? 0),
    receivedAsBundles: data.receivedAsBundles ? Boolean(data.receivedAsBundles) : undefined,
    bundleCount: data.bundleCount !== undefined ? Number(data.bundleCount) : undefined,
    bundleUnitCost: data.bundleUnitCost !== undefined ? Number(data.bundleUnitCost) : undefined,
    unitsPerBundle: data.unitsPerBundle !== undefined ? Number(data.unitsPerBundle) : undefined,
  }
}

function mapPurchaseInvoice(id: string, data: Record<string, unknown>): PurchaseInvoice {
  const lines = Array.isArray(data.lines) ? data.lines.map((line) => mapLine(line as Record<string, unknown>)) : []

  return {
    id,
    number: String(data.number ?? ''),
    supplierId: data.supplierId ? String(data.supplierId) : undefined,
    supplierName: String(data.supplierName ?? ''),
    supplierInvoiceNumber: data.supplierInvoiceNumber
      ? String(data.supplierInvoiceNumber)
      : undefined,
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE).toUpperCase(),
    amountInBase: Number(data.amountInBase ?? data.totalAmount ?? 0),
    exchangeRateSnapshot:
      data.exchangeRateSnapshot && typeof data.exchangeRateSnapshot === 'object'
        ? (data.exchangeRateSnapshot as Record<string, number>)
        : {},
    status: (data.status as PurchaseInvoice['status']) ?? 'pending',
    totalAmount: Number(data.totalAmount ?? 0),
    amountPaid: Number(data.amountPaid ?? 0),
    amountDue: Number(data.amountDue ?? 0),
    notes: data.notes ? String(data.notes) : undefined,
    invoiceDate: data.invoiceDate
      ? String(data.invoiceDate)
      : data.expectedDate
        ? String(data.expectedDate)
        : undefined,
    expectedDate: data.expectedDate ? String(data.expectedDate) : undefined,
    lines,
    createdAt: mapTimestamp(data.createdAt) ?? new Date().toISOString(),
    updatedAt: mapTimestamp(data.updatedAt),
    receivedAt: mapTimestamp(data.receivedAt),
  }
}

async function normalizeLines(
  lines: PurchaseInvoiceLineInput[],
  invoiceCurrency: string,
  baseCurrency: string,
  rates: Awaited<ReturnType<typeof listLatestExchangeRates>>,
): Promise<PurchaseInvoiceLine[]> {
  if (lines.length === 0) {
    throw new Error('Agrega al menos una línea a la factura.')
  }

  const normalized: PurchaseInvoiceLine[] = []

  for (const line of lines) {
    if (!line.description.trim() && line.lineType !== 'category') {
      throw new Error('Cada línea debe tener una descripción.')
    }

    if (line.inputQuantity <= 0) {
      throw new Error('La cantidad debe ser mayor a cero.')
    }

    if (line.lineType === 'category') {
      if (!line.stockCategoryId?.trim()) {
        throw new Error('Cada línea de categoría debe tener una categoría seleccionada.')
      }

      const category = await getStockCategoryById(line.stockCategoryId.trim())
      if (!category) {
        throw new Error(`Categoría no encontrada: ${line.description}`)
      }

      const unitCost = roundMoney(line.unitCost)
      const quantity = line.inputQuantity
      const lineTotal = roundMoney(quantity * unitCost)

      if (unitCost < 0) {
        throw new Error('El costo no puede ser negativo.')
      }

      normalized.push({
        productId: '',
        stockCategoryId: category.id,
        description: line.description.trim() || category.name,
        quantity,
        unitLabel: category.unitLabel,
        unitCost,
        unitCostInBase: roundMoney(
          convertCurrency(unitCost, invoiceCurrency, baseCurrency, rates),
        ),
        lineTotal,
      })
      continue
    }

    if (!line.productId?.trim()) {
      throw new Error('Cada línea debe tener un producto del catálogo.')
    }

    const product = await getProductById(line.productId.trim())
    if (!product) {
      throw new Error(`Producto no encontrado: ${line.description}`)
    }

    const quantity = resolvePurchaseLineQuantity(line, product)
    const unitCost = resolvePurchaseLineUnitCost(line, product)
    const lineTotal = resolvePurchaseLineTotal(line, product)

    if (quantity <= 0) {
      throw new Error('La cantidad en inventario debe ser mayor a cero.')
    }

    if (unitCost < 0) {
      throw new Error('El costo no puede ser negativo.')
    }

    const storedLine: PurchaseInvoiceLine = {
      productId: product.id,
      description: line.description.trim() || product.name,
      quantity,
      unitLabel: line.unitLabel || product.unitLabel,
      unitCost,
      unitCostInBase: roundMoney(
        convertCurrency(unitCost, invoiceCurrency, baseCurrency, rates),
      ),
      lineTotal,
    }

    if (line.receiveMode === 'bundles' && productAllowsBundle(product)) {
      storedLine.receivedAsBundles = true
      storedLine.bundleCount = line.inputQuantity
      storedLine.bundleUnitCost = roundMoney(line.bundleCost)
      storedLine.unitsPerBundle = product.unitsPerBundle
    }

    normalized.push(storedLine)
  }

  return normalized
}

function applyStockEntry(
  batch: WriteBatch,
  product: Product,
  line: PurchaseInvoiceLine,
  context: {
    invoiceId: string
    invoiceNumber: string
    supplierName: string
  },
  userId: string,
  userName: string,
) {
  const movementRef = doc(tenantCollectionRef('inventory_movements'))
  batch.set(movementRef, {
    productId: product.stockCategoryId ? null : product.id,
    stockCategoryId: product.stockCategoryId ?? null,
    productName: product.name,
    type: 'purchase',
    quantity: line.quantity,
    unitCost: line.unitCost,
    referenceType: 'purchase_invoice',
    referenceId: context.invoiceId,
    notes: `Entrada factura ${context.invoiceNumber} · ${context.supplierName}`,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  if (product.stockCategoryId) {
    batch.update(tenantDocumentRef('stock_categories', product.stockCategoryId), {
      stock: increment(line.quantity),
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.update(tenantDocumentRef('products', product.id), {
      stock: increment(line.quantity),
      updatedAt: serverTimestamp(),
    })
  }
}

function applyCategoryStockEntry(
  batch: WriteBatch,
  category: StockCategory,
  line: PurchaseInvoiceLine,
  context: {
    invoiceId: string
    invoiceNumber: string
    supplierName: string
  },
  userId: string,
  userName: string,
) {
  const movementRef = doc(tenantCollectionRef('inventory_movements'))
  batch.set(movementRef, {
    productId: null,
    stockCategoryId: category.id,
    productName: category.name,
    type: 'purchase',
    quantity: line.quantity,
    unitCost: line.unitCost,
    referenceType: 'purchase_invoice',
    referenceId: context.invoiceId,
    notes: `Entrada factura ${context.invoiceNumber} · ${context.supplierName}`,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(tenantDocumentRef('stock_categories', category.id), {
    stock: increment(line.quantity),
    updatedAt: serverTimestamp(),
  })
}

function reverseCategoryStockEntry(
  batch: WriteBatch,
  category: StockCategory,
  line: PurchaseInvoiceLine,
  context: {
    invoiceId: string
    invoiceNumber: string
    supplierName: string
  },
  userId: string,
  userName: string,
) {
  const movementRef = doc(tenantCollectionRef('inventory_movements'))
  batch.set(movementRef, {
    productId: null,
    stockCategoryId: category.id,
    productName: category.name,
    type: 'adjustment',
    quantity: -line.quantity,
    unitCost: line.unitCost,
    referenceType: 'purchase_invoice',
    referenceId: context.invoiceId,
    notes: `Ajuste edición factura ${context.invoiceNumber} · ${context.supplierName}`,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  batch.update(tenantDocumentRef('stock_categories', category.id), {
    stock: increment(-line.quantity),
    updatedAt: serverTimestamp(),
  })
}

function reverseStockEntry(
  batch: WriteBatch,
  product: Product,
  line: PurchaseInvoiceLine,
  context: {
    invoiceId: string
    invoiceNumber: string
    supplierName: string
  },
  userId: string,
  userName: string,
) {
  const movementRef = doc(tenantCollectionRef('inventory_movements'))
  batch.set(movementRef, {
    productId: product.stockCategoryId ? null : product.id,
    stockCategoryId: product.stockCategoryId ?? null,
    productName: product.name,
    type: 'adjustment',
    quantity: -line.quantity,
    unitCost: line.unitCost,
    referenceType: 'purchase_invoice',
    referenceId: context.invoiceId,
    notes: `Ajuste edición factura ${context.invoiceNumber} · ${context.supplierName}`,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  if (product.stockCategoryId) {
    batch.update(tenantDocumentRef('stock_categories', product.stockCategoryId), {
      stock: increment(-line.quantity),
      updatedAt: serverTimestamp(),
    })
  } else {
    batch.update(tenantDocumentRef('products', product.id), {
      stock: increment(-line.quantity),
      updatedAt: serverTimestamp(),
    })
  }
}

async function getNextInvoiceNumber() {
  const counterRef = tenantDocumentRef('settings', 'purchase_invoices')

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(counterRef)
    const lastNumber = snapshot.exists() ? Number(snapshot.data().lastNumber ?? 0) : 0
    const nextNumber = lastNumber + 1

    transaction.set(
      counterRef,
      {
        lastNumber: nextNumber,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return String(nextNumber).padStart(5, '0')
  })
}

export async function listPurchaseInvoices(): Promise<PurchaseInvoice[]> {
  const snapshot = await getDocs(tenantCollectionRef('purchase_invoices'))
  return snapshot.docs
    .map((item) => mapPurchaseInvoice(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listVisiblePurchaseInvoices(invoices: PurchaseInvoice[]) {
  return invoices.filter((invoice) => invoice.status !== 'cancelled')
}

export function listOpenPurchaseInvoices(invoices: PurchaseInvoice[]) {
  return listVisiblePurchaseInvoices(invoices).filter(
    (invoice) => invoice.status !== 'paid' && invoice.amountDue > 0.01,
  )
}

export function getPurchaseInvoiceDueInBase(invoice: PurchaseInvoice) {
  if (invoice.amountDue <= 0.01) return 0
  if (invoice.totalAmount <= 0.01) return roundMoney(invoice.amountDue)
  return roundMoney(invoice.amountInBase * (invoice.amountDue / invoice.totalAmount))
}

export async function getPurchaseInvoiceById(id: string): Promise<PurchaseInvoice | null> {
  const snapshot = await getDoc(tenantDocumentRef('purchase_invoices', id))
  if (!snapshot.exists()) return null
  return mapPurchaseInvoice(snapshot.id, snapshot.data())
}

export async function createAndReceivePurchaseInvoice(
  input: CreatePurchaseInvoiceInput,
  userId: string,
  userName: string,
): Promise<CreatePurchaseInvoiceResult> {
  if (!input.supplierName.trim()) {
    throw new Error('El proveedor es obligatorio.')
  }

  const currencyCode = input.currencyCode.trim().toUpperCase() || DEFAULT_BASE_CURRENCY_CODE
  const baseCurrency = DEFAULT_BASE_CURRENCY_CODE
  const rates = await listLatestExchangeRates()
  const exchangeRateSnapshot = buildExchangeRateSnapshot(rates, baseCurrency)

  const supplier = input.supplierId
    ? (await getSupplierById(input.supplierId)) ??
      (await findOrCreateSupplierByName(input.supplierName.trim()))
    : await findOrCreateSupplierByName(input.supplierName.trim())

  const lines = await normalizeLines(input.lines, currencyCode, baseCurrency, rates)
  const totalAmount = roundMoney(lines.reduce((sum, line) => sum + line.lineTotal, 0))
  const amountPaid = roundMoney(Math.max(input.amountPaid ?? 0, 0))

  if (amountPaid > totalAmount + 0.01) {
    throw new Error('El monto pagado no puede superar el total de la factura.')
  }

  const amountDue = roundMoney(Math.max(totalAmount - amountPaid, 0))
  const amountInBase = roundMoney(
    lines.reduce((sum, line) => sum + line.unitCostInBase * line.quantity, 0),
  )

  let status: PurchaseInvoice['status'] = 'received'
  if (amountDue <= 0.01) {
    status = 'paid'
  } else if (amountPaid > 0.01) {
    status = 'partial'
  }

  const number = await getNextInvoiceNumber()
  const invoiceDate = input.invoiceDate?.trim() || todayInputValue()
  const ref = doc(tenantCollectionRef('purchase_invoices'))
  const batch = writeBatch(db)

  for (const line of lines) {
    const stockContext = {
      invoiceId: ref.id,
      invoiceNumber: number,
      supplierName: supplier.name,
    }

    if (line.stockCategoryId) {
      const category = await getStockCategoryById(line.stockCategoryId)
      if (!category) continue
      applyCategoryStockEntry(batch, category, line, stockContext, userId, userName)
      continue
    }

    const product = await getProductById(line.productId)
    if (!product) continue

    applyStockEntry(batch, product, line, stockContext, userId, userName)
  }

  batch.set(ref, {
    number,
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null,
    currencyCode,
    amountInBase,
    exchangeRateSnapshot,
    status,
    totalAmount,
    amountPaid,
    amountDue,
    notes: input.notes?.trim() || null,
    invoiceDate,
    lines,
    createdAt: Timestamp.fromDate(invoiceDateToDate(invoiceDate)),
    updatedAt: serverTimestamp(),
    receivedAt: Timestamp.fromDate(invoiceDateToDate(invoiceDate)),
    receivedBy: userId,
    createdBy: userId,
  })

  await batch.commit()

  return {
    id: ref.id,
    number,
  }
}

/** @deprecated Usar createAndReceivePurchaseInvoice. Mantenido para facturas legacy pending. */
export async function createPurchaseInvoice(input: CreatePurchaseInvoiceInput, userId: string) {
  const result = await createAndReceivePurchaseInvoice(input, userId, '')
  return result.id
}

export async function updatePurchaseInvoice(
  id: string,
  input: UpdatePurchaseInvoiceInput,
  userId: string,
  userName: string,
) {
  if (!input.supplierName.trim()) {
    throw new Error('El proveedor es obligatorio.')
  }

  if (!input.invoiceDate?.trim()) {
    throw new Error('La fecha es obligatoria.')
  }

  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status === 'cancelled') {
    throw new Error('No puedes editar una factura anulada.')
  }

  const supplier = input.supplierId
    ? (await getSupplierById(input.supplierId)) ??
      (await findOrCreateSupplierByName(input.supplierName.trim()))
    : await findOrCreateSupplierByName(input.supplierName.trim())

  const currencyCode = invoice.currencyCode
  const baseCurrency = DEFAULT_BASE_CURRENCY_CODE
  const rates = await listLatestExchangeRates()
  const newLines = await normalizeLines(input.lines, currencyCode, baseCurrency, rates)
  const totalAmount = roundMoney(newLines.reduce((sum, line) => sum + line.lineTotal, 0))
  const amountPaid = roundMoney(invoice.amountPaid)

  if (amountPaid > totalAmount + 0.01) {
    throw new Error('El total no puede quedar por debajo de lo ya pagado.')
  }

  const amountDue = roundMoney(Math.max(totalAmount - amountPaid, 0))
  const amountInBase = roundMoney(
    newLines.reduce((sum, line) => sum + line.unitCostInBase * line.quantity, 0),
  )

  let status = invoice.status
  if (invoice.status !== 'pending') {
    if (amountDue <= 0.01) {
      status = 'paid'
    } else if (amountPaid > 0.01) {
      status = 'partial'
    } else {
      status = 'received'
    }
  }

  const invoiceDate = input.invoiceDate.trim()
  const batch = writeBatch(db)
  const stockContext = {
    invoiceId: id,
    invoiceNumber: invoice.number,
    supplierName: supplier.name,
  }

  if (invoice.status !== 'pending') {
    for (const oldLine of invoice.lines) {
      if (oldLine.stockCategoryId) {
        const category = await getStockCategoryById(oldLine.stockCategoryId)
        if (category) {
          reverseCategoryStockEntry(batch, category, oldLine, stockContext, userId, userName)
        }
        continue
      }

      if (!oldLine.productId) continue
      const product = await getProductById(oldLine.productId)
      if (!product) continue
      reverseStockEntry(batch, product, oldLine, stockContext, userId, userName)
    }

    for (const line of newLines) {
      if (line.stockCategoryId) {
        const category = await getStockCategoryById(line.stockCategoryId)
        if (category) {
          applyCategoryStockEntry(batch, category, line, stockContext, userId, userName)
        }
        continue
      }

      const product = await getProductById(line.productId)
      if (!product) continue

      applyStockEntry(batch, product, line, stockContext, userId, userName)
    }
  }

  batch.update(tenantDocumentRef('purchase_invoices', id), {
    supplierId: supplier.id,
    supplierName: supplier.name,
    supplierInvoiceNumber: input.supplierInvoiceNumber?.trim() || null,
    notes: input.notes?.trim() || null,
    invoiceDate,
    lines: newLines,
    totalAmount,
    amountDue,
    amountInBase,
    status,
    createdAt: Timestamp.fromDate(invoiceDateToDate(invoiceDate)),
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function registerPurchaseInvoicePayment(id: string, amount: number) {
  if (amount <= 0) {
    throw new Error('El monto debe ser mayor a cero.')
  }

  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status === 'cancelled') {
    throw new Error('No puedes pagar una factura anulada.')
  }

  const nextPaid = roundMoney(invoice.amountPaid + amount)
  if (nextPaid > invoice.totalAmount + 0.01) {
    throw new Error('El pago supera el total de la factura.')
  }

  const amountDue = roundMoney(Math.max(invoice.totalAmount - nextPaid, 0))
  let status = invoice.status
  if (amountDue <= 0.01) {
    status = 'paid'
  } else if (invoice.status === 'received' || invoice.status === 'partial') {
    status = 'partial'
  }

  await updateDoc(tenantDocumentRef('purchase_invoices', id), {
    amountPaid: nextPaid,
    amountDue,
    status,
    updatedAt: serverTimestamp(),
  })
}

/** Solo para facturas legacy en estado pending. */
export async function receivePurchaseInvoice(id: string, userId: string, userName: string) {
  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status !== 'pending') {
    throw new Error('Solo puedes registrar entrada en facturas pendientes.')
  }

  const batch = writeBatch(db)

  for (const line of invoice.lines) {
    const stockContext = {
      invoiceId: id,
      invoiceNumber: invoice.number,
      supplierName: invoice.supplierName,
    }

    if (line.stockCategoryId) {
      const category = await getStockCategoryById(line.stockCategoryId)
      if (category) {
        applyCategoryStockEntry(batch, category, line, stockContext, userId, userName)
      }
      continue
    }

    if (!line.productId) continue

    const product = await getProductById(line.productId)
    if (!product) continue

    applyStockEntry(batch, product, line, stockContext, userId, userName)
  }

  const status =
    invoice.amountDue <= 0.01 ? 'paid' : invoice.amountPaid > 0.01 ? 'partial' : 'received'

  batch.update(tenantDocumentRef('purchase_invoices', id), {
    status,
    updatedAt: serverTimestamp(),
    receivedAt: serverTimestamp(),
    receivedBy: userId,
  })

  await batch.commit()
}

export async function cancelPurchaseInvoice(id: string) {
  const invoice = await getPurchaseInvoiceById(id)
  if (!invoice) {
    throw new Error('Factura no encontrada.')
  }

  if (invoice.status !== 'pending') {
    throw new Error('Solo puedes anular facturas que aún no han entrado al inventario.')
  }

  await updateDoc(tenantDocumentRef('purchase_invoices', id), {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  })
}
