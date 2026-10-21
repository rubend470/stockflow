import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { useAuth } from '../../../context/AuthContext'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import { listKeyboardShortcuts, updateKeyboardShortcut } from '../../../services/keyboardShortcutService'
import type { KeyboardShortcut, KeyboardShortcutAction } from '../../../types/keyboardShortcut'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

export function KeyboardShortcutsPage() {
  const { user } = useAuth()
  const { loading, refreshing, run } = usePanelLoader()
  const [shortcuts, setShortcuts] = useState<KeyboardShortcut[]>([])
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = userHasMenuPermission(user, 'keyboard-shortcuts')

  useEffect(() => {
    if (canManage) void loadShortcuts()
  }, [canManage])

  async function loadShortcuts() {
    setError('')
    try {
      await run(async () => setShortcuts(await listKeyboardShortcuts()))
    } catch {
      setError('No se pudieron cargar los atajos.')
    }
  }

  function patchShortcut(id: KeyboardShortcutAction, patch: Partial<KeyboardShortcut>) {
    setShortcuts((current) =>
      current.map((shortcut) => (shortcut.id === id ? { ...shortcut, ...patch } : shortcut)),
    )
  }

  async function saveShortcut(shortcut: KeyboardShortcut) {
    setSavingId(shortcut.id)
    setError('')
    setMessage('')
    try {
      await updateKeyboardShortcut(shortcut.id, {
        keys: shortcut.keys,
        active: shortcut.active,
      })
      setMessage(`Atajo "${shortcut.label}" actualizado.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el atajo.')
    } finally {
      setSavingId('')
    }
  }

  if (!canManage) return <Navigate to="/" replace />

  return (
    <AppLayout title="Atajos de teclado" subtitle="Combinaciones rápidas para el punto de venta">
      <AnimatedPanel className="finance-panel panel-with-overlay">
        <PanelRefreshOverlay show={refreshing} />
        <div className="finance-panel-header">
          <div>
            <h2>Acciones del POS</h2>
            <p>Usa combinaciones simples con Ctrl para evitar choques con el lector de barras.</p>
          </div>
          <button type="button" className="finance-btn finance-btn-secondary" onClick={loadShortcuts}>
            Actualizar
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando atajos...</div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Acción</th>
                  <th>Combinación</th>
                  <th>Estado</th>
                  <th>Guardar</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.map((shortcut, index) => (
                  <AnimatedTableRow key={shortcut.id} index={index}>
                    <td>
                      <strong>{shortcut.label}</strong>
                    </td>
                    <td>
                      <input
                        className="finance-inline-input"
                        value={shortcut.keys}
                        onChange={(event) => patchShortcut(shortcut.id, { keys: event.target.value })}
                        placeholder="Ctrl+K"
                      />
                    </td>
                    <td>
                      <label className="finance-check-row">
                        <input
                          type="checkbox"
                          checked={shortcut.active}
                          onChange={(event) => patchShortcut(shortcut.id, { active: event.target.checked })}
                        />
                        <span>{shortcut.active ? 'Activo' : 'Inactivo'}</span>
                      </label>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="finance-btn finance-btn-primary"
                        disabled={savingId === shortcut.id}
                        onClick={() => saveShortcut(shortcut)}
                      >
                        {savingId === shortcut.id ? 'Guardando...' : 'Guardar'}
                      </button>
                    </td>
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnimatedPanel>
    </AppLayout>
  )
}
