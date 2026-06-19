import { DEFAULT_BASE_CURRENCY_CODE, MONEY_DECIMALS } from '../constants/currency'

export { MONEY_INPUT_MIN, MONEY_INPUT_PLACEHOLDER, MONEY_INPUT_STEP } from '../constants/currency'

export function roundMoney(amount: number) {
  if (!Number.isFinite(amount)) return 0
  return Number(amount.toFixed(MONEY_DECIMALS))
}

export function parseMoneyInput(value: string | number) {
  if (typeof value === 'number') {
    return roundMoney(value)
  }

  const trimmed = String(value).trim()
  if (!trimmed) return 0

  if (trimmed.includes(',')) {
    const normalized = trimmed.replace(/\./g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? roundMoney(parsed) : 0
  }

  if (/^-?\d{1,3}(\.\d{3})+$/.test(trimmed)) {
    const parsed = Number(trimmed.replace(/\./g, ''))
    return Number.isFinite(parsed) ? roundMoney(parsed) : 0
  }

  const parsed = Number(trimmed.replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0
}

export function formatMoneyInputValue(amount: number) {
  return formatDecimalColombian(amount)
}

export function formatDecimalColombian(amount: number) {
  const normalized = roundMoney(amount)
  const [integerPart, decimalPart = '00'] = normalized.toFixed(MONEY_DECIMALS).split('.')
  const withThousands = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${withThousands},${decimalPart}`
}

export function formatMoney(
  amount: number,
  currencyCode = DEFAULT_BASE_CURRENCY_CODE,
  symbol?: string,
) {
  const formatted = formatDecimalColombian(amount)

  if (symbol) return `${symbol} ${formatted}`
  return `${currencyCode} ${formatted}`
}

export function formatBaseMoney(amount: number) {
  return formatMoney(amount, DEFAULT_BASE_CURRENCY_CODE)
}

export function formatQuantity(quantity: number, unitLabel: string) {
  const value = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(3)
  return `${value} ${unitLabel}`
}
