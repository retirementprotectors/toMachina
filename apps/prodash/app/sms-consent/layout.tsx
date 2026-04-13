import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SMS Text Updates — Retirement Protectors',
  description: 'Opt in to receive SMS text updates from Retirement Protectors, Inc.',
  icons: { icon: '/prodashx-mark.svg' },
}

// Public standalone layout — no portal shell, no Firebase Auth.
// SHINOB1 ruling 2026-04-13: public route, not token-gated.
// Cold-lead funnel: print QR codes, IVR drops, cold marketing.
export default function SMSConsentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f4f7fb',
      fontFamily: "'Mulish', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      color: '#1a2540',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        {children}
      </div>
    </div>
  )
}
