import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ConfirmDialog, type ConfirmTone } from '../components/ui/ConfirmDialog'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  function close(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={state !== null}
        title={state?.title ?? ''}
        message={state?.message ?? ''}
        confirmLabel={state?.confirmLabel}
        cancelLabel={state?.cancelLabel}
        tone={state?.tone}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm debe usarse dentro de ConfirmProvider.')
  }
  return context.confirm
}
