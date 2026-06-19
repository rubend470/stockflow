import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserFormModal } from '../../../components/admin/UserFormModal'
import { AppLayout } from '../../../components/layout/AppLayout'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { sendPasswordReset } from '../../../services/authService'
import { deleteUser, listUsers, updateUser } from '../../../services/userService'
import {
  userFormFromUser,
  type AppUser,
  type UserFormInput,
} from '../../../types/user'
import { formatAppError } from '../../../utils/authErrors'
import { userHasMenuPermission } from '../../../utils/menuPermissions'
import { roleLabels } from '../../../utils/roles'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function UsersPage() {
  const { user: currentUser, refreshUser } = useAuth()
  const confirm = useConfirm()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [formValues, setFormValues] = useState<UserFormInput | null>(null)

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
            <button type="button" className="users-refresh" onClick={loadUsers} disabled={loading}>
              Actualizar
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
                  <th>Registro</th>
                  <th className="table-actions-col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => {
                  const isSelf = item.uid === currentUser.uid

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
