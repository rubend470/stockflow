import { useMemo, type ChangeEvent } from 'react'
import type { Supplier } from '../../types/supplier'

interface SupplierNameFieldProps {
  value: string
  suppliers: Supplier[]
  disabled?: boolean
  onChange: (name: string, supplierId?: string) => void
}

export function SupplierNameField({
  value,
  suppliers,
  disabled = false,
  onChange,
}: SupplierNameFieldProps) {
  const listId = 'supplier-name-suggestions'
  const matches = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (!query) return suppliers
    return suppliers.filter((supplier) => supplier.name.toLowerCase().includes(query))
  }, [value, suppliers])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextName = event.target.value
    const exact = suppliers.find(
      (supplier) => supplier.name.toLowerCase() === nextName.trim().toLowerCase(),
    )
    onChange(nextName, exact?.id)
  }

  return (
    <label className="purchase-field purchase-field-full">
      <span>Proveedor</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        list={listId}
        placeholder="Escribe o elige un proveedor"
        disabled={disabled}
        required
      />
      <datalist id={listId}>
        {matches.map((supplier) => (
          <option key={supplier.id} value={supplier.name} />
        ))}
      </datalist>
      <small className="purchase-field-hint-muted">
        Si no existe, se crea automáticamente al guardar la factura.
      </small>
    </label>
  )
}
