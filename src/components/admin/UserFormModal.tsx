import { useEffect, useState, type FormEvent } from 'react'
import { MenuPermissionsField } from './MenuPermissionsField'
import { roleOptions } from '../../utils/roles'
import type { UserFormInput, UserRole } from '../../types/user'
import { getAllMenuPermissionIds, getDefaultMenuPermissionsForRole } from '../../utils/menuPermissions'
import { ModalFrame } from '../ui/ModalFrame'

interface UserFormModalProps {
  open: boolean
  mode: 'create' | 'edit'
  initialValues: UserFormInput
  submitting?: boolean
  isSelf?: boolean
  onClose: () => void
  onSubmit: (values: UserFormInput) => void
}

export function UserFormModal({
  open,
  mode,
  initialValues,
  submitting = false,
  isSelf = false,
  onClose,
  onSubmit,
}: UserFormModalProps) {
  const [values, setValues] = useState(initialValues)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (open) {
      setValues(initialValues)
      setFormError('')
    }
  }, [open, initialValues])

  if (!open) return null

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setFormError('')

    if (!values.name.trim()) {
      setFormError('El nombre es obligatorio.')
      return
    }

    if (mode === 'create') {
      if (!values.email.trim()) {
        setFormError('El correo es obligatorio.')
        return
      }

      if (values.password.length < 6) {
        setFormError('La contraseña debe tener al menos 6 caracteres.')
        return
      }

      if (values.password !== values.confirmPassword) {
        setFormError('Las contraseñas no coinciden.')
        return
      }
    }

    if (values.role !== 'super_admin' && values.menuPermissions.length === 0) {
      setFormError('Selecciona al menos una opción del menú.')
      return
    }

    onSubmit({
      ...values,
      menuPermissions:
        values.role === 'super_admin'
          ? getAllMenuPermissionIds()
          : values.menuPermissions,
    })
  }

  const isSuperAdminRole = values.role === 'super_admin'

  return (
    <ModalFrame wide onClose={onClose} closeDisabled={submitting}>
      <div className="finance-modal-header">
        <h2>{mode === 'create' ? 'Nuevo usuario' : 'Editar usuario'}</h2>
        <p>
          {mode === 'create'
            ? 'Crea la cuenta y elige qué opciones del menú puede ver.'
            : 'Actualiza nombre, rol, menú y estado de la cuenta.'}
        </p>
      </div>

      <form className="finance-form" onSubmit={handleSubmit}>
        {formError && <div className="alert alert-error">{formError}</div>}

        <div className="finance-form-grid">
          <label className="finance-field finance-field-full">
            <span>Nombre completo</span>
            <input
              type="text"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="Juan Pérez"
              disabled={submitting}
              required
            />
          </label>

          <label className="finance-field finance-field-full">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={values.email}
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              placeholder="usuario@correo.com"
              autoComplete="off"
              disabled={submitting || mode === 'edit'}
              required={mode === 'create'}
            />
            {mode === 'edit' && (
              <small className="finance-field-hint">El correo no se puede cambiar desde aquí.</small>
            )}
          </label>

          {mode === 'create' && (
            <>
              <label className="finance-field">
                <span>Contraseña</span>
                <input
                  type="password"
                  value={values.password}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  disabled={submitting}
                  required
                />
              </label>

              <label className="finance-field">
                <span>Confirmar contraseña</span>
                <input
                  type="password"
                  value={values.confirmPassword}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  placeholder="Repite la contraseña"
                  autoComplete="new-password"
                  disabled={submitting}
                  required
                />
              </label>
            </>
          )}

          <label className="finance-field">
            <span>Rol</span>
            <select
              className="finance-select"
              value={values.role}
              onChange={(event) => {
                const nextRole = event.target.value as UserRole
                setValues((current) => ({
                  ...current,
                  role: nextRole,
                  menuPermissions: getDefaultMenuPermissionsForRole(nextRole),
                }))
              }}
              disabled={submitting || (isSelf && mode === 'edit')}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {isSelf && mode === 'edit' && (
              <small className="finance-field-hint">No puedes cambiar tu propio rol.</small>
            )}
          </label>

          <label className="finance-field users-form-active">
            <span>Estado</span>
            <label className="users-switch users-switch-block">
              <input
                type="checkbox"
                checked={values.active}
                onChange={(event) =>
                  setValues((current) => ({ ...current, active: event.target.checked }))
                }
                disabled={submitting || (isSelf && mode === 'edit')}
              />
              <span>{values.active ? 'Activo' : 'Inactivo'}</span>
            </label>
            {isSelf && mode === 'edit' && (
              <small className="finance-field-hint">No puedes desactivar tu propia cuenta.</small>
            )}
          </label>
        </div>

        <MenuPermissionsField
          role={values.role}
          selectedIds={values.menuPermissions}
          disabled={submitting || isSuperAdminRole}
          onChange={(menuPermissions) => setValues((current) => ({ ...current, menuPermissions }))}
        />
        {isSuperAdminRole && (
          <p className="finance-field-hint">
            Los super administradores tienen acceso a todo el menú automáticamente.
          </p>
        )}

        <div className="finance-form-actions">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button type="submit" className="finance-btn finance-btn-primary" disabled={submitting}>
            {submitting
              ? 'Guardando...'
              : mode === 'create'
                ? 'Crear usuario'
                : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </ModalFrame>
  )
}
