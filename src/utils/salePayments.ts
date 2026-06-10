import { roundMoney } from './formatMoney'
import type { SalePayment } from '../types/sale'

export interface CurrencyCashTotal {
  currencyCode: string
  cashAmount: number
  baseEquivalent: number
}

export function isRegisterCashPayment(payment: SalePayment) {
  return !payment.isCredit && !payment.isDebtCollection
}

export function aggregateCashByCurrency(payments: SalePayment[]): CurrencyCashTotal[] {
  const totals = new Map<string, { cashAmount: number; baseEquivalent: number }>()

  payments.filter(isRegisterCashPayment).forEach((payment) => {
    const current = totals.get(payment.currencyCode) ?? { cashAmount: 0, baseEquivalent: 0 }
    current.cashAmount = roundMoney(current.cashAmount + payment.amount)
    current.baseEquivalent = roundMoney(current.baseEquivalent + payment.amountInBase)
    totals.set(payment.currencyCode, current)
  })

  return [...totals.entries()]
    .map(([currencyCode, amounts]) => ({
      currencyCode,
      cashAmount: amounts.cashAmount,
      baseEquivalent: amounts.baseEquivalent,
    }))
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode, 'es'))
}

export function mergeCurrencyCashTotals(
  entries: CurrencyCashTotal[],
): CurrencyCashTotal[] {
  const totals = new Map<string, { cashAmount: number; baseEquivalent: number }>()

  entries.forEach((entry) => {
    const current = totals.get(entry.currencyCode) ?? { cashAmount: 0, baseEquivalent: 0 }
    current.cashAmount = roundMoney(current.cashAmount + entry.cashAmount)
    current.baseEquivalent = roundMoney(current.baseEquivalent + entry.baseEquivalent)
    totals.set(entry.currencyCode, current)
  })

  return [...totals.entries()]
    .map(([currencyCode, amounts]) => ({
      currencyCode,
      cashAmount: amounts.cashAmount,
      baseEquivalent: amounts.baseEquivalent,
    }))
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode, 'es'))
}
