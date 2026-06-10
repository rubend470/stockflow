import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import {
  DEFAULT_BASE_CURRENCY_CODE,
  DEFAULT_BASE_CURRENCY_NAME,
  DEFAULT_BASE_CURRENCY_SYMBOL,
} from '../constants/currency'
import { db } from '../lib/firebase'
import type {
  Currency,
  CurrencyFormInput,
  ExchangeRate,
  ExchangeRateFormInput,
  PaymentMethod,
  PaymentMethodFormInput,
} from '../types/finance'

function mapCurrency(id: string, data: Record<string, unknown>): Currency {
  return {
    id,
    code: String(data.code ?? ''),
    name: String(data.name ?? ''),
    symbol: String(data.symbol ?? ''),
    active: data.active !== false,
    isBase: data.isBase === true,
  }
}

function mapPaymentMethod(id: string, data: Record<string, unknown>): PaymentMethod {
  return {
    id,
    name: String(data.name ?? ''),
    code: String(data.code ?? ''),
    active: data.active !== false,
    allowedCurrencies: Array.isArray(data.allowedCurrencies)
      ? data.allowedCurrencies.map(String)
      : [],
    requiresReference: data.requiresReference === true,
    sortOrder: Number(data.sortOrder ?? 0),
    isDefaultForSales: data.isDefaultForSales === true,
  }
}

function mapExchangeRate(id: string, data: Record<string, unknown>): ExchangeRate {
  const effectiveDate = data.effectiveDate as { toDate?: () => Date } | string | undefined
  const effectiveDateIso =
    typeof effectiveDate === 'object' && effectiveDate?.toDate
      ? effectiveDate.toDate().toISOString()
      : typeof effectiveDate === 'string'
        ? effectiveDate
        : new Date().toISOString()

  if (data.fromCurrency && data.toCurrency) {
    return {
      id,
      fromCurrency: String(data.fromCurrency).toUpperCase(),
      toCurrency: String(data.toCurrency).toUpperCase(),
      fromAmount: Number(data.fromAmount ?? 1),
      toAmount: Number(data.toAmount ?? 1),
      effectiveDate: effectiveDateIso,
    }
  }

  const legacyCode = String(data.currencyCode ?? '').toUpperCase()
  const legacyRate = Number(data.rate ?? 1)

  return {
    id,
    fromCurrency: DEFAULT_BASE_CURRENCY_CODE,
    toCurrency: legacyCode,
    fromAmount: 1,
    toAmount: legacyRate,
    effectiveDate: effectiveDateIso,
  }
}

async function isCurrencyCodeTaken(code: string, excludeId?: string) {
  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return false

  const snapshot = await getDocs(
    query(collection(db, 'currencies'), where('code', '==', trimmed)),
  )

  return snapshot.docs.some((item) => item.id !== excludeId)
}

async function isPaymentCodeTaken(code: string, excludeId?: string) {
  const trimmed = code.trim().toLowerCase()
  if (!trimmed) return false

  const snapshot = await getDocs(
    query(collection(db, 'payment_methods'), where('code', '==', trimmed)),
  )

  return snapshot.docs.some((item) => item.id !== excludeId)
}

function slugifyPaymentCode(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'payment'
  )
}

async function buildPaymentCode(name: string, excludeId?: string) {
  const base = slugifyPaymentCode(name)
  let code = base
  let suffix = 1

  while (await isPaymentCodeTaken(code, excludeId)) {
    code = `${base}_${suffix}`
    suffix += 1
  }

  return code
}

async function clearOtherDefaultPaymentMethods(excludeId: string) {
  const methods = await listAllPaymentMethods()
  const batch = writeBatch(db)
  let hasWrites = false

  methods.forEach((method) => {
    if (method.id !== excludeId && method.isDefaultForSales) {
      batch.update(doc(db, 'payment_methods', method.id), {
        isDefaultForSales: false,
        updatedAt: serverTimestamp(),
      })
      hasWrites = true
    }
  })

  if (hasWrites) {
    await batch.commit()
  }
}

async function getNextPaymentSortOrder() {
  const methods = await listAllPaymentMethods()
  const maxOrder = methods.reduce((max, method) => Math.max(max, method.sortOrder), 0)
  return maxOrder + 1
}

