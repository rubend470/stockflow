interface PanelRefreshOverlayProps {
  show: boolean
  message?: string
}

export function PanelRefreshOverlay({
  show,
  message = 'Actualizando...',
}: PanelRefreshOverlayProps) {
  if (!show) return null

  return (
    <div className="panel-refresh-overlay" role="status" aria-live="polite" aria-busy="true">
      <div className="panel-refresh-card">
        <div className="loading-spinner" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  )
}
