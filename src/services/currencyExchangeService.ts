import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { CreateCurrencyExchangeInput, CurrencyExchange } from '../types/currencyExchange'
import type { ExchangeRate, ExchangeRateFormInput } from '../types/finance'

function mapCurrencyExchangeRate(id: string, data: Record<string, unknown>): ExchangeRate {
  const effectiveDate = data.effectiveDate as { toDate?: () => Date } | string | undefined
  const effectiveDateIso =
    typeof effectiveDate === 'object' && effectiveDate?.toDate
      ? effectiveDate.toDate().toISOString()
      : typeof effectiveDate === 'string'
        ? effectiveDate
        : new Date().toISOString()

  return {
    id,
    fromCurrency: String(data.fromCurrency ?? '').toUpperCase(),
    toCurrency: String(data.toCurrency ?? '').toUpperCase(),
    fromAmount: Number(data.fromAmount ?? 1),
    toAmount: Number(data.toAmount ?? 1),
    operation: data.operation === 'divide' ? 'divide' : 'multiply',
    calculationMode: data.calculationMode === 'operation' ? 'operation' : 'ratio',
    effectiveDate: effectiveDateIso,
  }
}

function validateCurrencyExchangeRateInput(input: ExchangeRateFormInput) {
  const fromCurrency = input.fromCurrency.trim().toUpperCase()
  const toCurrency = input.toCurrency.trim().toUpperCase()

  if (!fromCurrency || !toCurrency) {
    throw new Error('Selecciona las dos monedas de la tasa de cambio.')
  }

  if (fromCurrency === toCurrency) {
    throw new Error('Las monedas de origen y destino deben ser distintas.')
  }

  if (!input.fromAmount || input.fromAmount <= 0 || !input.toAmount || input.toAmount <= 0) {
    throw new Error('Los montos de la tasa deben ser mayores a cero.')
  }

  if (input.operation !== 'multiply' && input.operation !== 'divide') {
    throw new Error('Selecciona si la tasa se multiplica o se divide.')
  }

  return { fromCurrency, toCurrency }
}

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

export async function listLatestCurrencyExchangeRates(): Promise<ExchangeRate[]> {
  const snapshot = await getDocs(collection(db, 'currency_exchange_rates'))
  const rates = new Map<string, ExchangeRate>()

  snapshot.docs.forEach((item) => {
    const mapped = mapCurrencyExchangeRate(item.id, item.data())
    const key = `${mapped.fromCurrency}->${mapped.toCurrency}`
    const current = rates.get(key)

    if (!current || mapped.effectiveDate > current.effectiveDate) {
      rates.set(key, mapped)
    }
  })

  return [...rates.values()].sort((a, b) => {
    const byFrom = a.fromCurrency.localeCompare(b.fromCurrency)
    return byFrom !== 0 ? byFrom : a.toCurrency.localeCompare(b.toCurrency)
  })
}

export async function createCurrencyExchangeRate(
  input: ExchangeRateFormInput,
  userId: string,
) {
  const { fromCurrency, toCurrency } = validateCurrencyExchangeRateInput(input)

  const existing = await listLatestCurrencyExchangeRates()
  if (existing.some((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency)) {
    throw new Error('Ya existe una tasa para este par. Edítala desde la lista.')
  }

  const ref = doc(collection(db, 'currency_exchange_rates'))
  await setDoc(ref, {
    fromCurrency,
    toCurrency,
    fromAmount: input.fromAmount,
    toAmount: input.toAmount,
    operation: input.operation,
    calculationMode: 'operation',
    effectiveDate: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })

  return ref.id
}

export async function updateCurrencyExchangeRate(id: string, input: ExchangeRateFormInput) {
  const { fromCurrency, toCurrency } = validateCurrencyExchangeRateInput(input)

  const existing = await listLatestCurrencyExchangeRates()
  const duplicate = existing.find(
    (rate) =>
      rate.id !== id && rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency,
  )
  if (duplicate) {
    throw new Error('Ya existe otra tasa con este par de monedas.')
  }

  await updateDoc(doc(db, 'currency_exchange_rates', id), {
    fromCurrency,
    toCurrency,
    fromAmount: input.fromAmount,
    toAmount: input.toAmount,
    operation: input.operation,
    calculationMode: 'operation',
    effectiveDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteCurrencyExchangeRate(id: string) {
  await deleteDoc(doc(db, 'currency_exchange_rates', id))
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
