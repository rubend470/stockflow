import { useEffect, useMemo, useState } from 'react'
import { DebtPaymentModal } from '../../../components/clients/DebtPaymentModal'
import { LoanFormModal, type LoanFormConfirmInput } from '../../../components/clients/LoanFormModal'
import { LoanPaymentModal } from '../../../components/clients/LoanPaymentModal'
import { AppLayout } from '../../../components/layout/AppLayout'
import { AnimatedPanel, AnimatedTableRow } from '../../../components/ui/motion'
import { ModalFrame } from '../../../components/ui/ModalFrame'
import { PanelRefreshOverlay } from '../../../components/ui/PanelRefreshOverlay'
import { TableAction, TableActions } from '../../../components/ui/TableActions'
import { TablePagination } from '../../../components/ui/TablePagination'
import { usePagination } from '../../../hooks/usePagination'
import { usePanelLoader } from '../../../hooks/usePanelLoader'
import { DEFAULT_BASE_CURRENCY_CODE } from '../../../constants/currency'
import { useAuth } from '../../../context/AuthContext'
import { useConfirm } from '../../../context/ConfirmContext'
import { listAllClients } from '../../../services/clientService'
import {
  createDebt,
  groupDebtsByClient,
  listDebts,
  recordClientDebtPayment,
  recordDebtPayment,
} from '../../../services/debtService'
import { listCurrencies, listLatestExchangeRates, listPaymentMethods } from '../../../services/financeService'
import {
  createLoan,
  groupLoansByBorrower,
  listFrequentBorrowers,
  listLoans,
  recordBorrowerLoanPayment,
  recordLoanPayment,
} from '../../../services/loanService'
import type { Client } from '../../../types/client'
import type { ClientDebtAccount } from '../../../types/debt'
import type { Currency, ExchangeRate, PaymentMethod } from '../../../types/finance'
import type { LoanBorrowerAccount } from '../../../types/loan'
import { MoneyInput } from '../../../components/ui/MoneyInput'
import { formatBaseMoney, parseMoneyInput } from '../../../utils/formatMoney'

type DebtsTab = 'debts' | 'loans'

function formatDate(value: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value))
}

