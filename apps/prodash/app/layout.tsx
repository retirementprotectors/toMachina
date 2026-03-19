import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: {
    template: 'ProDashX | %s',
    default: 'toMachina / ProDashX',
  },
  description: 'RPI Client Portal — Powered by toMachina',
  icons: {
    icon: '/prodashx-mark.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-[var(--bg-primary)]">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
