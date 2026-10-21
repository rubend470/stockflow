import type { InventoryMovement } from '../types/inventory'
import { listCurrencyExchanges } from './currencyExchangeService'
import { listWasteMovements } from './inventoryMovementService'
import { getSaleItems, getSalePayments, listSales } from './saleService'
import type { CurrencyExchange } from '../types/currencyExchange'
import { roundMoney } from '../utils/formatMoney'
import { listAllProducts } from './productService'
import { listActiveDebts } from './debtService'
import { listActiveLoans } from './loanService'
import { getAppSettings } from './settingsService'
import { listStockCategories } from './stockCategoryService'
import {
  getPurchaseInvoiceDueInBase,
  listOpenPurchaseInvoices,
  listPurchaseInvoices,
} from './purchaseInvoiceService'
import type { PurchaseInvoice } from '../types/purchaseInvoice'
import type { Sale, SaleItem } from '../types/sale'
import type { Product, ProductType } from '../types/product'
import { getStockStatus } from '../types/product'
import { enrichProductsWithCategoryStock } from '../utils/stockCategory'
import { getMovementWasteCost } from '../utils/wasteCost'
import {
  aggregateCashByCurrency,
  mergeCurrencyCashTotals,
  type CurrencyCashTotal,
} from '../utils/salePayments'

export type ReportPeriod = 'today' | 'week' | 'month'

export interface SalesPeriodStats {
  count: number
  revenue: number
  profit: number
  marginPercent: number
  wasteCost?: number
  adjustedProfit?: number
  adjustedMarginPercent?: number
}

export interface WastePeriodStats {
  count: number
  totalCost: number
}

export interface TopProductRow {
  productId: string
  productName: string
  quantity: number
  revenue: number
}

export interface SalesByDayRow {
  dateKey: string
  dateLabel: string
  count: number
  revenue: number
  profit: number
}

export interface SalesByCashierRow {
  cashierId: string
  cashierName: string
  count: number
  revenue: number
  profit: number
}

export interface SalesByCategoryRow {
  category: ProductType
  categoryLabel: string
  quantity: number
  revenue: number
  profit: number
}

export interface LowStockRow {
  productId: string
  productName: string
  stock: number
  minStock: number
  unitLabel: string
  status: 'low' | 'out'
}

const categoryLabels: Record<string, string> = {
  abasto: 'Abasto',
  charcuteria: 'Charcutería',
}

export interface PendingPurchaseInvoiceRow {
  id: string
  number: string
  supplierName: string
  amountDue: number
  currencyCode: string
  amountDueInBase: number
  status: PurchaseInvoice['status']
}

export interface DashboardStats {
  todaySales: SalesPeriodStats
  productCount: number
  lowStockCount: number
  lowStock: LowStockRow[]
  lowStockAlertEnabled: boolean
  activeDebtBalance: number
  activeLoanBalance: number
  pendingPurchaseInvoices: PendingPurchaseInvoiceRow[]
  pendingPurchaseInvoicesTotalDueInBase: number
}

function mapPendingPurchaseInvoices(invoices: PurchaseInvoice[]): PendingPurchaseInvoiceRow[] {
  return listOpenPurchaseInvoices(invoices)
    .map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      supplierName: invoice.supplierName,
      amountDue: invoice.amountDue,
      currencyCode: invoice.currencyCode,
      amountDueInBase: getPurchaseInvoiceDueInBase(invoice),
      status: invoice.status,
    }))
    .sort((a, b) => b.amountDueInBase - a.amountDueInBase)
}

function isSameDay(dateIso: string, reference = new Date()) {
  const date = new Date(dateIso)
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  )
}

function isInRange(dateIso: string, start: Date, end: Date) {
  const time = new Date(dateIso).getTime()
  return time >= start.getTime() && time <= end.getTime()
}

export function computeMarginPercent(revenue: number, profit: number) {
  if (revenue <= 0) return 0
  return Number(((profit / revenue) * 100).toFixed(1))
}