export function DebtsPage() {
  const { user } = useAuth()
  const confirm = useConfirm()
  const [tab, setTab] = useState<DebtsTab>('debts')
  const [clientAccounts, setClientAccounts] = useState<ClientDebtAccount[]>([])
  const [loanAccounts, setLoanAccounts] = useState<LoanBorrowerAccount[]>([])
  const [frequentBorrowers, setFrequentBorrowers] = useState<LoanBorrowerAccount[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [exchangeRates, setExchangeRates] = useState<ExchangeRate[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const { loading, refreshing, run } = usePanelLoader()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [createDebtOpen, setCreateDebtOpen] = useState(false)
  const [createLoanOpen, setCreateLoanOpen] = useState(false)
  const [paymentAccount, setPaymentAccount] = useState<ClientDebtAccount | null>(null)
  const [loanPaymentAccount, setLoanPaymentAccount] = useState<LoanBorrowerAccount | null>(null)
  const [clientId, setClientId] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')

  const canManage = user?.role === 'super_admin' || user?.role === 'admin'

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<{
    clientAccounts: ClientDebtAccount[]
    loanAccounts: LoanBorrowerAccount[]
  }> {
    setError('')
    let accounts: ClientDebtAccount[] = []
    let borrowers: LoanBorrowerAccount[] = []

    try {
      await run(async () => {
        const [debtList, loanList, clientList, methods, currencyList, rates] = await Promise.all([
          listDebts(),
          listLoans(),
          listAllClients(),
          listPaymentMethods(),
          listCurrencies(),
          listLatestExchangeRates(),
        ])
        accounts = groupDebtsByClient(debtList)
        borrowers = groupLoansByBorrower(loanList)
        setClientAccounts(accounts)
        setLoanAccounts(borrowers)
        setFrequentBorrowers(listFrequentBorrowers(loanList))
        setClients(clientList.filter((client) => client.active))
        setPaymentMethods(methods)
        setCurrencies(currencyList.filter((currency) => currency.active))
        setExchangeRates(rates)
        if (clientList[0]) setClientId(clientList[0].id)
      })
      return { clientAccounts: accounts, loanAccounts: borrowers }
    } catch {
      setError('No se pudieron cargar los datos.')
      return { clientAccounts: [], loanAccounts: [] }
    }
  }

  const filteredDebtAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clientAccounts

    return clientAccounts.filter((account) =>
      account.clientName.toLowerCase().includes(query),
    )
  }, [clientAccounts, search])

  const filteredLoanAccounts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return loanAccounts

    return loanAccounts.filter(
      (account) =>
        account.borrowerName.toLowerCase().includes(query) ||
        account.borrowerPhone.includes(query),
    )
  }, [loanAccounts, search])

  const totalDebtBalance = useMemo(
    () => clientAccounts.reduce((sum, account) => sum + account.balance, 0),
    [clientAccounts],
  )

  const totalLoanBalance = useMemo(
    () => loanAccounts.reduce((sum, account) => sum + account.balanceInBase, 0),
    [loanAccounts],
  )

  const debtPagination = usePagination(filteredDebtAccounts, 12)
  const loanPagination = usePagination(filteredLoanAccounts, 12)

  async function handleCreateDebt() {
    if (!canManage) return

    const value = parseMoneyInput(amount)
    if (!clientId || !value || value <= 0) {
      setError('Selecciona un cliente y un monto válido.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createDebt({
        clientId,
        originalAmount: value,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      })
      setMessage('Deuda registrada correctamente.')
      setCreateDebtOpen(false)
      setAmount('')
      setNotes('')
      setDueDate('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la deuda.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCreateLoan(input: LoanFormConfirmInput) {
    if (!user) return

    const confirmed = await confirm({
      title: 'Confirmar préstamo',
      message: `¿Registrar un préstamo de ${formatBaseMoney(input.amountInBase)} a ${input.borrowerName}? El monto saldrá de caja.`,
      confirmLabel: 'Sí, registrar préstamo',
      tone: 'default',
    })
    if (!confirmed) return

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await createLoan(input, user.uid, user.name)
      setMessage('Préstamo registrado correctamente.')
      setCreateLoanOpen(false)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el préstamo.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDebtPayment(input: {
    amount: number
    methodName: string
    reference?: string
    debtId?: string
    targetBalance: number
  }): Promise<boolean> {
    if (!user || !paymentAccount) return false

    const paidClient = paymentAccount
    const isFullPayment = Math.abs(input.amount - input.targetBalance) <= 0.01
    const isSpecificDebt = Boolean(input.debtId)

    const confirmed = await confirm({
      title: isFullPayment ? 'Confirmar pago total' : 'Confirmar abono',
      message: isSpecificDebt
        ? isFullPayment
          ? `¿Registrar el pago de ${formatBaseMoney(input.amount)} y saldar esta deuda de ${paidClient.clientName}?`
          : `¿Registrar un abono de ${formatBaseMoney(input.amount)} a esta deuda de ${paidClient.clientName}?`
        : isFullPayment
          ? `¿Registrar el pago de ${formatBaseMoney(input.amount)} y saldar el saldo total de ${paidClient.clientName}?`
          : `¿Registrar un abono de ${formatBaseMoney(input.amount)} al saldo total de ${paidClient.clientName}?`,
      confirmLabel: isFullPayment ? 'Sí, registrar pago' : 'Sí, registrar abono',
      tone: 'success',
    })
    if (!confirmed) return false

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const paymentInput = {
        amount: input.amount,
        currencyCode: DEFAULT_BASE_CURRENCY_CODE,
        amountInBase: input.amount,
        methodName: input.methodName,
        reference: input.reference,
      }

      if (input.debtId) {
        await recordDebtPayment(
          { debtId: input.debtId, ...paymentInput },
          user.uid,
          user.name,
        )
      } else {
        await recordClientDebtPayment(paidClient.clientId, paymentInput, user.uid, user.name)
      }

      setMessage(
        isFullPayment ? 'Deuda pagada correctamente.' : 'Abono registrado correctamente.',
      )

      const { clientAccounts: accounts } = await loadData()
      const updated = accounts.find((account) => account.clientId === paidClient.clientId)
      if (updated) {
        setPaymentAccount(updated)
      } else {
        setPaymentAccount(null)
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el pago.')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoanPayment(input: {
    amount: number
    currencyCode: string
    amountInBase: number
    methodName: string
    reference?: string
    loanId?: string
    targetBalanceInBase: number
  }): Promise<boolean> {
    if (!user || !loanPaymentAccount) return false

    const paidBorrower = loanPaymentAccount
    const isFullPayment = Math.abs(input.amountInBase - input.targetBalanceInBase) <= 0.01
    const isSpecificLoan = Boolean(input.loanId)

    const confirmed = await confirm({
      title: isFullPayment ? 'Confirmar pago total' : 'Confirmar abono',
      message: isSpecificLoan
        ? isFullPayment
          ? `¿Registrar el pago de ${formatBaseMoney(input.amountInBase)} y saldar este préstamo de ${paidBorrower.borrowerName}?`
          : `¿Registrar un abono de ${formatBaseMoney(input.amountInBase)} a este préstamo de ${paidBorrower.borrowerName}?`
        : isFullPayment
          ? `¿Registrar el pago de ${formatBaseMoney(input.amountInBase)} y saldar el saldo total de ${paidBorrower.borrowerName}?`
          : `¿Registrar un abono de ${formatBaseMoney(input.amountInBase)} al saldo total de ${paidBorrower.borrowerName}?`,
      confirmLabel: isFullPayment ? 'Sí, registrar pago' : 'Sí, registrar abono',
      tone: 'success',
    })
    if (!confirmed) return false

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const paymentInput = {
        amount: input.amount,
        currencyCode: input.currencyCode,
        amountInBase: input.amountInBase,
        methodName: input.methodName,
        reference: input.reference,
      }

      if (input.loanId) {
        await recordLoanPayment(
          { loanId: input.loanId, ...paymentInput },
          user.uid,
          user.name,
        )
      } else {
        await recordBorrowerLoanPayment(
          paidBorrower.borrowerPhone,
          paidBorrower.borrowerName,
          paymentInput,
          user.uid,
          user.name,
        )
      }

      setMessage(
        isFullPayment ? 'Préstamo pagado correctamente.' : 'Abono registrado correctamente.',
      )

      const { loanAccounts: accounts } = await loadData()
      const updated = accounts.find(
        (account) => account.borrowerKey === paidBorrower.borrowerKey,
      )
      if (updated) {
        setLoanPaymentAccount(updated)
      } else {
        setLoanPaymentAccount(null)
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el abono.')
      return false
    } finally {
      setSubmitting(false)
    }
  }

  function openCollectDebt(account: ClientDebtAccount) {
    setError('')
    setPaymentAccount(account)
  }

  function openCollectLoan(account: LoanBorrowerAccount) {
    setError('')
    setLoanPaymentAccount(account)
  }

  return (
    <AppLayout title="Deudas y créditos" subtitle="Cuentas por cobrar y préstamos">
      <AnimatedPanel className="finance-panel panel-with-overlay">
        <PanelRefreshOverlay show={refreshing} />
        <div className="finance-panel-header">
          <div>
            <h2>Deudas y créditos</h2>
            <p>
              {tab === 'debts' ? (
                <>
                  Saldo por cobrar: <strong>{formatBaseMoney(totalDebtBalance)}</strong>
                </>
              ) : (
                <>
                  Saldo en préstamos: <strong>{formatBaseMoney(totalLoanBalance)}</strong>
                </>
              )}
            </p>
          </div>
          <div className="finance-panel-actions">
            <button type="button" className="finance-btn finance-btn-secondary" onClick={loadData}>
              Actualizar
            </button>
            {tab === 'debts' && canManage && (
              <button
                type="button"
                className="finance-btn finance-btn-primary"
                onClick={() => setCreateDebtOpen(true)}
                disabled={clients.length === 0}
              >
                Registrar deuda
              </button>
            )}
            {tab === 'loans' && (
              <button
                type="button"
                className="finance-btn finance-btn-primary"
                onClick={() => setCreateLoanOpen(true)}
                disabled={currencies.length === 0}
              >
                Registrar préstamo
              </button>
            )}
          </div>
        </div>

        <div className="finance-tab-bar">
          <button
            type="button"
            className={`finance-tab ${tab === 'debts' ? 'active' : ''}`}
            onClick={() => {
              setTab('debts')
              setSearch('')
              setError('')
            }}
          >
            Deudas (fiado)
          </button>
          <button
            type="button"
            className={`finance-tab ${tab === 'loans' ? 'active' : ''}`}
            onClick={() => {
              setTab('loans')
              setSearch('')
              setError('')
            }}
          >
            Préstamos
          </button>
        </div>

        <div className="finance-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tab === 'debts' ? 'Buscar cliente...' : 'Buscar por nombre o teléfono...'}
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {message && <div className="alert alert-success">{message}</div>}

        {loading ? (
          <div className="finance-empty">Cargando...</div>
        ) : tab === 'debts' ? (
          filteredDebtAccounts.length === 0 ? (
            <div className="finance-empty">
              <strong>Sin deudas activas</strong>
              <p>No hay clientes con saldo pendiente por cobrar.</p>
            </div>
          ) : (
            <>
              <div className="finance-table-wrap">
                <table className="finance-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Saldo pendiente</th>
                      <th>Deudas activas</th>
                      <th>Última actividad</th>
                      <th className="table-actions-col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debtPagination.paginatedItems.map((account, index) => (
                      <AnimatedTableRow key={account.clientId} index={index}>
                        <td>
                          <strong>{account.clientName}</strong>
                        </td>
                        <td className="text-danger">{formatBaseMoney(account.balance)}</td>
                        <td>{account.activeDebtCount}</td>
                        <td>{formatDate(account.lastActivityAt)}</td>
                        <td className="table-actions-col">
                          <TableActions>
                            <TableAction
                              icon="pay"
                              tone="primary"
                              onClick={() => openCollectDebt(account)}
                            >
                              Cobrar
                            </TableAction>
                          </TableActions>
                        </td>
                      </AnimatedTableRow>
                    ))}
                  </tbody>
                </table>
              </div>
              <TablePagination
                page={debtPagination.page}
                totalPages={debtPagination.totalPages}
                totalItems={debtPagination.totalItems}
                pageSize={debtPagination.pageSize}
                onPageChange={debtPagination.setPage}
              />
            </>
          )
        ) : filteredLoanAccounts.length === 0 ? (
          <div className="finance-empty">
            <strong>Sin préstamos activos</strong>
            <p>No hay prestatarios con saldo pendiente.</p>
          </div>
        ) : (
          <>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Prestatario</th>
                    <th>Teléfono</th>
                    <th>Saldo pendiente</th>
                    <th>Préstamos activos</th>
                    <th>Última actividad</th>
                    <th className="table-actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loanPagination.paginatedItems.map((account, index) => (
                    <AnimatedTableRow key={account.borrowerKey} index={index}>
                      <td>
                        <strong>{account.borrowerName}</strong>
                      </td>
                      <td>{account.borrowerPhone}</td>
                      <td className="text-danger">{formatBaseMoney(account.balanceInBase)}</td>
                      <td>{account.activeLoanCount}</td>
                      <td>{formatDate(account.lastActivityAt)}</td>
                        <td className="table-actions-col">
                          <TableActions>
                            <TableAction
                              icon="pay"
                              tone="primary"
                              onClick={() => openCollectLoan(account)}
                            >
                              Cobrar
                            </TableAction>
                          </TableActions>
                        </td>
                    </AnimatedTableRow>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={loanPagination.page}
              totalPages={loanPagination.totalPages}
              totalItems={loanPagination.totalItems}
              pageSize={loanPagination.pageSize}
              onPageChange={loanPagination.setPage}
            />
          </>
        )}
      </AnimatedPanel>

      {createDebtOpen && (
        <ModalFrame onClose={() => setCreateDebtOpen(false)}>
            <div className="finance-modal-header">
              <h2>Registrar deuda</h2>
            </div>
            <div className="finance-form-grid">
              <label className="finance-field finance-field-full">
                <span>Cliente</span>
                <select value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="finance-field">
                <span>Monto ({DEFAULT_BASE_CURRENCY_CODE})</span>
                <MoneyInput showCurrencyPrefix value={amount} onChange={setAmount} />
              </label>
              <label className="finance-field">
                <span>Fecha límite</span>
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              <label className="finance-field finance-field-full">
                <span>Notas</span>
                <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
            <div className="finance-form-actions">
              <button
                type="button"
                className="finance-btn finance-btn-secondary"
                onClick={() => setCreateDebtOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="finance-btn finance-btn-primary"
                disabled={submitting}
                onClick={handleCreateDebt}
              >
                {submitting ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
        </ModalFrame>
      )}

      <DebtPaymentModal
        open={paymentAccount !== null}
        clientId={paymentAccount?.clientId ?? ''}
        clientName={paymentAccount?.clientName ?? ''}
        balance={paymentAccount?.balance ?? 0}
        paymentMethods={paymentMethods}
        submitting={submitting}
        onClose={() => setPaymentAccount(null)}
        onConfirm={handleDebtPayment}
      />

      <LoanFormModal
        open={createLoanOpen}
        currencies={currencies}
        exchangeRates={exchangeRates}
        frequentBorrowers={frequentBorrowers}
        submitting={submitting}
        onClose={() => setCreateLoanOpen(false)}
        onConfirm={handleCreateLoan}
      />

      <LoanPaymentModal
        open={loanPaymentAccount !== null}
        borrowerName={loanPaymentAccount?.borrowerName ?? ''}
        borrowerPhone={loanPaymentAccount?.borrowerPhone ?? ''}
        balanceInBase={loanPaymentAccount?.balanceInBase ?? 0}
        currencies={currencies}
        exchangeRates={exchangeRates}
        paymentMethods={paymentMethods}
        submitting={submitting}
        onClose={() => setLoanPaymentAccount(null)}
        onConfirm={handleLoanPayment}
      />
    </AppLayout>
  )
}
