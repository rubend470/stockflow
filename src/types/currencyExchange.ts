export interface CurrencyExchange {
  id: string
  /** Dinero que entró a caja (lo que entrega el cliente). */
  cashInCurrency: string
  cashInAmount: number
  cashInMethodId: string
  cashInMethodName: string
  cashInReference?: string
  /** Dinero que salió de caja (lo que entregas al cliente). */
  cashOutCurrency: string
  cashOutAmount: number
  cashOutMethodId: string
  cashOutMethodName: string
  cashOutReference?: string
  /** @deprecated Alias de cashIn — se mantiene por compatibilidad. */
  fromCurrency: string
  /** @deprecated Alias de cashOut — se mantiene por compatibilidad. */
  toCurrency: string
  fromAmount: number
  toAmount: number
  conversionFactor: number
  rateLabel: string
  amountInBase: number
  baseCurrency: string
  exchangeRateSnapshot: Record<string, number>
  clientName?: string
  notes?: string
  createdAt: string
  createdBy: string
  createdByName: string
}

export interface CreateCurrencyExchangeInput {
  cashInCurrency: string
  cashInAmount: number
  cashInMethodId: string
  cashInMethodName: string
  cashInReference?: string
  cashOutCurrency: string
  cashOutAmount: number
  cashOutMethodId: string
  cashOutMethodName: string
  cashOutReference?: string
  conversionFactor: number
  rateLabel: string
  amountInBase: number
  baseCurrency: string
  exchangeRateSnapshot: Record<string, number>
  clientName?: string
  notes?: string
}
