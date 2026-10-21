import { useEffect, useState } from 'react'
import { ModalCloseButton } from '../ui/ModalFrame'
import type { ProductFormInput, ProductTypeOption } from '../../types/product'
import type { StockCategory } from '../../types/stockCategory'
import { ProductForm } from './ProductForm'

interface ProductFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: ProductFormInput
  stockCategories?: StockCategory[]
  productTypes?: ProductTypeOption[]
  canViewCost: boolean
  submitting: boolean
  nested?: boolean
  fromPurchaseEntry?: boolean
  onClose: () => void
  onSubmit: (values: ProductFormInput) => void
}

export function ProductFormModal({
  open,
  mode,
  initialValues,
  stockCategories = [],
  productTypes,
  canViewCost,
  submitting,
  nested = false,
  fromPurchaseEntry = false,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (open) setFormKey((current) => current + 1)
  }, [open, initialValues])

  if (!open) return null

  return (
    <div
      className={[
        'inventory-modal-backdrop',
        nested ? 'inventory-modal-backdrop-nested' : undefined,
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onClose}
    >
      <div
        className="inventory-modal inventory-modal-wide inventory-modal-scrollable"
        onClick={(event) => event.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} disabled={submitting} />
        <div className="inventory-modal-header inventory-modal-header-fixed">
          <h2>{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
          <p>
            {fromPurchaseEntry
              ? 'Completa categoría, precios y si se vende al mayor. El stock lo suma la entrada de mercancía.'
              : mode === 'create'
                ? 'Define nombre, categoría, precios y si se vende al mayor.'
                : 'Completa la información del catálogo para usarlo al vender.'}
          </p>
        </div>

        <div className="inventory-modal-body">
          <ProductForm
            key={formKey}
            initialValues={initialValues}
            stockCategories={stockCategories}
            productTypes={productTypes}
            canViewCost={canViewCost}
            submitting={submitting}
            omitStockFields={fromPurchaseEntry}
            submitLabel={mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
            onCancel={onClose}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  )
}
