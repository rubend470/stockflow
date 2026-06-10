import { useEffect, useState } from 'react'
import { ModalCloseButton } from '../ui/ModalFrame'
import type { ProductFormInput } from '../../types/product'
import type { StockCategory } from '../../types/stockCategory'
import { ProductForm } from './ProductForm'

interface ProductFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: ProductFormInput
  stockCategories?: StockCategory[]
  canViewCost: boolean
  submitting: boolean
  onClose: () => void
  onSubmit: (values: ProductFormInput) => void
}

export function ProductFormModal({
  open,
  mode,
  initialValues,
  stockCategories = [],
  canViewCost,
  submitting,
  onClose,
  onSubmit,
}: ProductFormModalProps) {
  const [formKey, setFormKey] = useState(0)

  useEffect(() => {
    if (open) setFormKey((current) => current + 1)
  }, [open, initialValues])

  if (!open) return null

  return (
    <div className="inventory-modal-backdrop" onClick={onClose}>
      <div className="inventory-modal inventory-modal-wide" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClick={onClose} />
        <div className="inventory-modal-header">
          <h2>{mode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h2>
          <p>Completa la información del catálogo para usarlo al vender.</p>
        </div>

        <ProductForm
          key={formKey}
          initialValues={initialValues}
          stockCategories={stockCategories}
          canViewCost={canViewCost}
          submitting={submitting}
          submitLabel={mode === 'create' ? 'Crear producto' : 'Guardar cambios'}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}
