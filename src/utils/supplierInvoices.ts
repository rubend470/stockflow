import type { PurchaseInvoice } from '../types/purchaseInvoice'
import type { Supplier } from '../types/supplier'

export function listInvoicesForSupplier(invoices: PurchaseInvoice[], supplier: Supplier) {
  const supplierName = supplier.name.trim().toLowerCase()

  return invoices
    .filter(
      (invoice) =>
        invoice.supplierId === supplier.id ||
        (!invoice.supplierId && invoice.supplierName.trim().toLowerCase() === supplierName),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
