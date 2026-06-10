import type { ExchangeRate } from '../types/finance'
import { formatDecimalColombian, roundMoney } from './formatMoney'

export function ratePairKey(fromCurrency: string, toCurrency: string) {
  return `${fromCurrency.toUpperCase()}->${toCurrency.toUpperCase()}`
}

export function indexLatestExchangeRates(rates: ExchangeRate[]) {
  const map = new Map<string, ExchangeRate>()

  rates.forEach((rate) => {
    const key = ratePairKey(rate.fromCurrency, rate.toCurrency)
    const current = map.get(key)
    if (!current || rate.effectiveDate > current.effectiveDate) {
      map.set(key, rate)
    }
  })

  return map
}

export function formatExchangeRateLabel(rate: ExchangeRate) {
  return `${formatDecimalColombian(rate.fromAmount)} ${rate.fromCurrency} = ${formatDecimalColombian(rate.toAmount)} ${rate.toCurrency}`
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[],
) {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  if (from === to) return roundMoney(amount)

  const factor = getConversionFactor(from, to, rates)
  if (factor === null) {
    throw new Error(`No hay tasa configurada de ${from} a ${to}.`)
  }

  return roundMoney(amount * factor)
}

export function convertToBase(
  amount: number,
  currencyCode: string,
  baseCurrencyCode: string,
  rates: ExchangeRate[],
) {
  return convertCurrency(amount, currencyCode, baseCurrencyCode, rates)
}

export function convertFromBase(
  amountInBase: number,
  currencyCode: string,
  baseCurrencyCode: string,
  rates: ExchangeRate[],
) {
  return convertCurrency(amountInBase, baseCurrencyCode, currencyCode, rates)
}

/** Monto en moneda de pago que cubre el total en base (compensa redondeo FX). */
export function convertFromBaseForPayment(
  amountInBase: number,
  currencyCode: string,
  baseCurrencyCode: string,
  rates: ExchangeRate[],
) {
  const currency = currencyCode.toUpperCase()
  const base = baseCurrencyCode.toUpperCase()

  if (currency === base) {
    return roundMoney(amountInBase)
  }

  let foreign = convertFromBase(amountInBase, currencyCode, baseCurrencyCode, rates)
  let back = convertToBase(foreign, currencyCode, baseCurrencyCode, rates)
  let guard = 0
  const maxForeign = roundMoney(foreign + Math.max(1, foreign * 0.05))

  while (back + 0.001 < amountInBase && foreign < maxForeign && guard < 5000) {
    foreign = roundMoney(foreign + 0.01)
    back = convertToBase(foreign, currencyCode, baseCurrencyCode, rates)
    guard += 1
  }

  return foreign
}

export function paymentCoversBaseTarget(
  amountInForeign: number,
  amountInBase: number,
  targetInBase: number,
  currencyCode: string,
  baseCurrencyCode: string,
  rates: ExchangeRate[],
) {
  if (targetInBase <= 0.001) return true
  if (amountInBase + 0.001 >= targetInBase) return true

  const currency = currencyCode.toUpperCase()
  const base = baseCurrencyCode.toUpperCase()

  if (currency === base) {
    return false
  }

  const minForeign = convertFromBaseForPayment(targetInBase, currencyCode, baseCurrencyCode, rates)
  return amountInForeign + 0.001 >= minForeign
}

export function buildExchangeRateSnapshot(
  rates: ExchangeRate[],
  baseCurrencyCode: string,
): Record<string, number> {
  const snapshot: Record<string, number> = {
    [baseCurrencyCode]: 1,
  }

  indexLatestExchangeRates(rates).forEach((rate, key) => {
    snapshot[key] = rate.toAmount / rate.fromAmount
  })

  return snapshot
}

export function findRateForConversion(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[],
) {
  return indexLatestExchangeRates(rates).get(ratePairKey(fromCurrency, toCurrency)) ?? null
}

export function getConversionFactor(
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRate[],
) {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  if (from === to) return 1

  const direct = findRateForConversion(from, to, rates)
  if (direct) return direct.toAmount / direct.fromAmount

  const inverse = findRateForConversion(to, from, rates)
  if (inverse) return inverse.fromAmount / inverse.toAmount

  return null
}

export function convertCurrencySmart(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrencyCode: string,
  rates: ExchangeRate[],
) {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  if (from === to) {
    return { amount, factor: 1, viaBase: false }
  }

  const directFactor = getConversionFactor(from, to, rates)
  if (directFactor !== null) {
    return {
      amount: roundMoney(amount * directFactor),
      factor: directFactor,
      viaBase: false,
    }
  }

  const base = baseCurrencyCode.toUpperCase()
  if (from !== base && to !== base) {
    const toBaseFactor = getConversionFactor(from, base, rates)
    const fromBaseFactor = getConversionFactor(base, to, rates)

    if (toBaseFactor !== null && fromBaseFactor !== null) {
      const factor = toBaseFactor * fromBaseFactor
      return {
        amount: roundMoney(amount * factor),
        factor,
        viaBase: true,
      }
    }
  }

  throw new Error(`No hay tasa configurada entre ${from} y ${to}.`)
}

export function describeConversion(
  fromCurrency: string,
  toCurrency: string,
  baseCurrencyCode: string,
  rates: ExchangeRate[],
) {
  const from = fromCurrency.toUpperCase()
  const to = toCurrency.toUpperCase()

  if (from === to) return null

  const direct = findRateForConversion(from, to, rates)
  if (direct) return formatExchangeRateLabel(direct)

  const inverse = findRateForConversion(to, from, rates)
  if (inverse) {
    return `${inverse.toAmount} ${inverse.toCurrency} = ${inverse.fromAmount} ${inverse.fromCurrency}`
  }

  const base = baseCurrencyCode.toUpperCase()
  if (from !== base && to !== base) {
    const leg1 = findRateForConversion(from, base, rates) ?? findRateForConversion(base, from, rates)
    const leg2 = findRateForConversion(base, to, rates) ?? findRateForConversion(to, base, rates)

    if (leg1 && leg2) {
      return `Conversión vía ${base}`
    }
  }

  return null
}