export async function listCurrencies(): Promise<Currency[]> {
  const snapshot = await getDocs(collection(db, 'currencies'))
  return snapshot.docs
    .map((item) => mapCurrency(item.id, item.data()))
    .filter((currency) => currency.active)
    .sort((a, b) => Number(b.isBase) - Number(a.isBase))
}

export async function listAllCurrencies(): Promise<Currency[]> {
  const snapshot = await getDocs(collection(db, 'currencies'))
  return snapshot.docs
    .map((item) => mapCurrency(item.id, item.data()))
    .sort((a, b) => Number(b.isBase) - Number(a.isBase) || a.code.localeCompare(b.code))
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const snapshot = await getDocs(collection(db, 'payment_methods'))
  return snapshot.docs
    .map((item) => mapPaymentMethod(item.id, item.data()))
    .filter((method) => method.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listAllPaymentMethods(): Promise<PaymentMethod[]> {
  const snapshot = await getDocs(collection(db, 'payment_methods'))
  return snapshot.docs
    .map((item) => mapPaymentMethod(item.id, item.data()))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function listLatestExchangeRates(): Promise<ExchangeRate[]> {
  const snapshot = await getDocs(collection(db, 'exchange_rates'))
  const rates = new Map<string, ExchangeRate>()

  snapshot.docs.forEach((item) => {
    const mapped = mapExchangeRate(item.id, item.data())
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

export async function createCurrency(input: CurrencyFormInput, userId: string) {
  const code = input.code.trim().toUpperCase()

  if (!code || !input.name.trim() || !input.symbol.trim()) {
    throw new Error('Completa código, nombre y símbolo de la moneda.')
  }

  if (await isCurrencyCodeTaken(code)) {
    throw new Error('Ya existe una moneda con ese código.')
  }

  const batch = writeBatch(db)
  const ref = doc(collection(db, 'currencies'))

  if (input.isBase) {
    const existing = await listAllCurrencies()
    existing.forEach((currency) => {
      if (currency.isBase) {
        batch.update(doc(db, 'currencies', currency.id), { isBase: false, updatedAt: serverTimestamp() })
      }
    })
  }

  batch.set(ref, {
    code,
    name: input.name.trim(),
    symbol: input.symbol.trim(),
    active: input.active,
    isBase: input.isBase,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })

  await batch.commit()
  return ref.id
}

export async function updateCurrency(id: string, input: CurrencyFormInput) {
  const code = input.code.trim().toUpperCase()

  if (!code || !input.name.trim() || !input.symbol.trim()) {
    throw new Error('Completa código, nombre y símbolo de la moneda.')
  }

  if (await isCurrencyCodeTaken(code, id)) {
    throw new Error('Ya existe una moneda con ese código.')
  }

  const batch = writeBatch(db)

  if (input.isBase) {
    const existing = await listAllCurrencies()
    existing.forEach((currency) => {
      if (currency.id !== id && currency.isBase) {
        batch.update(doc(db, 'currencies', currency.id), { isBase: false, updatedAt: serverTimestamp() })
      }
    })
  }

  batch.update(doc(db, 'currencies', id), {
    code,
    name: input.name.trim(),
    symbol: input.symbol.trim(),
    active: input.active,
    isBase: input.isBase,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}

export async function deleteCurrency(id: string) {
  const currencies = await listAllCurrencies()
  const target = currencies.find((currency) => currency.id === id)

  if (!target) {
    throw new Error('Moneda no encontrada.')
  }

  if (target.isBase) {
    throw new Error('No puedes eliminar la moneda principal.')
  }

  const methods = await listAllPaymentMethods()
  const usedByMethod = methods.some((method) => method.allowedCurrencies.includes(target.code))
  if (usedByMethod) {
    throw new Error('Esta moneda está asociada a formas de pago. Quítala de los métodos antes de eliminar.')
  }

  await deleteDoc(doc(db, 'currencies', id))
}

export async function createPaymentMethod(input: PaymentMethodFormInput, userId: string) {
  if (!input.name.trim()) {
    throw new Error('Completa el nombre del método de pago.')
  }

  if (!input.allowedCurrencies.length) {
    throw new Error('Selecciona al menos una moneda permitida.')
  }

  const code = await buildPaymentCode(input.name)
  const sortOrder = await getNextPaymentSortOrder()

  const ref = doc(collection(db, 'payment_methods'))
  await setDoc(ref, {
    name: input.name.trim(),
    code,
    active: input.active,
    allowedCurrencies: input.allowedCurrencies,
    requiresReference: input.requiresReference,
    isDefaultForSales: input.isDefaultForSales,
    sortOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
  })

  if (input.isDefaultForSales) {
    await clearOtherDefaultPaymentMethods(ref.id)
  }

  return ref.id
}

export async function updatePaymentMethod(id: string, input: PaymentMethodFormInput) {
  if (!input.name.trim()) {
    throw new Error('Completa el nombre del método de pago.')
  }

  if (!input.allowedCurrencies.length) {
    throw new Error('Selecciona al menos una moneda permitida.')
  }

  await updateDoc(doc(db, 'payment_methods', id), {
    name: input.name.trim(),
    active: input.active,
    allowedCurrencies: input.allowedCurrencies,
    requiresReference: input.requiresReference,
    isDefaultForSales: input.isDefaultForSales,
    updatedAt: serverTimestamp(),
  })

  if (input.isDefaultForSales) {
    await clearOtherDefaultPaymentMethods(id)
  }
}

export async function deletePaymentMethod(id: string) {
  await deleteDoc(doc(db, 'payment_methods', id))
}

function validateExchangeRateInput(input: ExchangeRateFormInput) {
  const fromCurrency = input.fromCurrency.trim().toUpperCase()
  const toCurrency = input.toCurrency.trim().toUpperCase()

  if (!fromCurrency || !toCurrency) {
    throw new Error('Selecciona las dos monedas de la conversión.')
  }

  if (fromCurrency === toCurrency) {
    throw new Error('Las monedas de origen y destino deben ser distintas.')
  }

  if (!input.fromAmount || input.fromAmount <= 0 || !input.toAmount || input.toAmount <= 0) {
    throw new Error('Los montos de la tasa deben ser mayores a cero.')
  }

  return { fromCurrency, toCurrency }
}

export async function createExchangeRate(input: ExchangeRateFormInput, userId: string) {
  const { fromCurrency, toCurrency } = validateExchangeRateInput(input)

  const existing = await listLatestExchangeRates()
  if (existing.some((rate) => rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency)) {
    throw new Error('Ya existe una tasa para este par. Edítala desde la lista.')
  }

  const ref = doc(collection(db, 'exchange_rates'))
  await setDoc(ref, {
    fromCurrency,
    toCurrency,
    fromAmount: input.fromAmount,
    toAmount: input.toAmount,
    effectiveDate: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: userId,
  })

  return ref.id
}

export async function updateExchangeRate(id: string, input: ExchangeRateFormInput) {
  const { fromCurrency, toCurrency } = validateExchangeRateInput(input)

  const existing = await listLatestExchangeRates()
  const duplicate = existing.find(
    (rate) =>
      rate.id !== id && rate.fromCurrency === fromCurrency && rate.toCurrency === toCurrency,
  )
  if (duplicate) {
    throw new Error('Ya existe otra tasa con este par de monedas.')
  }

  await updateDoc(doc(db, 'exchange_rates', id), {
    fromCurrency,
    toCurrency,
    fromAmount: input.fromAmount,
    toAmount: input.toAmount,
    effectiveDate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteExchangeRate(id: string) {
  await deleteDoc(doc(db, 'exchange_rates', id))
}

export async function ensureFinanceDefaults(userId: string) {
  const [currencySnap, methodsSnap] = await Promise.all([
    getDocs(collection(db, 'currencies')),
    getDocs(collection(db, 'payment_methods')),
  ])

  const batch = writeBatch(db)
  let hasWrites = false

  if (currencySnap.empty) {
    const copRef = doc(collection(db, 'currencies'))
    batch.set(copRef, {
      code: DEFAULT_BASE_CURRENCY_CODE,
      name: DEFAULT_BASE_CURRENCY_NAME,
      symbol: DEFAULT_BASE_CURRENCY_SYMBOL,
      active: true,
      isBase: true,
      createdAt: serverTimestamp(),
      createdBy: userId,
    })

    const usdRef = doc(collection(db, 'currencies'))
    batch.set(usdRef, {
      code: 'USD',
      name: 'Dólar',
      symbol: 'US$',
      active: true,
      isBase: false,
      createdAt: serverTimestamp(),
      createdBy: userId,
    })

    const usdToCopRef = doc(collection(db, 'exchange_rates'))
    batch.set(usdToCopRef, {
      fromCurrency: 'USD',
      toCurrency: DEFAULT_BASE_CURRENCY_CODE,
      fromAmount: 1,
      toAmount: 4000,
      effectiveDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: userId,
    })

    const copToUsdRef = doc(collection(db, 'exchange_rates'))
    batch.set(copToUsdRef, {
      fromCurrency: DEFAULT_BASE_CURRENCY_CODE,
      toCurrency: 'USD',
      fromAmount: 4000,
      toAmount: 1,
      effectiveDate: serverTimestamp(),
      createdAt: serverTimestamp(),
      createdBy: userId,
    })

    hasWrites = true
  }

  if (methodsSnap.empty) {
    const defaults = [
      {
        name: 'Efectivo',
        code: 'cash_cop',
        allowedCurrencies: [DEFAULT_BASE_CURRENCY_CODE],
        sortOrder: 1,
        isDefaultForSales: true,
      },
      { name: 'Transferencia', code: 'transfer', allowedCurrencies: [DEFAULT_BASE_CURRENCY_CODE, 'USD'], sortOrder: 2 },
      {
        name: 'Nequi',
        code: 'nequi',
        allowedCurrencies: [DEFAULT_BASE_CURRENCY_CODE],
        requiresReference: true,
        sortOrder: 3,
      },
      {
        name: 'Daviplata',
        code: 'daviplata',
        allowedCurrencies: [DEFAULT_BASE_CURRENCY_CODE],
        requiresReference: true,
        sortOrder: 4,
      },
      { name: 'Efectivo USD', code: 'cash_usd', allowedCurrencies: ['USD'], sortOrder: 5 },
    ]

    defaults.forEach((method) => {
      const ref = doc(collection(db, 'payment_methods'))
      batch.set(ref, {
        ...method,
        active: true,
        requiresReference: method.requiresReference ?? false,
        isDefaultForSales: method.isDefaultForSales ?? false,
        createdAt: serverTimestamp(),
        createdBy: userId,
      })
    })

    hasWrites = true
  }

  if (!currencySnap.empty) {
    const currencies = currencySnap.docs.map((item) => mapCurrency(item.id, item.data()))
    const cop = currencies.find((currency) => currency.code === DEFAULT_BASE_CURRENCY_CODE)
    const markedBase = currencies.find((currency) => currency.isBase)

    if (cop && markedBase?.code !== DEFAULT_BASE_CURRENCY_CODE) {
      currencies.forEach((currency) => {
        if (currency.isBase && currency.id !== cop.id) {
          batch.update(doc(db, 'currencies', currency.id), {
            isBase: false,
            updatedAt: serverTimestamp(),
          })
          hasWrites = true
        }
      })

      if (!cop.isBase) {
        batch.update(doc(db, 'currencies', cop.id), {
          isBase: true,
          updatedAt: serverTimestamp(),
        })
        hasWrites = true
      }

      batch.set(
        doc(db, 'settings', 'app'),
        {
          baseCurrency: DEFAULT_BASE_CURRENCY_CODE,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      hasWrites = true
    }

    if (!cop) {
      const copRef = doc(collection(db, 'currencies'))
      batch.set(copRef, {
        code: DEFAULT_BASE_CURRENCY_CODE,
        name: DEFAULT_BASE_CURRENCY_NAME,
        symbol: DEFAULT_BASE_CURRENCY_SYMBOL,
        active: true,
        isBase: true,
        createdAt: serverTimestamp(),
        createdBy: userId,
      })
      currencies.forEach((currency) => {
        if (currency.isBase) {
          batch.update(doc(db, 'currencies', currency.id), {
            isBase: false,
            updatedAt: serverTimestamp(),
          })
        }
      })
      hasWrites = true
    }
  }

  if (hasWrites) {
    await batch.commit()
  }
}

export function getBaseCurrency(currencies: Currency[]) {
  return (
    currencies.find((currency) => currency.code === DEFAULT_BASE_CURRENCY_CODE) ??
    currencies.find((currency) => currency.isBase) ??
    currencies[0]
  )
}

export {
  buildExchangeRateSnapshot,
  convertCurrency,
  convertCurrencySmart,
  convertFromBase,
  convertFromBaseForPayment,
  convertToBase,
  describeConversion,
  findRateForConversion,
  formatExchangeRateLabel,
  getConversionFactor,
  paymentCoversBaseTarget,
} from '../utils/exchangeRates'
