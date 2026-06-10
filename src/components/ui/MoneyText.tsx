import { formatBaseMoney, formatMoney } from '../../utils/formatMoney'

interface MoneyTextProps {
  amount: number
  currencyCode?: string
  symbol?: string
  className?: string
}

export function MoneyText({ amount, currencyCode, symbol, className }: MoneyTextProps) {
  const label = currencyCode
    ? formatMoney(amount, currencyCode, symbol)
    : formatBaseMoney(amount)

  return <span className={['money-text', className].filter(Boolean).join(' ')}>{label}</span>
}
