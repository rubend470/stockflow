import type { PurchaseInvoice } from '../../types/purchaseInvoice'
import { purchaseInvoiceStatusLabels } from '../../types/purchaseInvoice'
import type { Supplier } from '../../types/supplier'
import { formatInvoiceListDate } from '../../utils/invoiceDate'
import { formatMoney } from '../../utils/formatMoney'
import { ModalFrame } from '../ui/ModalFrame'

interface SupplierDetailModalProps {
  open: boolean
  supplier: Supplier | null
  invoices: PurchaseInvoice[]
  onClose: () => void
  onEdit: (supplier: Supplier) => void
  onViewInvoice?: (invoice: PurchaseInvoice) => void
}

export function SupplierDetailModal({
  open,
  supplier,
  invoices,
  onClose,
  onEdit,
  onViewInvoice,
}: SupplierDetailModalProps) {
  if (!open || !supplier) return null

  const totalPurchased = invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0)
  const totalDue = invoices.reduce((sum, invoice) => sum + invoice.amountDue, 0)

  return (
    <ModalFrame wide onClose={onClose}>
      <div className="finance-modal-header">
        <h2>{supplier.name}</h2>
        <p>Historial de entradas de mercancía con este proveedor.</p>
      </div>

      <div className="finance-detail-grid">
        {supplier.phone && (
          <article>
            <span>Teléfono</span>
            <strong>{supplier.phone}</strong>
          </article>
        )}
        {supplier.email && (
          <article>
            <span>Correo</span>
            <strong>{supplier.email}</strong>
          </article>
        )}
        {supplier.taxId && (
          <article>
            <span>NIT / RIF</span>
            <strong>{supplier.taxId}</strong>
          </article>
        )}
        <article>
          <span>Facturas</span>
          <strong>{invoices.length}</strong>
        </article>
        <article>
          <span>Total comprado</span>
          <strong>{formatMoney(totalPurchased)}</strong>
        </article>
        <article>
          <span>Por pagar</span>
          <strong>{formatMoney(totalDue)}</strong>
        </article>
      </div>

      {supplier.notes && <p className="finance-detail-hint">{supplier.notes}</p>}

      <section className="finance-detail-section">
        <h3>Facturas de entrada</h3>
        {invoices.length === 0 ? (
          <div className="finance-empty">Este proveedor aún no tiene facturas registradas.</div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Nº</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Por pagar</th>
                  <th>Estado</th>
                  {onViewInvoice && <th className="table-actions-col">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{formatInvoiceListDate(invoice)}</td>
                    <td>
                      <strong>{invoice.number}</strong>
                    </td>
                    <td>{formatMoney(invoice.totalAmount, invoice.currencyCode)}</td>
                    <td>{formatMoney(invoice.amountPaid, invoice.currencyCode)}</td>
                    <td>{formatMoney(invoice.amountDue, invoice.currencyCode)}</td>
                    <td>
                      <span
                        className={`finance-badge ${
                          invoice.status === 'paid' ? 'ok' : 'inactive'
                        }`}
                      >
                        {purchaseInvoiceStatusLabels[invoice.status]}
                      </span>
                    </td>
                    {onViewInvoice && (
                      <td className="table-actions-col">
                        <button
                          type="button"
                          className="finance-btn finance-btn-secondary"
                          onClick={() => onViewInvoice(invoice)}
                        >
                          Ver
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="finance-form-actions">
        <button type="button" className="finance-btn finance-btn-secondary" onClick={onClose}>
          Cerrar
        </button>
        <button
          type="button"
          className="finance-btn finance-btn-primary"
          onClick={() => onEdit(supplier)}
        >
          Editar proveedor
        </button>
      </div>
    </ModalFrame>
  )
}
