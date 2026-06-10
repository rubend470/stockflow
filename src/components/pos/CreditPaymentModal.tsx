import { useEffect, useMemo, useState } from 'react'
import type { Client } from '../../types/client'
import { MoneyInput } from '../ui/MoneyInput'
import { MoneyText } from '../ui/MoneyText'
import { formatBaseMoney, formatMoneyInputValue, parseMoneyInput } from '../../utils/formatMoney'
import { ModalFrame } from '../ui/ModalFrame'

export interface CreditConfirmInput {
  name: string
  phone: string
  amountInBase: number
}

interface CreditPaymentModalProps {
  open: boolean
  frequentClients: Client[]
  baseCurrencyCode: string
  totalDue: number
  remaining: number
  submitting?: boolean
  onClose: () => void
  onConfirm: (input: CreditConfirmInput) => void
}

export function CreditPaymentModal({
  open,
  frequentClients,
  baseCurrencyCode,
  totalDue,
  remaining,
  submitting = false,
  onClose,
  onConfirm,
}: CreditPaymentModalProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')

  const creditTarget = remaining > 0.01 ? remaining : totalDue

  useEffect(() => {
    if (open) {
      setName('')
      setPhone('')
      setAmount(formatMoneyInputValue(creditTarget))
      setError('')
    }
  }, [open, creditTarget])

  const selectedClient = useMemo(() => {
    const trimmedPhone = phone.trim()
    const trimmedName = name.trim().toLowerCase()
    if (!trimmedPhone && !trimmedName) return null

    return (
      frequentClients.find((client) => {
        if (trimmedPhone && client.phone === trimmedPhone) return true
        return trimmedName && client.name.toLowerCase() === trimmedName
      }) ?? null
    )
  }, [frequentClients, name, phone])

  const availableCredit = useMemo(() => {
    if (!selectedClient || selectedClient.creditLimit <= 0) return null
    return Math.max(selectedClient.creditLimit - selectedClient.balance, 0)
  }, [selectedClient])

  if (!open) return null

  function selectFrequentClient(client: Client) {
    setName(client.name)
    setPhone(client.phone ?? '')
    setError('')
  }

  function handleConfirm() {
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const value = parseMoneyInput(amount)

    if (!trimmedName) {
      setError('Ingresa el nombre de quien compra a crédito.')
      return
    }

    if (!trimmedPhone) {
      setError('Ingresa el teléfono de contacto.')
      return
    }

    if (!value || value <= 0) {
      setError('Ingresa un monto válido.')
      return
    }

    if (value > creditTarget + 0.01) {
      setError(`El crédito no puede superar ${formatBaseMoney(creditTarget)}.`)
      return
    }

    if (selectedClient && selectedClient.creditLimit > 0) {
      const available = selectedClient.creditLimit - selectedClient.balance
      if (value > available + 0.01) {
        setError(`Crédito disponible: ${formatBaseMoney(available)}.`)
        return
      }
    }

    setError('')
    onConfirm({ name: trimmedName, phone: trimmedPhone, amountInBase: value })
  }

  return (
    <ModalFrame onClose={onClose} closeDisabled={submitting}>
        <div className="finance-modal-header">
          <h2>Venta a crédito</h2>
          <p>
            Total venta: <MoneyText amount={totalDue} />
            {remaining > 0.01 && (
              <>
                {' '}
                · Faltante: <MoneyText amount={remaining} />
              </>
            )}
          </p>
        </div>

        {frequentClients.length > 0 && (
          <div className="pos-credit-frequent">
            <span>Frecuentes</span>
            <div className="finance-chip-group">
              {frequentClients.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  className={`finance-chip ${selectedClient?.id === client.id ? 'selected' : ''}`}
                  onClick={() => selectFrequentClient(client)}
                  disabled={submitting}
                >
                  {client.name}
                  {client.phone ? ` · ${client.phone}` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="finance-form-grid">
          <label className="finance-field">
            <span>Nombre</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nombre completo"
              disabled={submitting}
              autoFocus
            />
          </label>
          <label className="finance-field">
            <span>Teléfono</span>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Número de contacto"
              disabled={submitting}
            />
          </label>
        </div>

        {selectedClient && selectedClient.creditLimit > 0 && (
          <div className="pos-credit-hint">
            Límite: <MoneyText amount={selectedClient.creditLimit} /> · Disponible:{' '}
            <MoneyText amount={availableCredit ?? 0} />
          </div>
        )}

        <label className="finance-field finance-field-full">
          <span>Monto a crédito ({baseCurrencyCode})</span>
          <div className="pos-amount-row">
            <MoneyInput value={amount} onChange={setAmount} disabled={submitting} />
            <button
              type="button"
              className="pos-btn pos-btn-secondary"
              onClick={() => setAmount(formatMoneyInputValue(creditTarget))}
              disabled={submitting}
            >
              Precio total
            </button>
          </div>
          <small className="pos-credit-edit-hint">
            Solo se guarda cliente cuando la venta lleva crédito. Nombre y teléfono son obligatorios.
          </small>
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="finance-form-actions">
          <button
            type="button"
            className="finance-btn finance-btn-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="finance-btn finance-btn-primary"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? 'Agregando...' : 'Agregar crédito'}
          </button>
        </div>
    </ModalFrame>
  )
}
