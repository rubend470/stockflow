import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserFormModal } from '../../../components/admin/UserFormModal'
import { AppLayout } from '../../../components/layout/AppLayout'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { createUserByAdmin, sendPasswordReset } from '../../../services/authService'
import { deleteUser, listUsers, updateUser } from '../../../services/userService'
import {
  emptyUserForm,
  userFormFromUser,
  type AppUser,
  type UserFormInput,
} from '../../../types/user'
import { getAuthErrorMessage } from '../../../utils/authErrors'
import { roleLabels } from '../../../utils/roles'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const confirm = useConfirm()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [formValues, setFormValues] = useState<UserFormInput>(emptyUserForm())

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

  function openCreateModal() {
    setModalMode('create')
    setEditingUser(null)
    setFormValues(emptyUserForm())
    setModalOpen(true)
  }

  function openEditModal(user: AppUser) {
    setModalMode('edit')
    setEditingUser(user)
    setFormValues(userFormFromUser(user))
    setModalOpen(true)
  }

  async function handleSubmit(values: UserFormInput) {
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (modalMode === 'create') {
        const created = await createUserByAdmin({
          name: values.name,
          email: values.email,
          password: values.password,
          role: values.role,
          active: values.active,
        })
        setUsers((current) =>
          [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        )
        setMessage(`Usuario ${created.name} creado correctamente.`)
      } else if (editingUser) {
        const isSelf = editingUser.uid === currentUser?.uid
        await updateUser(editingUser.uid, {
          name: values.name.trim(),
          role: isSelf ? editingUser.role : values.role,
          active: isSelf ? editingUser.active : values.active,
        })
        setUsers((current) =>
          current.map((item) =>
            item.uid === editingUser.uid
              ? {
                  ...item,
                  name: values.name.trim(),
                  role: isSelf ? item.role : values.role,
                  active: isSelf ? item.active : values.active,
                }
              : item,
          ),
        )
        setMessage('Usuario actualizado correctamente.')
      }

      setModalOpen(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : getAuthErrorMessage(err) || 'No se pudo guardar el usuario.',
      )
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
      setError(getAuthErrorMessage(err))
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

  if (currentUser?.role !== 'super_admin') {
    return <Navigate to="/" replace />
  }

  return (
    <AppLayout title="Usuarios" subtitle="Crea cuentas, asigna roles y gestiona el acceso">
      <section className="users-panel">
        <div className="users-panel-header">
          <div>
            <h2>Equipo del sistema</h2>
            <p>
              Crea usuarios nuevos, cambia roles y activa o desactiva el acceso. Solo Super Admin
              puede administrar cuentas.
            </p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="users-refresh" onClick={loadUsers} disabled={loading}>
              Actualizar
            </button>
            <button
              type="button"
              className="finance-btn finance-btn-primary"
              onClick={openCreateModal}
              disabled={loading || submitting}
            >
              Nuevo usuario
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
            <p>Crea el primer usuario con el botón <strong>Nuevo usuario</strong>.</p>
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

      <UserFormModal
        open={modalOpen}
        mode={modalMode}
        initialValues={formValues}
        submitting={submitting}
        isSelf={editingUser?.uid === currentUser.uid}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
      />
    </AppLayout>
  )
}
