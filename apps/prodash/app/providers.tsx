'use client'

import { AuthProvider, UserProfileProvider } from '@tomachina/auth'
import { ToastProvider } from '@tomachina/ui'
import type { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UserProfileProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </UserProfileProvider>
    </AuthProvider>
  )
}
