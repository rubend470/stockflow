import type { CashClosureReport } from '../../types/cashClosure'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../constants/currency'
import { MoneyText } from '../ui/MoneyText'
import { formatClosureDate, formatDateTime } from '../../utils/dates'
import {
  closurePaymentStatusLabels,
  formatClosureDateTime,
  getExpectedCashInBase,
  resolveClosureSalePaymentStatus,
} from '../../utils/cashClosure'
import { formatBaseMoney, formatMoney } from '../../utils/formatMoney'
import { cashMovementTypeLabels } from '../../types/cashMovement'

interface CashClosureDetailProps {
  report: CashClosureReport
  createdAt?: string
  createdByName?: string
  canDelete?: boolean
  deleting?: boolean
  onDelete?: () => void
}

export function CashClosureDetail({
  report,
  createdAt,
  createdByName,
  canDelete = false,
  deleting = false,
  onDelete,
}: CashClosureDetailProps) {
  const expectedCashInBase = getExpectedCashInBase(report)
  const netByCurrency = report.netByCurrency ?? []
  const loansGivenInBase = report.loansGivenInBase ?? 0
  const exchanges = report.exchanges ?? []
  const exchangesCount = report.exchangesCount ?? exchanges.length
  const cashMovements = report.cashMovements ?? []
  const openingCashInBase = report.openingCashInBase ?? 0
  const extraCashInBase = report.extraCashInBase ?? 0
  const extraCashOutInBase = report.extraCashOutInBase ?? 0

  function formatExchangeMethod(name: string, reference?: string) {
    return reference ? `${name} · Ref. ${reference}` : name
  }

  return (
    <div className="cash-closure-detail">
      <div className="cash-closure-detail-header">
        <div>
          <h3>{formatClosureDate(report.closureDate)}</h3>
          {createdAt && (
            <p>
              Registrado {formatDateTime(createdAt)}
              {createdByName ? ` · ${createdByName}` : ''}
            </p>
          )}
        </div>
        {canDelete && onDelete && (
          <button
            type="button"
            className="finance-btn finance-btn-danger"
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? 'Borrando...' : 'Borrar cierre'}
          </button>
        )}
      </div>

      <section className="cash-closure-hero">
        <p className="cash-closure-hero-label">Debe haber en caja</p>
        <p className="cash-closure-hero-hint">
          Base inicial, cobros y entradas; menos salidas, préstamos y cambio de moneda.
        </p>
        {netByCurrency.length > 0 ? (
          <div className="sales-currency-grid">
            {netByCurrency.map((row) => (
              <article key={row.currencyCode} className="sales-currency-card cash-closure-expected">
                <span>{row.currencyCode}</span>
                <strong>
                  <MoneyText amount={row.net} currencyCode={row.currencyCode} />
                </strong>
                {(row.cashIn > 0.01 || row.cashOut > 0.01) && (
                  <small>
                    Entró{' '}
                    <MoneyText amount={row.cashIn} currencyCode={row.currencyCode} />
                    {' · '}
                    Salió{' '}
                    <MoneyText amount={row.cashOut} currencyCode={row.currencyCode} />
                  </small>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="cash-closure-hero-total">
            <MoneyText amount={expectedCashInBase} />
          </p>
        )}
      </section>

      <div className="finance-stats finance-stats-wide">
        <article>
          <span>Ventas</span>
          <strong>{report.salesCount}</strong>
        </article>
        <article>
          <span>Total vendido</span>
          <strong>{formatBaseMoney(report.totalSoldInBase)}</strong>
        </article>
        <article>
          <span>Cobrado en caja</span>
          <strong className="finance-profit">{formatBaseMoney(report.totalCashInBase)}</strong>
        </article>
        {openingCashInBase > 0 && (
          <article>
            <span>Base inicial</span>
            <strong className="finance-profit">{formatBaseMoney(openingCashInBase)}</strong>
          </article>
        )}
        {extraCashInBase > 0 && (
          <article>
            <span>Entradas extra</span>
            <strong className="finance-profit">{formatBaseMoney(extraCashInBase)}</strong>
          </article>
        )}
        {extraCashOutInBase > 0 && (
          <article>
            <span>Salidas extra</span>
            <strong className="text-danger">−{formatBaseMoney(extraCashOutInBase)}</strong>
          </article>
        )}
        <article>
          <span>A crédito</span>
          <strong>{formatBaseMoney(report.creditSalesInBase)}</strong>
        </article>
        {loansGivenInBase > 0 && (
          <article>
            <span>Préstamos del día</span>
            <strong className="text-danger">−{formatBaseMoney(loansGivenInBase)}</strong>
          </article>
        )}
        {exchangesCount > 0 && (
          <article>
            <span>Cambios de moneda</span>
            <strong>{exchangesCount}</strong>
          </article>
        )}
        <article>
          <span>Debe en caja (COP)</span>
          <strong className="finance-profit">{formatBaseMoney(expectedCashInBase)}</strong>
        </article>
      </div>

      {cashMovements.length > 0 && (
        <section className="cash-closure-section">
          <h4 className="finance-detail-title">Base, entradas y salidas</h4>
          <p className="finance-detail-hint">
            Movimientos manuales de caja incluidos en <strong>Debe haber en caja</strong>.
          </p>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th>Moneda / forma</th>
                  <th>Monto</th>
                  <th>Equiv. COP</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {cashMovements.map((movement) => (
                  <tr key={movement.id}>
                    <td>{formatClosureDateTime(movement.createdAt)}</td>
                    <td>{cashMovementTypeLabels[movement.type]}</td>
                    <td>
                      <strong>{movement.description}</strong>
                      {movement.notes && <small className="expense-note">{movement.notes}</small>}
                    </td>
                    <td>
                      <strong>{movement.currencyCode}</strong>
                      <small className="expense-note">
                        {movement.methodName || 'Caja'}
                        {movement.reference ? ` · Ref. ${movement.reference}` : ''}
                      </small>
                    </td>
                    <td>
                      <strong className={movement.type === 'out' ? 'text-danger' : 'finance-profit'}>
                        {movement.type === 'out' ? '−' : ''}
                        {formatMoney(movement.amount, movement.currencyCode)}
                      </strong>
                    </td>
                    <td>{formatBaseMoney(movement.amountInBase)}</td>
                    <td>{movement.createdByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {exchangesCount > 0 && (
        <section className="cash-closure-section">
          <h4 className="finance-detail-title">Cambio de moneda del día</h4>
          <p className="finance-detail-hint">
            {exchangesCount} operación{exchangesCount === 1 ? '' : 'es'} de casa de cambio. El
            efecto en caja ya está incluido en <strong>Debe haber en caja</strong>.
          </p>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Entró a caja</th>
                  <th>Salió de caja</th>
                  <th>Tasa</th>
                  <th>Cliente</th>
                  <th>Cajero</th>
                </tr>
              </thead>
              <tbody>
                {exchanges.map((exchange) => (
                  <tr key={exchange.id}>
                    <td>{formatClosureDateTime(exchange.createdAt)}</td>
                    <td>
                      <strong>
                        <MoneyText
                          amount={exchange.cashInAmount}
                          currencyCode={exchange.cashInCurrency}
                        />
                      </strong>
                      <small className="exchange-method-hint">
                        {formatExchangeMethod(
                          exchange.cashInMethodName,
                          exchange.cashInReference,
                        )}
                      </small>
                    </td>
                    <td>
                      <strong>
                        <MoneyText
                          amount={exchange.cashOutAmount}
                          currencyCode={exchange.cashOutCurrency}
                        />
                      </strong>
                      <small className="exchange-method-hint">
                        {formatExchangeMethod(
                          exchange.cashOutMethodName,
                          exchange.cashOutReference,
                        )}
                      </small>
                    </td>
                    <td className="exchange-rate-cell">{exchange.rateLabel}</td>
                    <td>{exchange.clientName || '—'}</td>
                    <td>{exchange.createdByName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {report.byMethod.length > 0 && (
        <section className="cash-closure-section">
          <h4 className="finance-detail-title">Caja por forma de pago</h4>
          <p className="finance-detail-hint">
            Ventas, base, entradas y salidas desglosadas por método y moneda.
          </p>
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Forma de pago</th>
                  <th>Moneda</th>
                  <th>Monto</th>
                  <th>En COP</th>
                </tr>
              </thead>
              <tbody>
                {report.byMethod.map((row) => (
                  <tr key={`${row.methodName}-${row.currencyCode}`}>
                    <td>{row.methodName}</td>
                    <td>{row.currencyCode}</td>
                    <td>
                      <MoneyText amount={row.amount} currencyCode={row.currencyCode} />
                    </td>
                    <td>
                      <MoneyText amount={row.amountInBase} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="cash-closure-section">
        <h4 className="finance-detail-title">Ventas del día</h4>
        {report.sales.length === 0 ? (
          <p className="finance-detail-hint">No hubo ventas este día.</p>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº venta</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>En caja</th>
                  <th>A crédito</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {report.sales.map((sale) => {
                  const paymentStatus = resolveClosureSalePaymentStatus(sale)
                  return (
                    <tr key={sale.saleId}>
                      <td>{formatClosureDateTime(sale.createdAt)}</td>
                      <td>
                        <strong>{sale.saleNumber}</strong>
                      </td>
                      <td>{sale.clientName ?? '—'}</td>
                      <td>
                        <MoneyText amount={sale.total} />
                      </td>
                      <td>
                        <MoneyText amount={sale.cashPaid} />
                      </td>
                      <td>
                        <MoneyText amount={sale.creditPaid} />
                      </td>
                      <td>
                        <span
                          className={`finance-badge ${
                            paymentStatus === 'paid' ? 'ok' : 'inactive'
                          }`}
                        >
                          {closurePaymentStatusLabels[paymentStatus] ?? paymentStatus}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report.cashByCurrency.length > 0 && (
        <section className="cash-closure-section">
          <h4 className="finance-detail-title">Cobros por moneda (sin descontar salidas)</h4>
          <div className="sales-currency-grid">
            {report.cashByCurrency.map((entry) => (
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
        </section>
      )}
    </div>
  )
}
