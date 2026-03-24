'use client'

import { AuthProvider, UserProfileProvider } from '@tomachina/auth'
import { ToastProvider } from '@tomachina/ui'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed — app works fine without it
      })
    }
    // Mark body as PWA mode if running standalone
    if (window.matchMedia('(display-mode: standalone)').matches) {
      document.body.classList.add('pwa-mode')
    }
  }, [])

  return (
    <AuthProvider>
      <UserProfileProvider>
        <ToastProvider>{children}</ToastProvider>
      </UserProfileProvider>
    </AuthProvider>
  )
}
