'use client'

import { useState } from 'react'
import { HealthOverview } from './HealthOverview'
import { WriteGateConsole } from './WriteGateConsole'
import { AuditHistory } from './AuditHistory'
import { AlertFeed } from './AlertFeed'
import { BaselineManager } from './BaselineManager'

/* ─── Styles ─── */
const s = {
  bg: 'var(--bg, #0f1219)',
  surface: 'var(--bg-surface, #1c2333)',
  hover: 'var(--bg-hover, #232b3e)',
  border: 'var(--border-color, #2a3347)',
  text: 'var(--text-primary, #e2e8f0)',
  textSecondary: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  portal: 'var(--portal, #4a7ab5)',
  guardian: '#c8872e',
  guardianLight: '#f5e6cc',
  guardianGlow: 'rgba(200, 135, 46, 0.15)',
}

/* ─── Tabs ─── */
const TABS = [
  { key: 'health', label: 'Health Overview', icon: 'monitor_heart' },
  { key: 'writes', label: 'Write Gate', icon: 'edit_note' },
  { key: 'audits', label: 'Audit History', icon: 'assignment' },
  { key: 'alerts', label: 'Alerts', icon: 'notifications_active' },
  { key: 'baselines', label: 'Baselines', icon: 'inventory_2' },
] as const

type TabKey = typeof TABS[number]['key']

/* ─── Helpers ─── */
function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Component ─── */
export function GuardianView({ portal = 'PRODASHX' }: { portal?: string }) {
  const [activeTab, setActiveTab] = useState<TabKey>('health')

  return (
    <div style={{ padding: 24, minHeight: '100vh', color: s.text }}>
      {/* Page Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: s.guardianGlow,
          border: `1px solid ${s.guardian}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon name="shield" size={22} color={s.guardian} />
        </div>
        <div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: s.guardian,
            margin: 0,
          }}>
            GUARDIAN
          </h1>
          <p style={{ fontSize: 12, color: s.textSecondary, margin: 0 }}>
            Data integrity monitoring &amp; audit workflow
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        gap: 2,
        borderBottom: `1px solid ${s.border}`,
        marginBottom: 20,
        overflowX: 'auto',
      }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 18px',
                background: isActive ? s.guardianGlow : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${s.guardian}` : '2px solid transparent',
                color: isActive ? s.guardian : s.textMuted,
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon name={tab.icon} size={16} color={isActive ? s.guardian : s.textMuted} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'health' && <HealthOverview />}
        {activeTab === 'writes' && <WriteGateConsole />}
        {activeTab === 'audits' && <AuditHistory />}
        {activeTab === 'alerts' && <AlertFeed />}
        {activeTab === 'baselines' && <BaselineManager />}
      </div>
    </div>
  )
}
