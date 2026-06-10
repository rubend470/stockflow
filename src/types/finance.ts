export interface Currency {
  id: string
  code: string
  name: string
  symbol: string
  active: boolean
  isBase: boolean
}

export interface ExchangeRate {
  id: string
  fromCurrency: string
  toCurrency: string
  fromAmount: number
  toAmount: number
  effectiveDate: string
}

export interface PaymentMethod {
  id: string
  name: string
  code: string
  active: boolean
  allowedCurrencies: string[]
  requiresReference: boolean
  sortOrder: number
  isDefaultForSales: boolean
}

export interface CurrencyFormInput {
  code: string
  name: string
  symbol: string
  active: boolean
  isBase: boolean
}

export interface PaymentMethodFormInput {
  name: string
  active: boolean
  allowedCurrencies: string[]
  requiresReference: boolean
  isDefaultForSales: boolean
}

export interface ExchangeRateFormInput {
  fromCurrency: string
  toCurrency: string
  fromAmount: number
  toAmount: number
}

export const emptyExchangeRateForm = (
  fromCurrency = '',
  toCurrency = '',
): ExchangeRateFormInput => ({
  fromCurrency,
  toCurrency,
  fromAmount: 1,
  toAmount: 1,
})

export function exchangeRateFormFromRate(rate: ExchangeRate): ExchangeRateFormInput {
  return {
    fromCurrency: rate.fromCurrency,
    toCurrency: rate.toCurrency,
    fromAmount: rate.fromAmount,
    toAmount: rate.toAmount,
  }
}

export const emptyCurrencyForm = (): CurrencyFormInput => ({
  code: '',
  name: '',
  symbol: '$',
  active: true,
  isBase: false,
})

export const emptyPaymentMethodForm = (): PaymentMethodFormInput => ({
  name: '',
  active: true,
  allowedCurrencies: ['COP'],
  requiresReference: false,
  isDefaultForSales: false,
})

export function pickDefaultPaymentMethod(methods: PaymentMethod[]): PaymentMethod | undefined {
  if (!methods.length) return undefined

  const explicit = methods.find((method) => method.isDefaultForSales)
  if (explicit) return explicit

  return [...methods].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
  )[0]
}

export function currencyFormFromCurrency(currency: Currency): CurrencyFormInput {
  return {
    code: currency.code,
    name: currency.name,
    symbol: currency.symbol,
    active: currency.active,
    isBase: currency.isBase,
  }
}

export function paymentMethodFormFromMethod(method: PaymentMethod): PaymentMethodFormInput {
  return {
    name: method.name,
    active: method.active,
    allowedCurrencies: [...method.allowedCurrencies],
    requiresReference: method.requiresReference,
    isDefaultForSales: method.isDefaultForSales,
  }
}
