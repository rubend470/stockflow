import { CurrencyCashBreakdown } from './CurrencyCashBreakdown'
import type { Sale, SaleItem, SalePayment } from '../../types/sale'
import { aggregateCashByCurrency } from '../../utils/salePayments'
import { MoneyText } from '../ui/MoneyText'
import { ExpandableDetail } from '../ui/motion'
import { ModalFrame } from '../ui/ModalFrame'

interface SaleDetailModalProps {
  open: boolean
  sale: Sale | null
  items: SaleItem[]
  payments: SalePayment[]
  canViewProfit: boolean
  canDeleteForTesting?: boolean
  deleting?: boolean
  loading: boolean
  printingTicket?: boolean
  printTicketError?: string
  onClose: () => void
  onDelete?: () => void
  onPrintTicket?: () => void
}

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function SaleDetailModal({
  open,
  sale,
  items,
  payments,
  canViewProfit,
  canDeleteForTesting = false,
  deleting = false,
  loading,
  printingTicket = false,
  printTicketError = '',
  onClose,
  onDelete,
  onPrintTicket,
}: SaleDetailModalProps) {
  if (!open || !sale) return null

  const cashByCurrency = aggregateCashByCurrency(payments)

  return (
    <ModalFrame wide onClose={onClose}>
        <div className="finance-modal-header">
          <h2>Venta {sale.number}</h2>
          <p>
            {formatDate(sale.createdAt)} · {sale.cashierName}
            {sale.clientName ? ` · Cliente: ${sale.clientName}` : ''}
          </p>
        </div>

        {loading ? (
          <div className="finance-empty">Cargando detalle...</div>
        ) : (
          <ExpandableDetail>
            <div className="finance-detail-grid">
              <article>
                <span>Total (COP)</span>
                <strong>
                  <MoneyText amount={sale.total} />
                </strong>
              </article>
              <article>
                <span>En caja (COP)</span>
                <strong>
                  <MoneyText amount={sale.cashPaid ?? 0} />
                </strong>
              </article>
              <article>
                <span>A crédito (COP)</span>
                <strong>
                  <MoneyText amount={sale.creditPaid ?? 0} />
                </strong>
              </article>
              <article>
                <span>Estado</span>
                <strong>
                  {sale.paymentStatus === 'paid'
                    ? 'Pagada'
                    : sale.paymentStatus === 'partial'
                      ? 'Pago parcial'
                      : sale.paymentStatus === 'pending'
                        ? 'A crédito'
                        : sale.paymentStatus}
                </strong>
              </article>
              {canViewProfit && sale.profitTotal !== null && (
                <article>
                  <span>Ganancia (COP)</span>
                  <strong className="finance-profit">
                    <MoneyText amount={sale.profitTotal} />
                  </strong>
                </article>
              )}
            </div>

            <CurrencyCashBreakdown
              title="Cobrado en caja por moneda"
              items={cashByCurrency}
              emptyLabel="Esta venta no tiene cobros en caja."
            />

            <h3 className="finance-detail-title">Productos</h3>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>
                        {item.saleMode === 'bundle' && item.unitsPerBundle
                          ? `${item.quantity} al mayor (${item.stockQuantity} ${item.unit})`
                          : `${item.quantity} ${item.unit}`}
                      </td>
                      <td>
                        <MoneyText amount={item.unitPrice} />
                        {item.saleMode === 'bundle' && <span className="finance-muted"> / {item.unit}</span>}
                        {item.manualUnitPrice && <span className="finance-muted"> · manual</span>}
                      </td>
                      <td>
                        <MoneyText amount={item.lineRevenue} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="finance-detail-title">Pagos</h3>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Método</th>
                    <th>Moneda</th>
                    <th>Monto</th>
                    <th>En COP</th>
                    <th>Referencia</th>
                    <th>Registró</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.createdAt ? formatDate(payment.createdAt) : '—'}</td>
                      <td>
                        {payment.isCredit
                          ? `Crédito · ${payment.clientName ?? 'Cliente'}`
                          : payment.isDebtCollection
                            ? `Cobro de deuda · ${payment.methodName}`
                            : payment.methodName}
                      </td>
                      <td>{payment.currencyCode}</td>
                      <td>
                        <MoneyText amount={payment.amount} currencyCode={payment.currencyCode} />
                      </td>
                      <td>
                        <MoneyText amount={payment.amountInBase} />
                      </td>
                      <td>{payment.reference || '—'}</td>
                      <td>{payment.createdByName || sale.cashierName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ExpandableDetail>
        )}

        {printTicketError && <div className="alert alert-error">{printTicketError}</div>}

        <div className="finance-form-actions">
          {canDeleteForTesting && onDelete && (
            <button
              type="button"
              className="finance-btn finance-btn-danger"
              onClick={onDelete}
              disabled={deleting || loading}
            >
              {deleting ? 'Borrando...' : 'Borrar venta (prueba)'}
            </button>
          )}
          {onPrintTicket && (
            <button
              type="button"
              className="finance-btn finance-btn-primary"
              onClick={onPrintTicket}
              disabled={loading || printingTicket || items.length === 0}
            >
              {printingTicket ? 'Imprimiendo...' : 'Imprimir ticket'}
            </button>
          )}
          <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
    </ModalFrame>
  )
}
