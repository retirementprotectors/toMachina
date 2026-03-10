'use client'

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Modal } from './Modal'

interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
}

interface ConfirmContextValue {
  showConfirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue>({
  showConfirm: () => Promise.resolve(false),
})

export function useConfirm() {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  const showConfirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ options, resolve })
    })
  }, [])

  const handleClose = (result: boolean) => {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={{ showConfirm }}>
      {children}
      {state && (
        <Modal
          open={true}
          onClose={() => handleClose(false)}
          title={state.options.title}
          size="sm"
          footer={
            <>
              <button
                onClick={() => handleClose(false)}
                className="rounded-md border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                {state.options.cancelLabel || 'Cancel'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`rounded-md px-4 py-2 text-sm text-white ${
                  state.options.variant === 'danger' ? 'bg-[var(--error)]' : 'bg-[var(--portal)]'
                }`}
              >
                {state.options.confirmLabel || 'Confirm'}
              </button>
            </>
          }
        >
          <p className="text-[var(--text-secondary)]">{state.options.message}</p>
        </Modal>
      )}
    </ConfirmContext.Provider>
  )
}
