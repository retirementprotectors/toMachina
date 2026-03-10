import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SENTINEL | toMachina',
  description: 'RPI B2B Portal — Powered by toMachina',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
