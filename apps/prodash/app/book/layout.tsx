import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Book a Meeting — Retirement Protectors',
  description: 'Schedule a meeting with a Retirement Protectors advisor.',
  icons: { icon: '/prodashx-mark.svg' },
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0e17',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        color: '#e2e8f0',
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 16px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 620 }}>
        {children}
      </div>
    </div>
  )
}
