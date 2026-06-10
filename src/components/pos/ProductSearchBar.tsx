import { useEffect, useRef } from 'react'

interface ProductSearchBarProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  loading?: boolean
}

export function ProductSearchBar({ value, onChange, onSubmit, loading }: ProductSearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="pos-search">
      <label htmlFor="pos-barcode">Código de barras o búsqueda</label>
      <div className="pos-search-row">
        <input
          id="pos-barcode"
          ref={inputRef}
          type="text"
          value={value}
          placeholder="Escanea o escribe nombre / código..."
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onSubmit()
            }
          }}
        />
        <button type="button" className="pos-btn pos-btn-primary" onClick={onSubmit} disabled={loading}>
          Agregar
        </button>
      </div>
      <p className="pos-search-hint">La lectora de barras funciona como teclado: escanea y presiona Enter.</p>
    </div>
  )
}
