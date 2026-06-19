import type { Client } from '../../types/client'
import type { Currency, PaymentMethod } from '../../types/finance'
import type { SalePaymentInput } from '../../types/sale'
import { MoneyInput } from '../ui/MoneyInput'
import { MoneyText } from '../ui/MoneyText'
import { parseMoneyInput } from '../../utils/formatMoney'

interface PaymentSectionProps {
  currencies: Currency[]
  paymentMethods: PaymentMethod[]
  baseCurrencyCode: string
  selectedCurrencyCode: string
  conversionRateLabel?: string | null
  paymentEquivalentBase?: number | null
  selectedMethodId: string
  paymentAmount: string
  paymentReference: string
  payments: SalePaymentInput[]
  totalDue: number
  remaining: number
  mixedPayment: boolean
  canCredit: boolean
  creditEnabled: boolean
  creditAmount: string
  creditName: string
  creditPhone: string
  frequentCreditClients: Client[]
  onCreditEnabledChange: (enabled: boolean) => void
  onCreditAmountChange: (value: string) => void
  onCreditNameChange: (value: string) => void
  onCreditPhoneChange: (value: string) => void
  onUseFullCredit: () => void
  onAddCreditPayment?: () => void
  creditSubmitting?: boolean
  onMixedPaymentChange: (enabled: boolean) => void
  onCurrencyChange: (code: string) => void
  onMethodChange: (id: string) => void
  onAmountChange: (value: string) => void
  onReferenceChange: (value: string) => void
  onUseTotalAmount: () => void
  onAddPayment: () => void
  onRemovePayment: (index: number) => void
  onConfirmSale: () => void
  submitting: boolean
  canConfirm: boolean
  error?: string
}

