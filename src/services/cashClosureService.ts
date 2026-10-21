import {
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import { tenantCollectionRef, tenantDocumentRef } from '../lib/tenantFirestore'
import type {
  CashClosure,
  CashClosureExchangeLine,
  CashClosureLoanLine,
  CashClosureMovementLine,
  CashClosureMethodTotal,
  CashClosurePaymentLine,
  CashClosureReport,
  CashClosureSaleLine,
} from '../types/cashClosure'
import type { Loan, LoanPayment } from '../types/loan'
import { isOnLocalDate } from '../utils/dates'
import { stripUndefinedDeep } from '../utils/firestore'
import { roundMoney } from '../utils/formatMoney'
import { aggregateCashByCurrency, mergeCurrencyCashTotals } from '../utils/salePayments'
import { listCurrencyExchanges } from './currencyExchangeService'
import { listCashMovementsByDate } from './cashMovementService'
import { getSalePayments, listSales } from './saleService'
import type { DebtPayment } from '../types/debt'
import type { SalePayment } from '../types/sale'

function mapTimestamp(value: unknown) {
  const typed = value as { toDate?: () => Date } | string | undefined
  if (typeof typed === 'object' && typed?.toDate) {
    return typed.toDate().toISOString()
  }
  if (typeof typed === 'string') return typed
  return ''
}

function mapDebtPayment(id: string, data: Record<string, unknown>): DebtPayment {
  return {
    id,
    debtId: String(data.debtId ?? ''),
    clientId: String(data.clientId ?? ''),
    amount: Number(data.amount ?? 0),
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE),
    amountInBase: Number(data.amountInBase ?? data.amount ?? 0),
    methodName: String(data.methodName ?? ''),
    reference: data.reference ? String(data.reference) : undefined,
    createdAt: mapTimestamp(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

function mapCashClosure(id: string, data: Record<string, unknown>): CashClosure {
  return {
    id,
    closureDate: String(data.closureDate ?? ''),
    report: data.report as CashClosureReport,
    createdAt: mapTimestamp(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
  }
}

function salePaymentToLine(
  payment: SalePayment,
  saleNumber: string,
  clientName?: string,
): CashClosurePaymentLine {
  return {
    id: payment.id,
    source: 'sale',
    reference: `Venta ${saleNumber}`,
    createdAt: payment.createdAt ?? '',
    methodName: payment.isCredit
      ? `Crédito · ${payment.clientName ?? clientName ?? 'Cliente'}`
      : payment.isDebtCollection
        ? `Cobro de deuda · ${payment.methodName}`
        : payment.methodName,
    currencyCode: payment.currencyCode,
    amount: payment.amount,
    amountInBase: payment.amountInBase,
    clientName: payment.clientName ?? clientName,
    isCredit: payment.isCredit,
  }
}

function mapLoan(id: string, data: Record<string, unknown>): Loan {
  return {
    id,
    borrowerName: String(data.borrowerName ?? ''),
    borrowerPhone: String(data.borrowerPhone ?? ''),
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE),
    originalAmount: Number(data.originalAmount ?? 0),
    amountInBase: Number(data.amountInBase ?? 0),
    balance: Number(data.balance ?? data.originalAmount ?? 0),
    balanceInBase: Number(data.balanceInBase ?? data.amountInBase ?? 0),
    status: (data.status as Loan['status']) ?? 'active',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: mapTimestamp(data.createdAt),
    updatedAt: data.updatedAt ? mapTimestamp(data.updatedAt) : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

function mapLoanPayment(id: string, data: Record<string, unknown>): LoanPayment {
  return {
    id,
    loanId: String(data.loanId ?? ''),
    borrowerPhone: String(data.borrowerPhone ?? ''),
    amount: Number(data.amount ?? 0),
    currencyCode: String(data.currencyCode ?? DEFAULT_BASE_CURRENCY_CODE),
    amountInBase: Number(data.amountInBase ?? 0),
    methodName: String(data.methodName ?? ''),
    reference: data.reference ? String(data.reference) : undefined,
    createdAt: mapTimestamp(data.createdAt),
    createdBy: String(data.createdBy ?? ''),
    createdByName: data.createdByName ? String(data.createdByName) : undefined,
  }
}

function loanPaymentToLine(payment: LoanPayment, borrowerName?: string): CashClosurePaymentLine {
  return {
    id: payment.id,
    source: 'loan',
    reference: `Abono préstamo${borrowerName ? ` · ${borrowerName}` : ''}`,
    createdAt: payment.createdAt,
    methodName: payment.methodName,
    currencyCode: payment.currencyCode,
    amount: payment.amount,
    amountInBase: payment.amountInBase,
    clientName: borrowerName,
  }
}

function debtPaymentToLine(payment: DebtPayment, clientName?: string): CashClosurePaymentLine {
  return {
    id: payment.id,
    source: 'debt',
    reference: `Abono deuda`,
    createdAt: payment.createdAt,
    methodName: payment.methodName,
    currencyCode: payment.currencyCode,
    amount: payment.amount,
    amountInBase: payment.amountInBase,
    clientName,
  }
}

function buildNetByCurrency(
  cashByCurrency: ReturnType<typeof aggregateCashByCurrency>,
  exchanges: CashClosureExchangeLine[],
  loansGiven: CashClosureLoanLine[],
  cashMovements: CashClosureMovementLine[],
) {
  const netMap = new Map<string, { cashIn: number; cashOut: number }>()

  cashByCurrency.forEach((entry) => {
    const current = netMap.get(entry.currencyCode) ?? { cashIn: 0, cashOut: 0 }
    current.cashIn = roundMoney(current.cashIn + entry.cashAmount)
    netMap.set(entry.currencyCode, current)
  })

  exchanges.forEach((exchange) => {
    const inRow = netMap.get(exchange.cashInCurrency) ?? { cashIn: 0, cashOut: 0 }
    inRow.cashIn = roundMoney(inRow.cashIn + exchange.cashInAmount)
    netMap.set(exchange.cashInCurrency, inRow)

    const outRow = netMap.get(exchange.cashOutCurrency) ?? { cashIn: 0, cashOut: 0 }
    outRow.cashOut = roundMoney(outRow.cashOut + exchange.cashOutAmount)
    netMap.set(exchange.cashOutCurrency, outRow)
  })

  loansGiven.forEach((loan) => {
    const out = netMap.get(loan.currencyCode) ?? { cashIn: 0, cashOut: 0 }
    out.cashOut = roundMoney(out.cashOut + loan.amount)
    netMap.set(loan.currencyCode, out)
  })

  cashMovements.forEach((movement) => {
    const row = netMap.get(movement.currencyCode) ?? { cashIn: 0, cashOut: 0 }
    if (movement.type === 'out') {
      row.cashOut = roundMoney(row.cashOut + movement.amount)
    } else {
      row.cashIn = roundMoney(row.cashIn + movement.amount)
    }
    netMap.set(movement.currencyCode, row)
  })

  return [...netMap.entries()]
    .map(([currencyCode, totals]) => ({
      currencyCode,
      cashIn: totals.cashIn,
      cashOut: totals.cashOut,
      net: roundMoney(totals.cashIn - totals.cashOut),
    }))
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode, 'es'))
}

function buildByMethod(
  payments: CashClosurePaymentLine[],
  cashMovements: CashClosureMovementLine[],
): CashClosureMethodTotal[] {
  const map = new Map<string, CashClosureMethodTotal>()

  function addRow(methodName: string, currencyCode: string, amount: number, amountInBase: number) {
    const key = `${methodName}::${currencyCode}`
    const current = map.get(key) ?? {
      methodName,
      currencyCode,
      amount: 0,
      amountInBase: 0,
    }
    current.amount = roundMoney(current.amount + amount)
    current.amountInBase = roundMoney(current.amountInBase + amountInBase)
    map.set(key, current)
  }

  payments
    .filter((payment) => !payment.isCredit)
    .forEach((payment) => {
      addRow(payment.methodName, payment.currencyCode, payment.amount, payment.amountInBase)
    })

  cashMovements.forEach((movement) => {
    const sign = movement.type === 'out' ? -1 : 1
    addRow(
      movement.methodName || 'Caja',
      movement.currencyCode,
      movement.amount * sign,
      movement.amountInBase * sign,
    )
    })

  return [...map.values()].sort(
    (a, b) =>
      a.methodName.localeCompare(b.methodName, 'es') ||
      a.currencyCode.localeCompare(b.currencyCode, 'es'),
  )
}

export async function buildCashClosureReport(closureDate: string): Promise<CashClosureReport> {
  const [sales, debtPaymentsSnapshot, loanPaymentsSnapshot, loansSnapshot, exchanges, cashMovements] =
    await Promise.all([
      listSales(1000),
      getDocs(tenantCollectionRef('debt_payments')),
      getDocs(tenantCollectionRef('loan_payments')),
      getDocs(tenantCollectionRef('loans')),
      listCurrencyExchanges(),
      listCashMovementsByDate(closureDate),
    ])

  const daySales = sales.filter(
    (sale) => sale.status !== 'cancelled' && isOnLocalDate(sale.createdAt, closureDate),
  )

  const saleLines: CashClosureSaleLine[] = []
  const paymentLines: CashClosurePaymentLine[] = []
  const registerPayments: SalePayment[] = []

  let totalSoldInBase = 0
  let cashInSalesInBase = 0
  let creditSalesInBase = 0

  for (const sale of daySales) {
    const payments = await getSalePayments(sale.id)
    const cashPaid = payments
      .filter((payment) => !payment.isCredit && !payment.isDebtCollection)
      .reduce((sum, payment) => sum + payment.amountInBase, 0)
    const creditPaid = payments
      .filter((payment) => payment.isCredit)
      .reduce((sum, payment) => sum + payment.amountInBase, 0)

    totalSoldInBase = roundMoney(totalSoldInBase + sale.total)
    cashInSalesInBase = roundMoney(cashInSalesInBase + cashPaid)
    creditSalesInBase = roundMoney(creditSalesInBase + creditPaid)

    saleLines.push({
      saleId: sale.id,
      saleNumber: sale.number,
      createdAt: sale.createdAt,
      clientName: sale.clientName,
      cashierName: sale.cashierName,
      total: sale.total,
      cashPaid,
      creditPaid,
    })

    payments.forEach((payment) => {
      if (payment.isDebtCollection) return

      paymentLines.push(salePaymentToLine(payment, sale.number, sale.clientName))
      if (!payment.isCredit) {
        registerPayments.push(payment)
      }
    })
  }

  const debtPayments = debtPaymentsSnapshot.docs
    .map((item) => mapDebtPayment(item.id, item.data()))
    .filter((payment) => isOnLocalDate(payment.createdAt, closureDate))

  const debtCollectionsInBase = roundMoney(
    debtPayments.reduce((sum, payment) => sum + payment.amountInBase, 0),
  )

  debtPayments.forEach((payment) => {
    paymentLines.push(debtPaymentToLine(payment))
    registerPayments.push({
      id: payment.id,
      methodId: '',
      methodName: payment.methodName,
      currencyCode: payment.currencyCode,
      amount: payment.amount,
      amountInBase: payment.amountInBase,
      reference: payment.reference,
      createdAt: payment.createdAt,
    })
  })

  const loans = loansSnapshot.docs.map((item) => mapLoan(item.id, item.data()))
  const loanNameById = new Map(loans.map((loan) => [loan.id, loan.borrowerName]))

  const loanGivenLines: CashClosureLoanLine[] = loans
    .filter((loan) => isOnLocalDate(loan.createdAt, closureDate))
    .map((loan) => ({
      id: loan.id,
      createdAt: loan.createdAt,
      borrowerName: loan.borrowerName,
      borrowerPhone: loan.borrowerPhone,
      currencyCode: loan.currencyCode,
      amount: loan.originalAmount,
      amountInBase: loan.amountInBase,
      notes: loan.notes,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const loansGivenInBase = roundMoney(
    loanGivenLines.reduce((sum, loan) => sum + loan.amountInBase, 0),
  )

  const loanPayments = loanPaymentsSnapshot.docs
    .map((item) => mapLoanPayment(item.id, item.data()))
    .filter((payment) => isOnLocalDate(payment.createdAt, closureDate))

  const loanRepaymentsInBase = roundMoney(
    loanPayments.reduce((sum, payment) => sum + payment.amountInBase, 0),
  )

  loanPayments.forEach((payment) => {
    paymentLines.push(
      loanPaymentToLine(payment, loanNameById.get(payment.loanId)),
    )
    registerPayments.push({
      id: payment.id,
      methodId: '',
      methodName: payment.methodName,
      currencyCode: payment.currencyCode,
      amount: payment.amount,
      amountInBase: payment.amountInBase,
      reference: payment.reference,
      createdAt: payment.createdAt,
    })
  })

  const exchangeLines: CashClosureExchangeLine[] = exchanges
    .filter((exchange) => isOnLocalDate(exchange.createdAt, closureDate))
    .map((exchange) => ({
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
      fromCurrency: exchange.fromCurrency,
      toCurrency: exchange.toCurrency,
      fromAmount: exchange.fromAmount,
      toAmount: exchange.toAmount,
      rateLabel: exchange.rateLabel,
      amountInBase: exchange.amountInBase,
      clientName: exchange.clientName,
      createdByName: exchange.createdByName,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const exchangesVolumeInBase = roundMoney(
    exchangeLines.reduce((sum, exchange) => sum + exchange.amountInBase, 0),
  )

  const cashMovementLines: CashClosureMovementLine[] = cashMovements
    .map((movement) => ({
      id: movement.id,
      type: movement.type,
      description: movement.description,
      createdAt: movement.createdAt,
      currencyCode: movement.currencyCode,
      amount: movement.amount,
      amountInBase: movement.amountInBase,
      methodName: movement.methodName,
      reference: movement.reference,
      notes: movement.notes,
      createdByName: movement.createdByName,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const openingCashInBase = roundMoney(
    cashMovementLines
      .filter((movement) => movement.type === 'opening')
      .reduce((sum, movement) => sum + movement.amountInBase, 0),
  )
  const extraCashInBase = roundMoney(
    cashMovementLines
      .filter((movement) => movement.type === 'in')
      .reduce((sum, movement) => sum + movement.amountInBase, 0),
  )
  const extraCashOutInBase = roundMoney(
    cashMovementLines
      .filter((movement) => movement.type === 'out')
      .reduce((sum, movement) => sum + movement.amountInBase, 0),
  )

  const cashByCurrency = mergeCurrencyCashTotals([
    ...aggregateCashByCurrency(registerPayments),
    ...debtPayments.map((payment) => ({
      currencyCode: payment.currencyCode,
      cashAmount: payment.amount,
      baseEquivalent: payment.amountInBase,
    })),
  ])

  const totalCashInBase = roundMoney(
    cashInSalesInBase + debtCollectionsInBase + loanRepaymentsInBase,
  )

  return {
    closureDate,
    salesCount: daySales.length,
    totalSoldInBase,
    cashInSalesInBase,
    creditSalesInBase,
    debtCollectionsInBase,
    loansGivenInBase,
    loanRepaymentsInBase,
    exchangesCount: exchangeLines.length,
    exchangesVolumeInBase,
    openingCashInBase,
    extraCashInBase,
    extraCashOutInBase,
    totalCashInBase,
    sales: saleLines.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    payments: paymentLines.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    cashMovements: cashMovementLines,
    loansGiven: loanGivenLines,
    exchanges: exchangeLines,
    cashByCurrency,
    netByCurrency: buildNetByCurrency(cashByCurrency, exchangeLines, loanGivenLines, cashMovementLines),
    byMethod: buildByMethod(paymentLines, cashMovementLines),
  }
}

export async function listCashClosures(): Promise<CashClosure[]> {
  const snapshot = await getDocs(tenantCollectionRef('cash_closures'))
  return snapshot.docs
    .map((item) => mapCashClosure(item.id, item.data()))
    .sort((a, b) => b.closureDate.localeCompare(a.closureDate))
}

export async function getCashClosureByDate(closureDate: string): Promise<CashClosure | null> {
  const snapshot = await getDocs(
    query(tenantCollectionRef('cash_closures'), where('closureDate', '==', closureDate)),
  )

  if (snapshot.empty) return null
  const docItem = snapshot.docs[0]
  return mapCashClosure(docItem.id, docItem.data())
}

export async function createCashClosure(
  closureDate: string,
  userId: string,
  userName: string,
): Promise<CashClosure> {
  const existing = await getCashClosureByDate(closureDate)
  if (existing) {
    throw new Error(`Ya existe un cierre registrado para ${closureDate}.`)
  }

  const report = await buildCashClosureReport(closureDate)
  const ref = doc(tenantCollectionRef('cash_closures'))

  await setDoc(ref, {
    closureDate,
    report: stripUndefinedDeep(report),
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  return {
    id: ref.id,
    closureDate,
    report,
    createdAt: new Date().toISOString(),
    createdBy: userId,
    createdByName: userName,
  }
}

export async function deleteCashClosure(id: string): Promise<void> {
  await deleteDoc(tenantDocumentRef('cash_closures', id))
}
