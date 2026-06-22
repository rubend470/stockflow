import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserFormModal } from '../../../components/admin/UserFormModal'
import { AppLayout } from '../../../components/layout/AppLayout'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { sendPasswordReset } from '../../../services/authService'
import { deleteUser, subscribeToUsers, updateUser } from '../../../services/userService'
import {
  userFormFromUser,
  type AppUser,
  type UserFormInput,
} from '../../../types/user'
import { formatAppError } from '../../../utils/authErrors'
import { userHasMenuPermission } from '../../../utils/menuPermissions'
import { roleLabels } from '../../../utils/roles'

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000
const RECENT_THRESHOLD_MS = 10 * 60 * 1000

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatPresenceAge(ageMs: number) {
  const seconds = Math.max(0, Math.floor(ageMs / 1000))
  if (seconds < 10) return 'Ahora'
  if (seconds < 60) return `Hace ${seconds} s`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes} min`

  const hours = Math.floor(minutes / 60)
  return `Hace ${hours} h`
}

function routeLabel(path?: string) {
  if (!path) return '—'
  if (path === '/') return 'Inicio'
  if (path.startsWith('/ventas/pos')) return 'Ventas'
  if (path.startsWith('/ventas/historial')) return 'Historial de ventas'
  if (path.startsWith('/ventas/cierre')) return 'Cierre de caja'
  if (path.startsWith('/ventas/facturas-pendientes')) return 'Facturas pendientes'
  if (path.startsWith('/finanzas/cambio')) return 'Cambio de moneda'
  if (path.startsWith('/finanzas/gastos')) return 'Gastos'
  if (path.startsWith('/finanzas/monedas')) return 'Monedas y tasas'
  if (path.startsWith('/finanzas/pagos')) return 'Formas de pago'
  if (path.startsWith('/clientes/deudas')) return 'Deudas y créditos'
  if (path.startsWith('/inventario/productos')) return 'Productos'
  if (path.startsWith('/inventario/categorias')) return 'Categorías'
  if (path.startsWith('/inventario/proveedores')) return 'Proveedores'
  if (path.startsWith('/reportes')) return 'Reportes'
  if (path.startsWith('/admin/usuarios')) return 'Usuarios'
  if (path.startsWith('/admin/configuracion')) return 'Configuración'
  return path
}

function getPresenceStatus(user: AppUser, now: number) {
  const lastSeenAt = user.presence?.lastSeenAt
  if (!lastSeenAt) {
    return { label: 'Sin actividad', className: 'offline', detail: '—' }
  }

  const lastSeenTime = new Date(lastSeenAt).getTime()
  if (Number.isNaN(lastSeenTime)) {
    return { label: 'Sin actividad', className: 'offline', detail: '—' }
  }

  const age = now - lastSeenTime
  if (user.presence?.state === 'online' && age <= ONLINE_THRESHOLD_MS) {
    return { label: 'En línea', className: 'online', detail: formatPresenceAge(age) }
  }

  if (age <= RECENT_THRESHOLD_MS) {
    return { label: 'Reciente', className: 'recent', detail: formatPresenceAge(age) }
  }

  return { label: 'Desconectado', className: 'offline', detail: formatDate(lastSeenAt) }
}

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth()
  const confirm = useConfirm()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [formValues, setFormValues] = useState<UserFormInput | null>(null)

  useEffect(() => {
    setLoading(true)
    setError('')

    return subscribeToUsers(
      (data) => {
        setUsers(data)
        setLoading(false)
      },
      () => {
        setError('No se pudieron escuchar los usuarios. Verifica las reglas de Firestore.')
        setLoading(false)
      },
    )
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(intervalId)
  }, [])

  function openEditModal(user: AppUser) {
    setEditingUser(user)
    setFormValues(userFormFromUser(user))
    setModalOpen(true)
  }

  async function handleSubmit(values: UserFormInput) {
    if (!editingUser) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const isSelf = editingUser.uid === currentUser?.uid
      await updateUser(editingUser.uid, {
        name: values.name.trim(),
        role: isSelf ? editingUser.role : values.role,
        active: isSelf ? editingUser.active : values.active,
        menuPermissions: values.menuPermissions,
      })
      setUsers((current) =>
        current.map((item) =>
          item.uid === editingUser.uid
            ? {
                ...item,
                name: values.name.trim(),
                role: isSelf ? item.role : values.role,
                active: isSelf ? item.active : values.active,
                menuPermissions: values.menuPermissions,
              }
            : item,
        ),
      )
      setMessage('Usuario actualizado correctamente.')
      if (isSelf) {
        await refreshUser()
      }
      setModalOpen(false)
    } catch (err) {
      setError(formatAppError(err, 'No se pudo guardar el usuario.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePasswordReset(user: AppUser) {
    const confirmed = await confirm({
      title: 'Restablecer contraseña',
      message: `¿Enviar un correo de restablecimiento a ${user.email}?`,
      confirmLabel: 'Sí, enviar',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await sendPasswordReset(user.email)
      setMessage(`Correo de restablecimiento enviado a ${user.email}.`)
    } catch (err) {
      setError(formatAppError(err))
    }
  }

  async function handleDelete(user: AppUser) {
    if (user.uid === currentUser?.uid) return

    const confirmed = await confirm({
      title: 'Eliminar usuario',
      message: `¿Eliminar el perfil de ${user.name}? La cuenta de acceso en Firebase Auth seguirá existiendo; el usuario no podrá usar la app sin perfil.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await deleteUser(user.uid)
      setUsers((current) => current.filter((item) => item.uid !== user.uid))
      setMessage(`Perfil de ${user.name} eliminado.`)
    } catch {
      setError('No se pudo eliminar el usuario.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentUser || !userHasMenuPermission(currentUser, 'users')) {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Usuarios" subtitle="Gestiona accesos, roles y permisos del menú">
      <section className="users-panel">
        <div className="users-panel-header">
          <div>
            <h2>Equipo del sistema</h2>
            <p>Edita permisos del menú, roles y activa o desactiva cuentas del equipo.</p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="users-refresh" disabled>
              En vivo
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="users-loading">Cargando usuarios...</div>
        ) : users.length === 0 ? (
          <div className="users-empty">
            <strong>Sin usuarios registrados</strong>
            <p>Los usuarios aparecerán aquí cuando se registren en el sistema.</p>
          </div>
        ) : (
          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Correo</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>En línea</th>
                  <th>Registro</th>
                  <th className="table-actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = item.uid === currentUser.uid
                  const presence = getPresenceStatus(item, now)

                  return (
                    <tr key={item.uid} className={!item.active ? 'inactive-row' : undefined}>
                      <td>
                        <strong>{item.name}</strong>
                        {isSelf && <span className="users-badge">Tú</span>}
                      </td>
                      <td>{item.email}</td>
                      <td>{roleLabels[item.role] ?? item.role}</td>
                      <td>
                        <span className={`finance-badge ${item.active ? 'ok' : 'inactive'}`}>
                          {item.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td>
                        <span className={`users-presence users-presence-${presence.className}`}>
                          {presence.label}
                        </span>
                        <span className="users-presence-detail">
                          {presence.detail}
                          {item.presence?.activePath ? ` · ${routeLabel(item.presence.activePath)}` : ''}
                        </span>
                      </td>
                      <td>{formatDate(item.createdAt)}</td>
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction icon="edit" onClick={() => openEditModal(item)}>
                            Editar
                          </TableAction>
                          <TableAction icon="pay" onClick={() => handlePasswordReset(item)}>
                            Restablecer clave
                          </TableAction>
                          {!isSelf && (
                            <TableAction
                              icon="delete"
                              tone="danger"
                              disabled={submitting}
                              onClick={() => handleDelete(item)}
                            >
                              Eliminar
                            </TableAction>
                          )}
                        </TableActions>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formValues && (
        <UserFormModal
          open={modalOpen}
          mode="edit"
          initialValues={formValues}
          submitting={submitting}
          isSelf={editingUser?.uid === currentUser.uid}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </AppLayout>
  )
}
