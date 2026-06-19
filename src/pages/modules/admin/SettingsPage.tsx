import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../../constants/currency'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel } from '../../../components/ui/motion'
import { useAuth } from '../../../context/AuthContext'
import { getBaseCurrency, listCurrencies } from '../../../services/financeService'
import { getAppSettings, updateAppSettings } from '../../../services/settingsService'
import { emptyAppSettingsForm, type AppSettingsFormInput } from '../../../types/settings'
import { userHasMenuPermission } from '../../../utils/menuPermissions'

export function SettingsPage() {
  const { user } = useAuth()
  const [values, setValues] = useState<AppSettingsFormInput>(emptyAppSettingsForm())
  const [baseCurrency, setBaseCurrency] = useState(DEFAULT_BASE_CURRENCY_CODE)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const canManage = userHasMenuPermission(user, 'settings')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    setError('')

    try {
      const [settings, currencies] = await Promise.all([getAppSettings(), listCurrencies()])
      const base = getBaseCurrency(currencies)

      setValues({
        businessName: settings.businessName,
        address: settings.address,
        phone: settings.phone,
        taxEnabled: settings.taxEnabled,
        taxRate: settings.taxRate,
        lowStockAlertEnabled: settings.lowStockAlertEnabled,
      })
      setBaseCurrency(base?.code ?? settings.baseCurrency)
    } catch {
      setError('No se pudo cargar la configuración.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await updateAppSettings(values, baseCurrency)
      setMessage('Configuración guardada correctamente.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!canManage) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Configuración" subtitle="Ajustes generales del negocio">
      <AnimatedPanel className="finance-panel">
        <div className="finance-panel-header">
          <div>
            <h2>Datos del negocio</h2>
            <p>Información del local y preferencias del sistema.</p>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando configuración...</div>
        ) : (
          <form className="finance-form" onSubmit={handleSubmit}>
            <div className="finance-form-grid">
              <label className="finance-field finance-field-full">
                <span>Nombre del negocio</span>
                <input
                  type="text"
                  value={values.businessName}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, businessName: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="finance-field finance-field-full">
                <span>Dirección</span>
                <input
                  type="text"
                  value={values.address}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, address: event.target.value }))
                  }
                />
              </label>

              <label className="finance-field">
                <span>Teléfono</span>
                <input
                  type="text"
                  value={values.phone}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>

              <label className="finance-field">
                <span>Moneda principal</span>
                <input type="text" value={baseCurrency} disabled />
              </label>

              <label className="finance-field finance-field-full">
                <span className="finance-checkbox-label">
                  <input
                    type="checkbox"
                    checked={values.lowStockAlertEnabled}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        lowStockAlertEnabled: event.target.checked,
                      }))
                    }
                  />
                  Alertas de stock bajo
                </span>
              </label>

              <label className="finance-field finance-field-full">
                <span className="finance-checkbox-label">
                  <input
                    type="checkbox"
                    checked={values.taxEnabled}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, taxEnabled: event.target.checked }))
                    }
                  />
                  Aplicar impuesto en ventas
                </span>
              </label>

              {values.taxEnabled && (
                <label className="finance-field">
                  <span>Tasa de impuesto (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={values.taxRate}
                    onChange={(event) =>
                      setValues((current) => ({ ...current, taxRate: Number(event.target.value) }))
                    }
                  />
                </label>
              )}
            </div>

            <div className="finance-form-actions">
              <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
                {submitting ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </form>
        )}
      </AnimatedPanel>
    </AppLayout>
  )
}
