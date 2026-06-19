import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { DEFAULT_BASE_CURRENCY_CODE, MONEY_INPUT_PLACEHOLDER } from '../../constants/currency'
import { formatMoneyInputValue, parseMoneyInput } from '../../utils/formatMoney'

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'step' | 'value' | 'onChange'> {
  value: string | number
  onChange: (value: string) => void
  onValueChange?: (amount: number) => void
  currencyCode?: string
  showCurrencyPrefix?: boolean
  roundOnBlur?: boolean
  blankWhenZero?: boolean
}

function toDisplayValue(value: string | number, blankWhenZero = false) {
  if (value === '' || value === null || value === undefined) return ''
  const parsed = parseMoneyInput(value)
  if (blankWhenZero && parsed === 0) return ''
  return formatMoneyInputValue(parsed)
}

export function MoneyInput({
  value,
  onChange,
  onValueChange,
  currencyCode = DEFAULT_BASE_CURRENCY_CODE,
  showCurrencyPrefix = false,
  roundOnBlur = true,
  blankWhenZero = false,
  min,
  placeholder = MONEY_INPUT_PLACEHOLDER,
  className,
  onBlur,
  onFocus,
  ...props
}: MoneyInputProps) {
  const formattedValue = toDisplayValue(value, blankWhenZero)
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(formattedValue)

  useEffect(() => {
    if (!focused) {
      setDraft(formattedValue)
    }
  }, [formattedValue, focused])

  function emit(next: string) {
    onChange(next)
    if (onValueChange) {
      onValueChange(parseMoneyInput(next))
    }
  }

  function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
    setFocused(true)
    setDraft(formattedValue)
    onFocus?.(event)
  }

  function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
    setFocused(false)

    if (roundOnBlur && draft.trim()) {
      let parsed = parseMoneyInput(draft)
      const minValue = min !== undefined ? Number(min) : null
      if (minValue !== null && Number.isFinite(minValue) && parsed < minValue) {
        parsed = minValue
      }
      emit(formatMoneyInputValue(parsed))
    } else if (!draft.trim()) {
      emit('')
    }

    onBlur?.(event)
  }

  const input = (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={focused ? draft : formattedValue}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      {...props}
    />
  )

  if (!showCurrencyPrefix) return input

  return (
    <div className="money-field">
      <span className="money-field-prefix">{currencyCode}</span>
      {input}
    </div>
  )
}
