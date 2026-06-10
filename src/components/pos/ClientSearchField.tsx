import { useMemo } from 'react'
import type { Client } from '../../types/client'
import { formatBaseMoney } from '../../utils/formatMoney'

interface ClientSearchFieldProps {
  value: string
  clients: Client[]
  selectedClient: Client | null
  onChange: (value: string) => void
  onSelect: (client: Client) => void
  onClear: () => void
}

export function ClientSearchField({
  value,
  clients,
  selectedClient,
  onChange,
  onSelect,
  onClear,
}: ClientSearchFieldProps) {
  const query = value.trim().toLowerCase()

  const suggestions = useMemo(() => {
    if (!query || selectedClient) return []

    return clients
      .filter((client) => client.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [clients, query, selectedClient])

  const showCreateHint =
    query.length >= 2 &&
    !selectedClient &&
    !clients.some((client) => client.name.toLowerCase() === query)

  return (
    <div className="pos-client">
      {selectedClient ? (
        <div className="pos-client-selected-row">
          <div className="pos-client-selected">
            <strong>{selectedClient.name}</strong>
            {selectedClient.balance > 0 && (
              <span>Saldo: {formatBaseMoney(selectedClient.balance)}</span>
            )}
          </div>
          <button type="button" className="pos-link-btn" onClick={onClear}>
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <label className="pos-field pos-field-full" htmlFor="pos-client-search">
            <span>Nombre del cliente</span>
            <input
              id="pos-client-search"
              type="text"
              value={value}
              placeholder="Buscar o escribir nombre..."
              autoComplete="off"
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && suggestions.length === 1) {
                  event.preventDefault()
                  onSelect(suggestions[0])
                }
              }}
            />
          </label>

          {suggestions.length > 0 && (
            <ul className="pos-autocomplete-list pos-autocomplete-list-below">
              {suggestions.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className="pos-autocomplete-item"
                    onClick={() => onSelect(client)}
                  >
                    <span>
                      <strong>{client.name}</strong>
                      {client.phone && <small>{client.phone}</small>}
                    </span>
                    {client.balance > 0 && (
                      <span className="pos-client-balance">
                        Debe {formatBaseMoney(client.balance)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {showCreateHint && (
            <p className="pos-search-hint">
              Si no existe, se registrará automáticamente al confirmar la venta.
            </p>
          )}
        </>
      )}
    </div>
  )
}
