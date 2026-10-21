import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { useAuth } from '../../../context/AuthContext'
import {
  createBusiness,
  listBusinesses,
  setBusinessStatus,
  setUserBusinessMembership,
} from '../../../services/businessService'
import { listUsers } from '../../../services/userService'
import type { Business } from '../../../types/business'
import type { AppUser } from '../../../types/user'

export function BusinessesPage() {
  const { user, refreshUser } = useAuth()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [name, setName] = useState('')
  const [id, setId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [businessList, userList] = await Promise.all([listBusinesses(), listUsers()])
      setBusinesses(businessList)
      setUsers(userList)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar las empresas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadData(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  if (!user || user.role !== 'super_admin') return <Navigate to="/" replace />
  const superAdmin = user

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      await createBusiness(id, name, superAdmin.uid)
      await refreshUser()
      setName('')
      setId('')
      setMessage('Empresa creada. Ya puedes asignarle usuarios.')
      await loadData()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMembership(member: AppUser, business: Business, assigned: boolean) {
    setError('')
    setMessage('')
    try {
      await setUserBusinessMembership(member.uid, business.id, assigned)
      setUsers((current) => current.map((item) => {
        if (item.uid !== member.uid) return item
        const currentIds = item.businessIds ?? []
        return {
          ...item,
          businessIds: assigned
            ? [...new Set([...currentIds, business.id])]
            : currentIds.filter((businessId) => businessId !== business.id),
        }
      }))
      if (member.uid === superAdmin.uid) await refreshUser()
      setMessage('Acceso actualizado.')
    } catch (membershipError) {
      setError(membershipError instanceof Error ? membershipError.message : 'No se pudo actualizar el acceso.')
    }
  }

  return (
    <AppLayout title="Empresas" subtitle="Separa datos y accesos por comercio">
      <div className="businesses-layout">
        <section className="businesses-create">
          <div>
            <h2>Nueva empresa</h2>
            <p>Crea un espacio vacío. Los datos de otros comercios no se copian automáticamente.</p>
          </div>
          <form onSubmit={handleCreate}>
            <label>
              Nombre comercial
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Identificador
              <input
                value={id}
                onChange={(event) => setId(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="mi-comercio"
                minLength={3}
                required
              />
            </label>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Creando...' : 'Crear empresa'}
            </button>
          </form>
        </section>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        <section className="businesses-directory">
          <div className="businesses-heading">
            <div>
              <h2>Empresas y accesos</h2>
              <p>Marca los usuarios que pueden trabajar dentro de cada comercio.</p>
            </div>
            <button type="button" className="secondary-button" onClick={() => void loadData()}>
              Actualizar
            </button>
          </div>

          {loading ? <p>Cargando empresas...</p> : businesses.length === 0 ? (
            <p>No hay empresas creadas todavía.</p>
          ) : businesses.map((business) => (
            <article className="business-row" key={business.id}>
              <div className="business-row-summary">
                <div>
                  <strong>{business.name}</strong>
                  <span>{business.id}</span>
                </div>
                <label className="business-status">
                  <input
                    type="checkbox"
                    checked={business.status === 'active'}
                    onChange={async (event) => {
                      await setBusinessStatus(business.id, event.target.checked)
                      setBusinesses((current) => current.map((item) => item.id === business.id
                        ? { ...item, status: event.target.checked ? 'active' : 'inactive' }
                        : item))
                    }}
                  />
                  Activa
                </label>
              </div>
              <div className="business-members">
                {users.map((member) => (
                  <label key={member.uid}>
                    <input
                      type="checkbox"
                      checked={member.businessIds?.includes(business.id) ?? false}
                      onChange={(event) => void handleMembership(member, business, event.target.checked)}
                    />
                    <span>{member.name}</span>
                    <small>{member.email}</small>
                  </label>
                ))}
              </div>
            </article>
          ))}
        </section>
      </div>
    </AppLayout>
  )
}
