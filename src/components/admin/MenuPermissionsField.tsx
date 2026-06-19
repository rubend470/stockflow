import {
  getDefaultMenuPermissionsForRole,
  listMenuPermissionOptions,
} from '../../utils/menuPermissions'
import type { UserRole } from '../../types/user'

interface MenuPermissionsFieldProps {
  role: UserRole
  selectedIds: string[]
  disabled?: boolean
  onChange: (ids: string[]) => void
}

export function MenuPermissionsField({
  role,
  selectedIds,
  disabled = false,
  onChange,
}: MenuPermissionsFieldProps) {
  const options = listMenuPermissionOptions()
  const selected = new Set(selectedIds)

  const groups = options.reduce<Map<string, typeof options>>((map, option) => {
    const list = map.get(option.group) ?? []
    list.push(option)
    map.set(option.group, list)
    return map
  }, new Map())

  function toggle(id: string) {
    if (disabled) return
    if (selected.has(id)) {
      onChange(selectedIds.filter((entry) => entry !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  function selectAll() {
    if (disabled) return
    onChange(options.map((option) => option.id))
  }

  function clearAll() {
    if (disabled) return
    onChange([])
  }

  function applyRoleDefault() {
    if (disabled) return
    onChange(getDefaultMenuPermissionsForRole(role))
  }

  return (
    <section className="menu-permissions-field">
      <div className="menu-permissions-header">
        <div>
          <h3>Opciones del menú</h3>
          <p className="finance-field-hint">
            Marca las pantallas que este usuario puede ver. Si no seleccionas ninguna, no podrá
            navegar.
          </p>
        </div>
        <div className="menu-permissions-actions">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={applyRoleDefault}
            disabled={disabled}
          >
            Menú del rol
          </button>
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={selectAll}
            disabled={disabled}
          >
            Todas
          </button>
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={clearAll}
            disabled={disabled}
          >
            Ninguna
          </button>
        </div>
      </div>

      <div className="menu-permissions-groups">
        {[...groups.entries()].map(([group, groupOptions]) => (
          <article key={group} className="menu-permissions-group">
            <h4>{group}</h4>
            <div className="menu-permissions-grid">
              {groupOptions.map((option) => (
                <label key={option.id} className="menu-permissions-option">
                  <input
                    type="checkbox"
                    checked={selected.has(option.id)}
                    onChange={() => toggle(option.id)}
                    disabled={disabled}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
