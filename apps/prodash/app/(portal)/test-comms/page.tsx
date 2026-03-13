'use client'

import { useState, useCallback } from 'react'
import { CommsModule } from '@tomachina/ui/src/modules/CommsModule'
import { InboundCallCard, MOCK_INBOUND_CALL } from '@tomachina/ui/src/modules/CommsModule/InboundCallCard'

/**
 * Standalone test page for Communications Module mockup.
 * Route: /test-comms
 *
 * Tests:
 * 1. CommsModule slide-out panel (feed + compose + dialer)
 * 2. InboundCallCard notification (top bar placement mockup)
 *
 * During merge, JDM will wire these into:
 * - PortalSidebar: "Communications" nav item triggers slide-out
 * - TopBar: InboundCallCard in the right section
 * - layout.tsx: CommsModule rendered as fixed slide-out
 */
export default function TestCommsPage() {
  const [commsOpen, setCommsOpen] = useState(false)

  const toggleComms = useCallback(() => {
    setCommsOpen((v) => !v)
  }, [])

  const closeComms = useCallback(() => {
    setCommsOpen(false)
  }, [])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Communications Module — Test Page</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Mockup test for the Communications Module slide-out panel and inbound call notification.
        </p>
      </div>

      {/* Top Bar Mockup — InboundCallCard */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          Top Bar: Inbound Call Notification
        </h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          This component goes in the TopBar right section. Click the green phone indicator to open the call card.
        </p>
        <div className="flex items-center gap-4 rounded-lg bg-[var(--bg-surface)] px-4 py-3">
          <span className="text-xs text-[var(--text-muted)]">...search bar...</span>
          <div className="flex-1" />
          <InboundCallCard call={MOCK_INBOUND_CALL} />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-card)] text-xs font-bold text-[var(--text-muted)]">JM</div>
        </div>
      </div>

      {/* Slide-out Trigger */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          Sidebar: Communications Module Trigger
        </h2>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          In the sidebar, this button appears between Service Centers and RPI Connect. Click to open the slide-out panel.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleComms}
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              commsOpen ? 'text-white' : 'text-[var(--text-secondary)]'
            }`}
            style={{
              background: commsOpen ? 'var(--portal)' : 'rgba(74,122,181,0.08)',
            }}
          >
            <span className="material-icons-outlined" style={{ fontSize: '18px' }}>forum</span>
            Communications
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {commsOpen ? 'Panel open — click to close or use the X' : 'Click to open slide-out panel'}
          </span>
        </div>
      </div>

      {/* Feature Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>list</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Communications Feed</h3>
          </div>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            <li>20 mock entries (SMS, Email, Voice)</li>
            <li>Channel filter pills (All/SMS/Email/Voice)</li>
            <li>Direction filter (All/Inbound/Outbound)</li>
            <li>Scope dropdown (All Team/Mine/Assigned)</li>
            <li>Search across names, agents, content</li>
            <li>Click-to-expand with full content + reply</li>
            <li>Status indicators (Delivered/Read/Failed/Missed)</li>
            <li>Book of Business + Account Type pills</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>edit</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Compose Panel</h3>
          </div>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            <li>Client search with smart results</li>
            <li>Channel toggle (SMS/Email/Call)</li>
            <li>SMS: textarea + char count + from number</li>
            <li>Email: subject + body + from address</li>
            <li>Call: full dialer UI with number pad</li>
            <li>Template dropdown (7 mock templates)</li>
            <li>Portal-colored send button</li>
          </ul>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--success, #10b981)' }}>phone_in_talk</span>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Inbound Call Card</h3>
          </div>
          <ul className="space-y-1 text-xs text-[var(--text-muted)]">
            <li>Pulsing phone indicator in top bar</li>
            <li>Caller name + phone on hover/large screens</li>
            <li>Dropdown card with full caller info</li>
            <li>Book of Business + assigned agent</li>
            <li>Answer / Decline / Route buttons</li>
            <li>Route button for transferring to agent</li>
          </ul>
        </div>
      </div>

      {/* Wiring Instructions */}
      <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Merge Wiring Instructions</h3>
        <div className="space-y-2 text-xs text-[var(--text-muted)]">
          <p><strong>1. PortalSidebar.tsx</strong> — Add &quot;Communications&quot; button (icon: forum) in Fixed Bottom Zone, ABOVE RPI Connect. Wire <code>onCommsToggle</code> + <code>commsOpen</code> props.</p>
          <p><strong>2. TopBar.tsx</strong> — Add <code>&lt;InboundCallCard call=&#123;MOCK_INBOUND_CALL&#125; /&gt;</code> in the right section, before the user avatar.</p>
          <p><strong>3. layout.tsx</strong> — Add <code>commsOpen</code> state + <code>&lt;CommsModule open=&#123;commsOpen&#125; onClose=&#123;closeComms&#125; /&gt;</code> as a fixed overlay.</p>
          <p><strong>4. index.ts</strong> — Add <code>export &#123; CommsModule &#125; from &apos;./CommsModule&apos;</code> to the barrel.</p>
          <p><strong>5. Delete this test page</strong> after merge verification.</p>
        </div>
      </div>

      {/* CommsModule slide-out (rendered here for testing) */}
      <CommsModule open={commsOpen} onClose={closeComms} />
    </div>
  )
}
