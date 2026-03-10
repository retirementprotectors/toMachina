import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@tomachina/auth'
import { ToastProvider } from '@tomachina/ui'

export const metadata: Metadata = {
  title: 'ProDash | toMachina',
  description: 'RPI Client Portal',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg-primary)]">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
