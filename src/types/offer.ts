import type { SoldBy } from './product'

export type SalesOfferType = 'combo' | 'promotion'

export interface SalesOffer {
  id: string
  type: SalesOfferType
  name: string
  productId: string
  productName: string
  soldBy: SoldBy
  unitLabel: string
  quantity: number
  price: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface SalesOfferFormInput {
  type: SalesOfferType
  name: string
  productId: string
  quantity: string
  price: string
  active: boolean
}

export const salesOfferTypeLabels: Record<SalesOfferType, string> = {
  combo: 'Combo',
  promotion: 'Promoción',
}

export function emptySalesOfferForm(type: SalesOfferType = 'combo'): SalesOfferFormInput {
  return {
    type,
    name: '',
    productId: '',
    quantity: '',
    price: '',
    active: true,
  }
}

export function salesOfferFormFromOffer(offer: SalesOffer): SalesOfferFormInput {
  return {
    type: offer.type,
    name: offer.name,
    productId: offer.productId,
    quantity: String(offer.quantity),
    price: String(offer.price),
    active: offer.active,
  }
}
