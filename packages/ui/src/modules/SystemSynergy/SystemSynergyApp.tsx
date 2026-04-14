'use client'

import { useState } from 'react'
import { DashboardView } from './DashboardView'
import { SessionBrowserView } from './SessionBrowserView'
import { KnowledgePipelineView } from './KnowledgePipelineView'
import { CleanupControlsView } from './CleanupControlsView'
import { GuardianView } from './guardian/GuardianView'

// ── Types ──────────────────────────────────────────────────────────────

export interface SystemSynergyProps {
  portal?: string
}

type TabKey = 'dashboard' | 'sessions' | 'knowledge' | 'cleanup' | 'guardian'

interface Tab {
  key: TabKey
  label: string
  icon: string
}

// ── Constants ──────────────────────────────────────────────────────────

const SYNERGY_TEAL = '#14b8a6'

const TABS: Tab[] = [
  { key: 'dashboard',  label: 'Dashboard',         icon: 'dashboard' },
  { key: 'sessions',   label: 'Session Browser',   icon: 'terminal' },
  { key: 'knowledge',  label: 'Knowledge Pipeline', icon: 'psychology' },
  { key: 'cleanup',    label: 'Cleanup Controls',  icon: 'cleaning_services' },
  { key: 'guardian',   label: 'Guardian',           icon: 'shield' },
]

// ── Styles (inline — dark theme, no portal CSS vars) ───────────────────

const colors = {
  bg:        '#0a0e17',
  bgCard:    '#111827',
  bgHover:   '#1a2236',
  border:    '#1e293b',
  text:      '#e2e8f0',
  textMuted: '#94a3b8',
  teal:      SYNERGY_TEAL,
  tealGlow:  'rgba(20,184,166,0.15)',
}

// ── Tab content renderer ───────────────────────────────────────────────

function TabContent({ tabKey }: { tabKey: TabKey }) {
  switch (tabKey) {
    case 'dashboard':
      return <DashboardView />
    case 'sessions':
      return <SessionBrowserView />
    case 'knowledge':
      return <KnowledgePipelineView />
    case 'cleanup':
      return <CleanupControlsView />
    case 'guardian':
      return <GuardianView />
  }
}

// ── SystemSynergy ──────────────────────────────────────────────────────

export function SystemSynergy(_props: SystemSynergyProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard')

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.text }}>
      {/* ── Header ── */}
      <div style={{
        padding: '32px 32px 24px',
        borderBottom: `1px solid ${colors.border}`,
        background: 'linear-gradient(135deg, #020b1a 0%, #0a0e17 50%, #050a14 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, letterSpacing: 3,
            textTransform: 'uppercase' as const, color: colors.teal,
          }}>
            SYSTEM SYNERGY
          </span>
        </div>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 800, margin: 0, marginBottom: 6,
          background: `linear-gradient(135deg, ${colors.teal} 0%, #06b6d4 60%, ${colors.teal} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          System Synergy
        </h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: 0 }}>
          Platform health — sessions, knowledge pipeline, deploy status, and hook audit
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: `1px solid ${colors.border}`,
        background: colors.bg, overflowX: 'auto', padding: '0 24px',
      }}>
        {TABS.map(tab => {
          const isActive = tab.key === activeTab
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 18px', border: 'none',
                borderBottom: `2px solid ${isActive ? colors.teal : 'transparent'}`,
                background: isActive ? colors.tealGlow : 'transparent',
                color: isActive ? colors.teal : colors.textMuted,
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap' as const, transition: 'all 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ padding: '24px 24px 48px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{
          background: colors.bgCard, border: `1px solid ${colors.border}`,
          borderRadius: 12, minHeight: 300,
        }}>
          <TabContent tabKey={activeTab} />
        </div>
      </div>
    </div>
  )
}
