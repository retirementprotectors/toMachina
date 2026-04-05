'use client'

import { useState } from 'react'
import { RegistryBrowser } from './RegistryBrowser'
import { WireExecutionLog } from './WireExecutionLog'
import { LionStatusPanel } from './LionStatusPanel'
import { OpenCasesPanel } from './OpenCasesPanel'
import { RunWirePanel } from './RunWirePanel'
import { GapRequestForm } from './GapRequestForm'

// ── Types ──────────────────────────────────────────────────────────────

export interface CommandCenterPageProps {
  portal?: string
}

type TabKey = 'registry' | 'wire-log' | 'open-cases' | 'lion-status' | 'run-wire' | 'gap-requests'

interface Tab {
  key: TabKey
  label: string
  icon: string
  emptyMessage: string
}

// ── Constants ──────────────────────────────────────────────────────────

const VOLTRON_BLUE = '#3b82f6'

const TABS: Tab[] = [
  { key: 'registry', label: 'Registry Browser', icon: 'database', emptyMessage: 'No registry entries loaded yet' },
  { key: 'wire-log', label: 'Wire Log', icon: 'receipt_long', emptyMessage: 'No wires executed yet' },
  { key: 'open-cases', label: 'Open Cases', icon: 'assignment', emptyMessage: 'No open cases' },
  { key: 'run-wire', label: 'Run Wire', icon: 'play_circle', emptyMessage: 'Select a client and wire' },
  { key: 'lion-status', label: 'Lion Status', icon: 'pets', emptyMessage: 'Lion configuration loading...' },
  { key: 'gap-requests', label: 'Gap Requests', icon: 'report', emptyMessage: 'No gap requests' },
]

// ── Styles (inline for dark theme — no portal CSS vars) ────────────────

const colors = {
  bg: '#0a0e17',
  bgCard: '#111827',
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  blue: VOLTRON_BLUE,
  blueGlow: 'rgba(59,130,246,0.15)',
}

// ── EmptyState ─────────────────────────────────────────────────────────

function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '64px 24px', color: colors.textMuted, gap: 16,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.4 }}>{icon}</span>
      <p style={{ fontSize: '0.9rem', margin: 0 }}>{message}</p>
    </div>
  )
}

// ── Tab content renderer ───────────────────────────────────────────────

function TabContent({ tabKey }: { tabKey: TabKey }) {
  switch (tabKey) {
    case 'wire-log':
      return <WireExecutionLog />
    case 'lion-status':
      return <LionStatusPanel />
    case 'open-cases':
      return <OpenCasesPanel />
    case 'run-wire':
      return <RunWirePanel />
    case 'gap-requests':
      return <GapRequestForm />
    case 'registry':
    default:
      return <RegistryBrowser />
  }
}

// ── CommandCenterPage ──────────────────────────────────────────────────

export function CommandCenterPage(_props: CommandCenterPageProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('registry')

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.text }}>
      {/* ── Header ── */}
      <div style={{
        padding: '32px 32px 24px', borderBottom: `1px solid ${colors.border}`,
        background: 'linear-gradient(135deg, #020b1a 0%, #0a0e17 50%, #050a14 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: colors.blue }}>
            VOLTRON — CSO
          </span>
        </div>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 800, margin: 0, marginBottom: 6,
          background: `linear-gradient(135deg, ${colors.blue} 0%, #06b6d4 60%, ${colors.blue} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Command Center
        </h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: 0 }}>
          Operations dashboard — Registry, wires, cases, and Lion status
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
                borderBottom: `2px solid ${isActive ? colors.blue : 'transparent'}`,
                background: isActive ? colors.blueGlow : 'transparent',
                color: isActive ? colors.blue : colors.textMuted,
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
