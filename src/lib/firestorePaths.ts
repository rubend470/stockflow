export const BUSINESS_COLLECTION = 'businesses'

export const TENANT_COLLECTIONS = [
  'products',
  'stock_categories',
  'inventory_movements',
  'suppliers',
  'purchase_invoices',
  'sales',
  'clients',
  'debts',
  'debt_payments',
  'loans',
  'loan_payments',
  'cash_sessions',
  'cash_closures',
  'cash_movements',
  'expenses',
  'currencies',
  'exchange_rates',
  'currency_exchange_rates',
  'currency_exchanges',
  'payment_methods',
  'offers',
  'product_types',
  'keyboard_shortcuts',
  'settings',
] as const

export type TenantCollection = (typeof TENANT_COLLECTIONS)[number]

export function tenantCollectionPath(
  collectionName: TenantCollection,
  businessId?: string,
): string[] {
  return businessId
    ? [BUSINESS_COLLECTION, businessId, collectionName]
    : [collectionName]
}

export function tenantDocumentPath(
  collectionName: TenantCollection,
  documentId: string,
  businessId?: string,
): string[] {
  return [...tenantCollectionPath(collectionName, businessId), documentId]
}

export function tenantSubcollectionPath(
  collectionName: TenantCollection,
  documentId: string,
  subcollectionName: string,
  businessId?: string,
): string[] {
  return [
    ...tenantDocumentPath(collectionName, documentId, businessId),
    subcollectionName,
  ]
}