export function PaymentSection({
  currencies,
  paymentMethods,
  baseCurrencyCode,
  selectedCurrencyCode,
  conversionRateLabel,
  paymentEquivalentBase,
  selectedMethodId,
  paymentAmount,
  paymentReference,
  payments,
  totalDue,
  remaining,
  mixedPayment,
  canCredit,
  creditEnabled,
  creditAmount,
  creditName,
  creditPhone,
  frequentCreditClients,
  onCreditEnabledChange,
  onCreditAmountChange,
  onCreditNameChange,
  onCreditPhoneChange,
  onUseFullCredit,
  onAddCreditPayment,
  creditSubmitting = false,
  onMixedPaymentChange,
  onCurrencyChange,
  onMethodChange,
  onAmountChange,
  onReferenceChange,
  onUseTotalAmount,
  onAddPayment,
  onRemovePayment,
  onConfirmSale,
  submitting,
  canConfirm,
  error,
}: PaymentSectionProps) {
  const selectedMethod = paymentMethods.find((method) => method.id === selectedMethodId)
  const selectedCurrency = currencies.find((currency) => currency.code === selectedCurrencyCode)
  const availableMethods = paymentMethods.filter(
    (method) =>
      method.allowedCurrencies.length === 0 ||
      method.allowedCurrencies.includes(selectedCurrencyCode),
  )

  const creditPayments = payments.filter((payment) => payment.isCredit)
  const cashPaid = payments
    .filter((payment) => !payment.isCredit)
    .reduce((sum, payment) => sum + payment.amountInBase, 0)
  const creditPaid = creditPayments.reduce((sum, payment) => sum + payment.amountInBase, 0)
  const inlineCreditBase = creditEnabled ? parseMoneyInput(creditAmount) ?? 0 : 0
  const totalCreditPreview = creditPaid + inlineCreditBase
  const cashNeededPreview = Math.max(totalDue - totalCreditPreview - cashPaid, 0)
  const isFullCredit =
    creditEnabled && inlineCreditBase > 0 && cashNeededPreview <= 0.01 && cashPaid <= 0.01
  const isPartialCredit =
    creditEnabled && inlineCreditBase > 0 && !isFullCredit
  const showPaymentBreakdown = mixedPayment || creditEnabled || creditPaid > 0

  return (
    <div className="pos-payment">
      <label className="pos-mixed-toggle">
        <input
          type="checkbox"
          checked={mixedPayment}
          onChange={(event) => onMixedPaymentChange(event.target.checked)}
        />
        <span>
          <strong>Pago mixto</strong>
          <small>
            {mixedPayment
              ? 'Agrega varios pagos antes de confirmar.'
              : 'Confirma la venta con el cobro del formulario.'}
          </small>
        </span>
      </label>

      {!canCredit && (
        <p className="pos-credit-disabled-hint">Agrega productos al carrito para registrar el cobro.</p>
      )}

      {canCredit && (
        <p className="pos-credit-disabled-hint">
          Marca crédito junto al monto para fiar total o parte. Nombre y teléfono obligatorios.
        </p>
      )}

      <div className="pos-payment-grid">
        <label className="pos-field">
          <span>Moneda</span>
          <select value={selectedCurrencyCode} onChange={(event) => onCurrencyChange(event.target.value)}>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.code}>
                {currency.symbol} {currency.name}
              </option>
            ))}
          </select>
        </label>

        <label className="pos-field">
          <span>Forma de pago</span>
          <select value={selectedMethodId} onChange={(event) => onMethodChange(event.target.value)}>
            {availableMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </label>

        <label className="pos-field pos-field-full">
          <span>Monto ({selectedCurrency?.symbol ?? selectedCurrencyCode})</span>
          <div className="pos-amount-row">
            <MoneyInput
              min="0"
              value={paymentAmount}
              onChange={onAmountChange}
            />
            <div className="pos-amount-actions">
              <button
                type="button"
                className="pos-btn pos-btn-secondary"
                onClick={onUseTotalAmount}
                disabled={remaining <= 0}
              >
                Precio total
              </button>
              <label className="pos-credit-toggle">
                <input
                  type="checkbox"
                  checked={creditEnabled}
                  onChange={(event) => onCreditEnabledChange(event.target.checked)}
                  disabled={!canCredit || creditSubmitting}
                />
                <span>Crédito</span>
              </label>
            </div>
          </div>
          {selectedCurrencyCode !== baseCurrencyCode && (
            <small className="pos-credit-edit-hint">
              {conversionRateLabel ? (
                <>
                  Tasa del día: <strong>{conversionRateLabel}</strong>
                  {paymentEquivalentBase !== null && paymentEquivalentBase !== undefined && (
                    <>
                      {' '}
                      · Equivale a <strong><MoneyText amount={paymentEquivalentBase} /></strong>
                    </>
                  )}
                </>
              ) : (
                <>No hay tasa configurada de {selectedCurrencyCode} a {baseCurrencyCode}.</>
              )}
            </small>
          )}
        </label>

        {creditEnabled && (
          <div className="pos-credit-inline">
            <div className="pos-credit-inline-header">
              <span
                className={`pos-credit-mode-badge ${isFullCredit ? 'full' : 'partial'}`}
              >
                {isFullCredit ? 'Crédito total' : 'Crédito parcial'}
              </span>
              {isPartialCredit && (
                <span className="pos-credit-inline-summary">
                  En caja: <MoneyText amount={cashNeededPreview} />
                  {' · '}
                  A crédito: <MoneyText amount={inlineCreditBase} />
                </span>
              )}
              {isFullCredit && (
                <span className="pos-credit-inline-summary">
                  Toda la venta queda fiada: <MoneyText amount={inlineCreditBase} />
                </span>
              )}
            </div>

            {frequentCreditClients.length > 0 && (
              <div className="pos-credit-frequent">
                <span>Frecuentes</span>
                <div className="finance-chip-group">
                  {frequentCreditClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      className={`finance-chip ${
                        creditName === client.name ? 'selected' : ''
                      }`}
                      onClick={() => {
                        onCreditNameChange(client.name)
                        onCreditPhoneChange(client.phone ?? '')
                      }}
                      disabled={creditSubmitting}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pos-credit-inline-grid">
              <label className="pos-field">
                <span>Nombre</span>
                <input
                  type="text"
                  value={creditName}
                  onChange={(event) => onCreditNameChange(event.target.value)}
                  placeholder="Quien compra a crédito"
                  disabled={creditSubmitting}
                />
              </label>
              <label className="pos-field">
                <span>Teléfono</span>
                <input
                  type="tel"
                  value={creditPhone}
                  onChange={(event) => onCreditPhoneChange(event.target.value)}
                  placeholder="Contacto"
                  disabled={creditSubmitting}
                />
              </label>
              <label className="pos-field pos-field-full">
                <span>Monto a crédito ({baseCurrencyCode})</span>
                <div className="pos-amount-row">
                  <MoneyInput
                    value={creditAmount}
                    onChange={onCreditAmountChange}
                    disabled={creditSubmitting}
                  />
                  <button
                    type="button"
                    className="pos-btn pos-btn-secondary"
                    onClick={onUseFullCredit}
                    disabled={creditSubmitting || remaining <= 0}
                  >
                    Todo a crédito
                  </button>
                </div>
              </label>
            </div>

            {mixedPayment && onAddCreditPayment && (
              <button
                type="button"
                className="pos-btn pos-btn-credit pos-btn-block"
                onClick={onAddCreditPayment}
                disabled={creditSubmitting}
              >
                {creditSubmitting ? 'Agregando...' : 'Agregar crédito a la venta'}
              </button>
            )}
          </div>
        )}

        {selectedMethod?.requiresReference && (
          <label className="pos-field pos-field-full">
            <span>Referencia</span>
            <input
              type="text"
              value={paymentReference}
              onChange={(event) => onReferenceChange(event.target.value)}
              placeholder="Número de referencia"
            />
          </label>
        )}
      </div>

      {error && <div className="alert alert-error pos-payment-alert">{error}</div>}

      {mixedPayment && (
        <button type="button" className="pos-btn pos-btn-secondary pos-btn-block" onClick={onAddPayment}>
          Agregar pago
        </button>
      )}

      {mixedPayment && payments.length > 0 && (
        <ul className="pos-payment-list">
          {payments.map((payment, index) => (
            <li key={`${payment.methodId}-${index}`} className={payment.isCredit ? 'pos-credit-payment' : undefined}>
              <div>
                <strong>
                  {payment.isCredit ? `Crédito · ${payment.clientName}` : payment.methodName}
                </strong>
                <span>
                  <MoneyText amount={payment.amount} currencyCode={payment.currencyCode} />
                  {' · Base '}
                  <MoneyText amount={payment.amountInBase} />
                </span>
              </div>
              <button type="button" className="pos-link-btn" onClick={() => onRemovePayment(index)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pos-payment-totals">
        <div className="pos-payment-total-primary">
          <span>Total venta</span>
          <strong>
            <MoneyText amount={totalDue} />
          </strong>
        </div>
        {mixedPayment && (
          <>
            <div>
              <span>Pagado en caja</span>
              <strong>
                <MoneyText amount={cashPaid} />
              </strong>
            </div>
            {(creditPaid > 0 || inlineCreditBase > 0) && (
              <div>
                <span>A crédito</span>
                <strong className="pos-credit-amount">
                  <MoneyText amount={totalCreditPreview} />
                </strong>
              </div>
            )}
            <div className={remaining > 0.01 ? 'pos-remaining' : 'pos-complete'}>
              <span>{remaining > 0.01 ? 'Faltante' : 'Estado'}</span>
              <strong>
                {remaining > 0.01 ? <MoneyText amount={remaining} /> : 'Listo para cobrar'}
              </strong>
            </div>
          </>
        )}
        {!mixedPayment && showPaymentBreakdown && (
          <>
            {cashNeededPreview > 0.01 && (
              <div>
                <span>En caja</span>
                <strong>
                  <MoneyText amount={cashNeededPreview} />
                </strong>
              </div>
            )}
            {totalCreditPreview > 0 && (
              <div>
                <span>A crédito</span>
                <strong className="pos-credit-amount">
                  <MoneyText amount={totalCreditPreview} />
                </strong>
              </div>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        className="pos-btn pos-btn-success pos-btn-block pos-btn-large"
        onClick={onConfirmSale}
        disabled={!canConfirm || submitting}
      >
        {submitting ? 'Procesando venta...' : 'Confirmar venta'}
      </button>
    </div>
  )
}
