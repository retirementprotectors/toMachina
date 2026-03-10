import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@tomachina/auth'
import { ToastProvider } from '@tomachina/ui'

export const metadata: Metadata = {
  title: 'ProDash | toMachina',
  description: 'RPI Client Portal — Powered by toMachina',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
      </head>
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
