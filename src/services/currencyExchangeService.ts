import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { CreateCurrencyExchangeInput, CurrencyExchange } from '../types/currencyExchange'

function mapCurrencyExchange(id: string, data: Record<string, unknown>): CurrencyExchange {
  const createdAt = data.createdAt as { toDate?: () => Date } | string | undefined
  const cashInCurrency = String(data.cashInCurrency ?? data.fromCurrency ?? '').toUpperCase()
  const cashOutCurrency = String(data.cashOutCurrency ?? data.toCurrency ?? '').toUpperCase()
  const cashInAmount = Number(data.cashInAmount ?? data.fromAmount ?? 0)
  const cashOutAmount = Number(data.cashOutAmount ?? data.toAmount ?? 0)

  return {
    id,
    cashInCurrency,
    cashInAmount,
    cashInMethodId: String(data.cashInMethodId ?? ''),
    cashInMethodName: String(data.cashInMethodName ?? 'Efectivo'),
    cashInReference: data.cashInReference ? String(data.cashInReference) : undefined,
    cashOutCurrency,
    cashOutAmount,
    cashOutMethodId: String(data.cashOutMethodId ?? ''),
    cashOutMethodName: String(data.cashOutMethodName ?? 'Efectivo'),
    cashOutReference: data.cashOutReference ? String(data.cashOutReference) : undefined,
    fromCurrency: cashInCurrency,
    toCurrency: cashOutCurrency,
    fromAmount: cashInAmount,
    toAmount: cashOutAmount,
    conversionFactor: Number(data.conversionFactor ?? 0),
    rateLabel: String(data.rateLabel ?? ''),
    amountInBase: Number(data.amountInBase ?? 0),
    baseCurrency: String(data.baseCurrency ?? '').toUpperCase(),
    exchangeRateSnapshot:
      data.exchangeRateSnapshot && typeof data.exchangeRateSnapshot === 'object'
        ? (data.exchangeRateSnapshot as Record<string, number>)
        : {},
    clientName: data.clientName ? String(data.clientName) : undefined,
    notes: data.notes ? String(data.notes) : undefined,
    createdAt:
      typeof createdAt === 'object' && createdAt?.toDate
        ? createdAt.toDate().toISOString()
        : typeof createdAt === 'string'
          ? createdAt
          : new Date().toISOString(),
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
  }
}

export async function listCurrencyExchanges(): Promise<CurrencyExchange[]> {
  const snapshot = await getDocs(collection(db, 'currency_exchanges'))
  return snapshot.docs
    .map((item) => mapCurrencyExchange(item.id, item.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createCurrencyExchange(
  input: CreateCurrencyExchangeInput,
  userId: string,
  userName: string,
) {
  const cashInCurrency = input.cashInCurrency.trim().toUpperCase()
  const cashOutCurrency = input.cashOutCurrency.trim().toUpperCase()

  if (!cashInCurrency || !cashOutCurrency) {
    throw new Error('Selecciona las dos monedas del cambio.')
  }

  if (cashInCurrency === cashOutCurrency) {
    throw new Error('La moneda que entra y la que sale deben ser distintas.')
  }

  if (!input.cashInAmount || input.cashInAmount <= 0 || !input.cashOutAmount || input.cashOutAmount <= 0) {
    throw new Error('Los montos del cambio deben ser mayores a cero.')
  }

  if (!input.cashInMethodName.trim() || !input.cashOutMethodName.trim()) {
    throw new Error('Indica la forma de pago de la entrada y de la salida.')
  }

  const ref = doc(collection(db, 'currency_exchanges'))
  await setDoc(ref, {
    cashInCurrency,
    cashInAmount: input.cashInAmount,
    cashInMethodId: input.cashInMethodId || null,
    cashInMethodName: input.cashInMethodName.trim(),
    cashInReference: input.cashInReference?.trim() || null,
    cashOutCurrency,
    cashOutAmount: input.cashOutAmount,
    cashOutMethodId: input.cashOutMethodId || null,
    cashOutMethodName: input.cashOutMethodName.trim(),
    cashOutReference: input.cashOutReference?.trim() || null,
    fromCurrency: cashInCurrency,
    toCurrency: cashOutCurrency,
    fromAmount: input.cashInAmount,
    toAmount: input.cashOutAmount,
    conversionFactor: input.conversionFactor,
    rateLabel: input.rateLabel,
    amountInBase: input.amountInBase,
    baseCurrency: input.baseCurrency,
    exchangeRateSnapshot: input.exchangeRateSnapshot,
    clientName: input.clientName?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: serverTimestamp(),
    createdBy: userId,
    createdByName: userName,
  })

  return ref.id
}

export async function deleteCurrencyExchange(id: string) {
  await deleteDoc(doc(db, 'currency_exchanges', id))
}
