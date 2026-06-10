import { useEffect, useMemo, useState } from 'react'
import { AppLayout } from '../../../components/layout/AppLayout'
import { ClientFormModal } from '../../../components/clients/ClientFormModal'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import {
  createClient,
  deleteClient,
  listAllClients,
  updateClient,
} from '../../../services/clientService'
import {
  clientFormFromClient,
  emptyClientForm,
  type Client,
  type ClientFormInput,
} from '../../../types/client'
import { formatBaseMoney } from '../../../utils/formatMoney'

export function ClientsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [clients, setClients] = useState<Client[]>([])
  const { loading, refreshing, run } = usePanelLoader()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [formValues, setFormValues] = useState<ClientFormInput>(emptyClientForm())
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadClients()
  }, [])

  async function loadClients() {
    setError('')

    try {
      await run(async () => {
        const data = await listAllClients()
        setClients(data)
      })
    } catch {
      setError('No se pudieron cargar los clientes.')
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients

    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(query) ||
        client.phone?.includes(query) ||
        client.documentId?.includes(query) ||
        client.email?.toLowerCase().includes(query),
    )
  }, [clients, search])

  const pagination = usePagination(filtered, 12)

  function openCreate() {
    setModalMode('create')
    setEditingClient(null)
    setFormValues(emptyClientForm())
    setModalOpen(true)
  }

  function openEdit(client: Client) {
    setModalMode('edit')
    setEditingClient(client)
    setFormValues(clientFormFromClient(client))
    setModalOpen(true)
  }

  async function handleSubmit(values: ClientFormInput) {
    if (!canManage) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      if (modalMode === 'create') {
        await createClient(values)
        setMessage('Cliente creado correctamente.')
      } else if (editingClient) {
        await updateClient(editingClient.id, values)
        setMessage('Cliente actualizado correctamente.')
      }

      setModalOpen(false)
      await loadClients()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cliente.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(client: Client) {
    if (!canManage) return
    const confirmed = await confirm({
      title: 'Eliminar cliente',
      message: `¿Eliminar a ${client.name}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, eliminar',
      tone: 'danger',
    })
    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await deleteClient(client.id)
      setClients((current) => current.filter((item) => item.id !== client.id))
      setMessage('Cliente eliminado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el cliente.')
    }
  }

  return (
    <AppLayout title="Directorio de clientes" subtitle="Clientes frecuentes y contactos">
      <AnimatedPanel className="finance-panel panel-with-overlay">
        <PanelRefreshOverlay show={refreshing} />
        <div className="finance-panel-header">
          <div>
            <h2>Clientes</h2>
            <p>Gestiona contactos, límites de crédito y saldos pendientes.</p>
          </div>
          {canManage && (
            <div className="finance-panel-actions">
              <button type="button" className="finance-btn finance-btn-secondary" onClick={loadClients}>
                Actualizar
              </button>
              <button type="button" className="finance-btn finance-btn-primary" onClick={openCreate}>
                Nuevo cliente
              </button>
            </div>
          )}
        </div>

        <div className="finance-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre, teléfono o documento..."
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin clientes</strong>
            <p>{canManage ? 'Registra el primer cliente del directorio.' : 'No hay clientes registrados.'}</p>
            {canManage && (
              <button type="button" className="finance-btn finance-btn-primary" onClick={openCreate}>
                Nuevo cliente
              </button>
            )}
          </div>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Límite crédito</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                  {canManage && <th className="table-actions-col">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {pagination.paginatedItems.map((client, index) => (
                  <AnimatedTableRow key={client.id} index={index}>
                    <td>
                      <strong>{client.name}</strong>
                      {client.documentId && (
                        <span className="inventory-subtext">{client.documentId}</span>
                      )}
                    </td>
                    <td>
                      {client.phone || '—'}
                      {client.email && <span className="inventory-subtext">{client.email}</span>}
                    </td>
                    <td>{formatBaseMoney(client.creditLimit)}</td>
                    <td className={client.balance > 0 ? 'text-danger' : undefined}>
                      {formatBaseMoney(client.balance)}
                    </td>
                    <td>
                      <span className={`finance-badge ${client.active ? 'ok' : 'inactive'}`}>
                        {client.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="table-actions-col">
                        <TableActions>
                          <TableAction icon="edit" onClick={() => openEdit(client)}>
                            Editar
                          </TableAction>
                          <TableAction icon="delete" tone="danger" onClick={() => handleDelete(client)}>
                            Eliminar
                          </TableAction>
                        </TableActions>
                      </td>
                    )}
                  </AnimatedTableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <TablePagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        )}
      </AnimatedPanel>

      {canManage && (
        <ClientFormModal
          open={modalOpen}
          mode={modalMode}
          initialValues={formValues}
          submitting={submitting}
          onClose={() => setModalOpen(false)}
          onSubmit={handleSubmit}
        />
      )}
    </AppLayout>
  )
}
