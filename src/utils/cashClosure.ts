import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import type { CashClosureReport, CashClosureSaleLine } from '../types/cashClosure'
import { roundMoney } from './formatMoney'

export const closurePaymentStatusLabels: Record<string, string> = {
  paid: 'Pagada',
  partial: 'Pago parcial',
  pending: 'A crédito',
}

export function resolveClosureSalePaymentStatus(sale: CashClosureSaleLine): string {
  if (sale.creditPaid <= 0.01) return 'paid'
  if (sale.cashPaid <= 0.01) return 'pending'
  return 'partial'
}

export function getExpectedCashInBase(report: CashClosureReport): number {
  const copRow = report.netByCurrency?.find(
    (row) => row.currencyCode === DEFAULT_BASE_CURRENCY_CODE,
  )
  if (copRow) return copRow.net

  return roundMoney(
    (report.totalCashInBase ?? 0) - (report.loansGivenInBase ?? 0),
  )
}

export function formatClosureDateTime(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
