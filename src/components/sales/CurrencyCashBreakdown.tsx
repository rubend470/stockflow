import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import type { CurrencyCashTotal } from '../../utils/salePayments'
import { MoneyText } from '../ui/MoneyText'

interface CurrencyCashBreakdownProps {
  title?: string
  items: CurrencyCashTotal[]
  emptyLabel?: string
}

export function CurrencyCashBreakdown({
  title = 'En caja por moneda',
  items,
  emptyLabel = 'Sin cobros en caja en este rango.',
}: CurrencyCashBreakdownProps) {
  if (items.length === 0) {
    return (
      <div className="sales-currency-breakdown">
        <h3 className="finance-detail-title">{title}</h3>
        <p className="finance-detail-hint">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="sales-currency-breakdown">
      <h3 className="finance-detail-title">{title}</h3>
      <div className="sales-currency-grid">
        {items.map((entry) => (
          <article key={entry.currencyCode} className="sales-currency-card">
            <span>{entry.currencyCode}</span>
            <strong>
              <MoneyText amount={entry.cashAmount} currencyCode={entry.currencyCode} />
            </strong>
            {entry.currencyCode !== DEFAULT_BASE_CURRENCY_CODE && (
              <small>
                Equivale a <MoneyText amount={entry.baseEquivalent} />
              </small>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
