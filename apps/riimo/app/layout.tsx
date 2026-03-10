import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RIIMO | toMachina',
  description: 'RPI Operations Portal — Powered by toMachina',
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
