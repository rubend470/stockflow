interface SaleProcessingOverlayProps {
  open: boolean
  message?: string
}

export function SaleProcessingOverlay({
  open,
  message = 'Registrando venta...',
}: SaleProcessingOverlayProps) {
  if (!open) return null

  return (
    <div className="pos-processing-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="pos-processing-card">
        <div className="loading-spinner" aria-hidden="true" />
        <strong>{message}</strong>
        <p>Por favor espera un momento.</p>
      </div>
    </div>
  )
}