export interface CurrencyExchangeReportRow {
  id: string
  createdAt: string
  cashInCurrency: string
  cashInAmount: number
  cashInMethodName: string
  cashInReference?: string
  cashOutCurrency: string
  cashOutAmount: number
  cashOutMethodName: string
  cashOutReference?: string
  rateLabel: string
  amountInBase: number
  clientName?: string
  createdByName: string
}

export interface CurrencyExchangeSummary {
  count: number
  volumeInBase: number
}

export interface CurrencyExchangeFlowRow {
  currencyCode: string
  cashIn: number
  cashOut: number
}

export function filterExchangesByPeriod(exchanges: CurrencyExchange[], period: ReportPeriod) {
  const now = new Date()

  if (period === 'today') {
    return exchanges.filter((exchange) => isSameDay(exchange.createdAt, now))
  }

  const start = new Date(now)
  if (period === 'week') {
    start.setDate(now.getDate() - 7)
  } else {
    start.setMonth(now.getMonth() - 1)
  }

  return exchanges.filter((exchange) => isInRange(exchange.createdAt, start, now))
}

export function summarizeCurrencyExchanges(exchanges: CurrencyExchange[]): CurrencyExchangeSummary {
  return {
    count: exchanges.length,
    volumeInBase: roundMoney(exchanges.reduce((sum, exchange) => sum + exchange.amountInBase, 0)),
  }
}

export function getExchangeFlowByCurrency(exchanges: CurrencyExchange[]): CurrencyExchangeFlowRow[] {
  const byCurrency = new Map<string, CurrencyExchangeFlowRow>()

  exchanges.forEach((exchange) => {
    const inRow = byCurrency.get(exchange.cashInCurrency) ?? {
      currencyCode: exchange.cashInCurrency,
      cashIn: 0,
      cashOut: 0,
    }
    inRow.cashIn = roundMoney(inRow.cashIn + exchange.cashInAmount)
    byCurrency.set(exchange.cashInCurrency, inRow)

    const outRow = byCurrency.get(exchange.cashOutCurrency) ?? {
      currencyCode: exchange.cashOutCurrency,
      cashIn: 0,
      cashOut: 0,
    }
    outRow.cashOut = roundMoney(outRow.cashOut + exchange.cashOutAmount)
    byCurrency.set(exchange.cashOutCurrency, outRow)
  })

  return [...byCurrency.values()].sort((a, b) =>
    a.currencyCode.localeCompare(b.currencyCode, 'es'),
  )
}

export function mapCurrencyExchangeToReportRow(exchange: CurrencyExchange): CurrencyExchangeReportRow {
  return {
    id: exchange.id,
    createdAt: exchange.createdAt,
    cashInCurrency: exchange.cashInCurrency,
    cashInAmount: exchange.cashInAmount,
    cashInMethodName: exchange.cashInMethodName,
    cashInReference: exchange.cashInReference,
    cashOutCurrency: exchange.cashOutCurrency,
    cashOutAmount: exchange.cashOutAmount,
    cashOutMethodName: exchange.cashOutMethodName,
    cashOutReference: exchange.cashOutReference,
    rateLabel: exchange.rateLabel,
    amountInBase: exchange.amountInBase,
    clientName: exchange.clientName,
    createdByName: exchange.createdByName,
  }
}

export function filterSalesByPeriod(sales: Sale[], period: ReportPeriod) {
  const now = new Date()

  if (period === 'today') {
    return sales.filter((sale) => sale.status !== 'cancelled' && isSameDay(sale.createdAt, now))
  }

  const start = new Date(now)
  if (period === 'week') {
    start.setDate(now.getDate() - 7)
  } else {
    start.setMonth(now.getMonth() - 1)
  }

  return sales.filter(
    (sale) => sale.status !== 'cancelled' && isInRange(sale.createdAt, start, now),
  )
}

