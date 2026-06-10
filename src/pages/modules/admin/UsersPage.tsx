import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AppLayout } from '../../../components/layout/AppLayout'
import { useAuth } from '../../../context/AuthContext'
import { listUsers, updateUserActive, updateUserRole } from '../../../services/userService'
import type { AppUser, UserRole } from '../../../types/user'
import { roleOptions } from '../../../utils/roles'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    setLoading(true)
    setError('')

    try {
      const data = await listUsers()
      setUsers(data)
    } catch {
      setError('No se pudieron cargar los usuarios. Verifica las reglas de Firestore.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRoleChange(uid: string, role: UserRole) {
    setSavingId(uid)
    setMessage('')
    setError('')

    try {
      await updateUserRole(uid, role)
      setUsers((prev) => prev.map((item) => (item.uid === uid ? { ...item, role } : item)))
      setMessage('Rol actualizado correctamente.')
    } catch {
      setError('No se pudo actualizar el rol.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleActiveChange(uid: string, active: boolean) {
    setSavingId(uid)
    setMessage('')
    setError('')

    try {
      await updateUserActive(uid, active)
      setUsers((prev) => prev.map((item) => (item.uid === uid ? { ...item, active } : item)))
      setMessage(active ? 'Usuario activado.' : 'Usuario desactivado.')
    } catch {
      setError('No se pudo actualizar el estado del usuario.')
    } finally {
      setSavingId(null)
    }
  }

  if (currentUser?.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Usuarios" subtitle="Gestiona roles y acceso al sistema">
      <section className="users-panel">
        <div className="users-panel-header">
          <div>
            <h2>Tabla de usuarios</h2>
            <p>Los perfiles se guardan en Firestore bajo la colección <code>users</code>.</p>
          </div>
          <button type="button" className="users-refresh" onClick={loadUsers} disabled={loading}>
            Actualizar
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="users-loading">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="users-empty">No hay usuarios registrados todavía.</div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = item.uid === currentUser.uid
                  const isSaving = savingId === item.uid

                  return (
                    <tr key={item.uid} className={!item.active ? 'inactive-row' : undefined}>
                      <td>
                        <strong>{item.name}</strong>
                        {isSelf && <span className="users-badge">Tú</span>}
                      </td>
                      <td>{item.email}</td>
                      <td>
                        <select
                          className="users-select"
                          value={item.role}
                          disabled={isSelf || isSaving}
                          onChange={(event) =>
                            handleRoleChange(item.uid, event.target.value as UserRole)
                          }
                        >
                          {roleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label className="users-switch">
                          <input
                            type="checkbox"
                            checked={item.active}
                            disabled={isSelf || isSaving}
                            onChange={(event) =>
                              handleActiveChange(item.uid, event.target.checked)
                            }
                          />
                          <span>{item.active ? 'Activo' : 'Inactivo'}</span>
                        </label>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppLayout>
  )
}
