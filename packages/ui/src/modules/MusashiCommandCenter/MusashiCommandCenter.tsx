'use client'

import { useState } from 'react'
import { MusashiRegistryView } from './MusashiRegistryView'
import { MusashiPipelineView } from './MusashiPipelineView'
import { MusashiMeshView } from './MusashiMeshView'

// ── Types ──────────────────────────────────────────────────────────────

export interface MusashiCommandCenterProps {
  portal?: string
}

type TabKey = 'registry' | 'pipeline' | 'mesh'

interface Tab {
  key: TabKey
  label: string
  icon: string
}

// ── Constants ──────────────────────────────────────────────────────────

const MUSASHI_GOLD = '#d4a44c'

const TABS: Tab[] = [
  { key: 'registry', label: 'Registry', icon: 'database' },
  { key: 'pipeline', label: 'Pipeline', icon: 'conveyor_belt' },
  { key: 'mesh', label: 'Artisans', icon: 'brush' },
]

const colors = {
  bg: '#0a0e17',
  bgCard: '#111827',
  bgHover: '#1a2236',
  border: '#1e293b',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  gold: MUSASHI_GOLD,
  goldGlow: 'rgba(212,164,76,0.12)',
}

// ── Tab content renderer ───────────────────────────────────────────────

function TabContent({ tabKey }: { tabKey: TabKey }) {
  switch (tabKey) {
    case 'pipeline':
      return <MusashiPipelineView />
    case 'mesh':
      return <MusashiMeshView />
    case 'registry':
    default:
      return <MusashiRegistryView />
  }
}

// ── MusashiCommandCenter ──────────────────────────────────────────────

export function MusashiCommandCenter(_props: MusashiCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('registry')

  return (
    <div style={{ background: colors.bg, minHeight: '100vh', color: colors.text }}>
      {/* ── Header ── */}
      <div style={{
        padding: '32px 32px 24px', borderBottom: `1px solid ${colors.border}`,
        background: 'linear-gradient(135deg, #020b1a 0%, #0a0e17 50%, #050a14 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase' as const, color: colors.gold }}>
            MUSASHI — CMO
          </span>
        </div>
        <h1 style={{
          fontSize: '1.8rem', fontWeight: 800, margin: 0, marginBottom: 6,
          background: `linear-gradient(135deg, ${colors.gold} 0%, #f59e0b 60%, ${colors.gold} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          Command Center
        </h1>
        <p style={{ fontSize: '0.875rem', color: colors.textMuted, margin: 0 }}>
          Creative operations — CMO Registry, Content Pipeline, Artisan Mesh
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
                borderBottom: `2px solid ${isActive ? colors.gold : 'transparent'}`,
                background: isActive ? colors.goldGlow : 'transparent',
                color: isActive ? colors.gold : colors.textMuted,
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