export function filterWasteByPeriod(movements: InventoryMovement[], period: ReportPeriod) {
  const now = new Date()

  if (period === 'today') {
    return movements.filter((movement) => isSameDay(movement.createdAt, now))
  }

  const start = new Date(now)
  if (period === 'week') {
    start.setDate(now.getDate() - 7)
  } else {
    start.setMonth(now.getMonth() - 1)
  }

  return movements.filter((movement) => isInRange(movement.createdAt, start, now))
}

export function summarizeWaste(movements: InventoryMovement[]): WastePeriodStats {
  return {
    count: movements.length,
    totalCost: roundMoney(movements.reduce((sum, movement) => sum + getMovementWasteCost(movement), 0)),
  }
}

export function summarizeSales(
  sales: Sale[],
  canViewProfit = true,
  wasteCost = 0,
): SalesPeriodStats {
  const totals = sales.reduce(
    (acc, sale) => ({
      count: acc.count + 1,
      revenue: acc.revenue + sale.total,
      profit: acc.profit + (canViewProfit ? (sale.profitTotal ?? 0) : 0),
    }),
    { count: 0, revenue: 0, profit: 0 },
  )

  const adjustedProfit = canViewProfit ? roundMoney(totals.profit - wasteCost) : 0

  return {
    ...totals,
    marginPercent: computeMarginPercent(totals.revenue, totals.profit),
    wasteCost: canViewProfit ? wasteCost : undefined,
    adjustedProfit: canViewProfit ? adjustedProfit : undefined,
    adjustedMarginPercent: canViewProfit
      ? computeMarginPercent(totals.revenue, adjustedProfit)
      : undefined,
  }
}

