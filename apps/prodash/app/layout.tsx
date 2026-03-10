import type { Metadata } from 'next'
import './globals.css'

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
      <body className="min-h-screen bg-[var(--bg-primary)]">
        {children}
      </body>
    </html>
  )
}
