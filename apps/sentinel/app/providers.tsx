'use client'

import { AuthProvider } from '@tomachina/auth'
import { ToastProvider } from '@tomachina/ui'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </AuthProvider>
  )
}