function getLocalDateKey(dateIso: string) {
  const date = new Date(dateIso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function loadSaleItemsMap(sales: Sale[]) {
  const entries = await Promise.all(
    sales.map(async (sale) => [sale.id, await getSaleItems(sale.id)] as const),
  )
  return new Map<string, SaleItem[]>(entries)
}

export function getSalesByDay(sales: Sale[], canViewProfit: boolean): SalesByDayRow[] {
  const byDay = new Map<string, SalesByDayRow>()

  sales.forEach((sale) => {
    const dateKey = getLocalDateKey(sale.createdAt)
    const dateLabel = new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(
      new Date(sale.createdAt),
    )
    const current = byDay.get(dateKey) ?? {
      dateKey,
      dateLabel,
      count: 0,
      revenue: 0,
      profit: 0,
    }

    current.count += 1
    current.revenue += sale.total
    current.profit += canViewProfit ? (sale.profitTotal ?? 0) : 0
    byDay.set(dateKey, current)
  })

  return [...byDay.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

export function getSalesByCashier(sales: Sale[], canViewProfit: boolean): SalesByCashierRow[] {
  const byCashier = new Map<string, SalesByCashierRow>()

  sales.forEach((sale) => {
    const current = byCashier.get(sale.cashierId) ?? {
      cashierId: sale.cashierId,
      cashierName: sale.cashierName,
      count: 0,
      revenue: 0,
      profit: 0,
    }

    current.count += 1
    current.revenue += sale.total
    current.profit += canViewProfit ? (sale.profitTotal ?? 0) : 0
    byCashier.set(sale.cashierId, current)
  })

  return [...byCashier.values()].sort((a, b) => b.revenue - a.revenue)
}

export function getTopProductsFromItems(
  itemsBySale: Map<string, SaleItem[]>,
  limit = 10,
): TopProductRow[] {
  const totals = new Map<string, TopProductRow>()

  itemsBySale.forEach((items) => {
    items.forEach((item) => {
      const current = totals.get(item.productId) ?? {
        productId: item.productId,
        productName: item.productName,
        quantity: 0,
        revenue: 0,
      }
      current.quantity += item.stockQuantity
      current.revenue += item.lineRevenue
      totals.set(item.productId, current)
    })
  })

  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit)
}

export function getSalesByCategoryFromItems(
  itemsBySale: Map<string, SaleItem[]>,
  products: Product[],
  canViewProfit: boolean,
): SalesByCategoryRow[] {
  const productTypeMap = new Map(products.map((product) => [product.id, product.type]))
  const totals = new Map<ProductType, SalesByCategoryRow>()

  itemsBySale.forEach((items) => {
    items.forEach((item) => {
      const category = productTypeMap.get(item.productId) ?? 'abasto'
      const current = totals.get(category) ?? {
        category,
        categoryLabel: categoryLabels[category] ?? category,
        quantity: 0,
        revenue: 0,
        profit: 0,
      }

      current.quantity += item.stockQuantity
      current.revenue += item.lineRevenue
      current.profit += canViewProfit ? item.lineProfit : 0
      totals.set(category, current)
    })
  })

  return [...totals.values()].sort((a, b) => b.revenue - a.revenue)
}

export async function getTopProducts(sales: Sale[], limit = 10): Promise<TopProductRow[]> {
  const itemsBySale = await loadSaleItemsMap(sales)
  return getTopProductsFromItems(itemsBySale, limit)
}

export function getLowStockProducts(products: Product[]): LowStockRow[] {
  return products
    .map((product) => {
      const status = getStockStatus(product)
      if (status === 'ok') return null

      return {
        productId: product.id,
        productName: product.name,
        stock: product.stock,
        minStock: product.minStock,
        unitLabel: product.unitLabel,
        status,
      }
    })
    .filter((row): row is LowStockRow => row !== null)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'out' ? -1 : 1
      return a.stock - b.stock
    })
}

export async function getDashboardStats(canViewProfit: boolean): Promise<DashboardStats> {
  const [sales, products, debts, loans, categories, settings, purchaseInvoices] =
    await Promise.all([
    listSales(500),
    listAllProducts(),
    listActiveDebts(),
    listActiveLoans(),
    listStockCategories(),
    getAppSettings(),
    listPurchaseInvoices(),
  ])

  const todaySalesList = filterSalesByPeriod(sales, 'today')
  const todaySales = summarizeSales(todaySalesList, canViewProfit)

  const activeProducts = enrichProductsWithCategoryStock(
    products.filter((product) => product.active),
    categories,
  )
  const lowStock = getLowStockProducts(activeProducts)
  const pendingPurchaseInvoices = mapPendingPurchaseInvoices(purchaseInvoices)

  return {
    todaySales,
    productCount: activeProducts.length,
    lowStockCount: lowStock.length,
    lowStock,
    lowStockAlertEnabled: settings.lowStockAlertEnabled,
    activeDebtBalance: debts.reduce((sum, debt) => sum + debt.balance, 0),
    activeLoanBalance: loans.reduce((sum, loan) => sum + loan.balanceInBase, 0),
    pendingPurchaseInvoices,
    pendingPurchaseInvoicesTotalDueInBase: pendingPurchaseInvoices.reduce(
      (sum, invoice) => sum + invoice.amountDueInBase,
      0,
    ),
  }
}

export interface ReportData {
  summary: SalesPeriodStats
  wasteSummary: WastePeriodStats
  exchangeSummary: CurrencyExchangeSummary
  exchanges: CurrencyExchangeReportRow[]
  exchangeFlowByCurrency: CurrencyExchangeFlowRow[]
  topProducts: TopProductRow[]
  byDay: SalesByDayRow[]
  byCashier: SalesByCashierRow[]
  byCategory: SalesByCategoryRow[]
  lowStock: LowStockRow[]
  sales: Sale[]
}

export async function getReportData(period: ReportPeriod, canViewProfit: boolean): Promise<ReportData> {
  const [sales, products, categories, allExchanges, wasteMovements] = await Promise.all([
    listSales(500),
    listAllProducts(),
    listStockCategories(),
    listCurrencyExchanges(),
    listWasteMovements(500),
  ])

  const periodSales = filterSalesByPeriod(sales, period)
  const periodWaste = filterWasteByPeriod(wasteMovements, period)
  const wasteSummary = summarizeWaste(periodWaste)
  const summary = summarizeSales(periodSales, canViewProfit, wasteSummary.totalCost)
  const periodExchanges = filterExchangesByPeriod(allExchanges, period)
  const itemsBySale = await loadSaleItemsMap(periodSales)
  const enrichedProducts = enrichProductsWithCategoryStock(
    products.filter((product) => product.active),
    categories,
  )

  return {
    summary,
    wasteSummary,
    exchangeSummary: summarizeCurrencyExchanges(periodExchanges),
    exchanges: periodExchanges.map(mapCurrencyExchangeToReportRow),
    exchangeFlowByCurrency: getExchangeFlowByCurrency(periodExchanges),
    topProducts: getTopProductsFromItems(itemsBySale),
    byDay: getSalesByDay(periodSales, canViewProfit),
    byCashier: getSalesByCashier(periodSales, canViewProfit),
    byCategory: getSalesByCategoryFromItems(itemsBySale, products, canViewProfit),
    lowStock: getLowStockProducts(enrichedProducts),
    sales: periodSales,
  }
}

export interface SalesCollectionStats {
  count: number
  totalAmount: number
  cashInRegister: number
  creditAmount: number
  totalProfit: number
}

export async function resolveSalePaymentTotals(sale: Sale) {
  if (sale.cashPaid !== undefined && sale.creditPaid !== undefined) {
    return { cashPaid: sale.cashPaid, creditPaid: sale.creditPaid }
  }

  const payments = await getSalePayments(sale.id)
  const cashPaid = payments
    .filter((payment) => !payment.isCredit)
    .reduce((sum, payment) => sum + payment.amountInBase, 0)
  const creditPaid = payments
    .filter((payment) => payment.isCredit)
    .reduce((sum, payment) => sum + payment.amountInBase, 0)

  return { cashPaid, creditPaid }
}

export interface EnrichedSale extends Sale {
  cashPaid: number
  creditPaid: number
  cashByCurrency: CurrencyCashTotal[]
}

export interface EnrichedSalesResult {
  sales: EnrichedSale[]
  cashByCurrency: CurrencyCashTotal[]
}

export async function enrichSalesWithPayments(sales: Sale[]): Promise<EnrichedSalesResult> {
  const currencyBreakdown: CurrencyCashTotal[] = []

  const enriched = await Promise.all(
    sales.map(async (sale) => {
      const payments = await getSalePayments(sale.id)
      const saleCashByCurrency = aggregateCashByCurrency(payments)
      currencyBreakdown.push(...saleCashByCurrency)

      const cashPaid = payments
        .filter((payment) => !payment.isCredit)
        .reduce((sum, payment) => sum + payment.amountInBase, 0)
      const creditPaid = payments
        .filter((payment) => payment.isCredit)
        .reduce((sum, payment) => sum + payment.amountInBase, 0)

      return {
        ...sale,
        cashPaid: sale.cashPaid ?? cashPaid,
        creditPaid: sale.creditPaid ?? creditPaid,
        cashByCurrency: saleCashByCurrency,
      }
    }),
  )

  return {
    sales: enriched,
    cashByCurrency: mergeCurrencyCashTotals(currencyBreakdown),
  }
}

export function summarizeSalesCollection(
  sales: Array<Sale & { cashPaid?: number; creditPaid?: number }>,
  canViewProfit: boolean,
): SalesCollectionStats {
  return sales.reduce(
    (acc, sale) => ({
      count: acc.count + 1,
      totalAmount: acc.totalAmount + sale.total,
      cashInRegister: acc.cashInRegister + (sale.cashPaid ?? 0),
      creditAmount: acc.creditAmount + (sale.creditPaid ?? 0),
      totalProfit: acc.totalProfit + (canViewProfit ? (sale.profitTotal ?? 0) : 0),
    }),
    { count: 0, totalAmount: 0, cashInRegister: 0, creditAmount: 0, totalProfit: 0 },
  )
}
