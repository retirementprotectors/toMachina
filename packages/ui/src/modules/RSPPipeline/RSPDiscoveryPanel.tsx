'use client'

/**
 * RSPDiscoveryPanel — TRK-RSP-005
 * Main panel for the RSP Discovery Meeting stage (Orange → Blue).
 * Contains tabs for: Overview, Client Profile, Account Review, Auth Status.
 * Supports virtual + F2F toggle for different meeting flows.
 */

import { useState } from 'react'

interface RSPDiscoveryPanelProps {
  instanceId: string
  clientId: string
  meetingMode?: 'virtual' | 'f2f'
}

export function RSPDiscoveryPanel({ instanceId, clientId, meetingMode = 'virtual' }: RSPDiscoveryPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'profile' | 'accounts' | 'auth'>('overview')
  const [mode, setMode] = useState(meetingMode)

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: 'dashboard' },
    { key: 'profile' as const, label: 'Client Profile', icon: 'person' },
    { key: 'accounts' as const, label: 'Account Review', icon: 'account_balance' },
    { key: 'auth' as const, label: 'Auth Status', icon: 'verified_user' },
  ]

  return (
    <div className="space-y-4">
      {/* Meeting Mode Toggle */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]">
        <span className="material-symbols-outlined text-[var(--portal)]">
          {mode === 'virtual' ? 'videocam' : 'groups'}
        </span>
        <span className="text-sm font-medium">Meeting Mode:</span>
        <button
          onClick={() => setMode('virtual')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            mode === 'virtual'
              ? 'bg-[var(--portal)] text-white'
              : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
          }`}
        >
          Virtual
        </button>
        <button
          onClick={() => setMode('f2f')}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            mode === 'f2f'
              ? 'bg-[var(--portal)] text-white'
              : 'bg-[var(--bg-hover)] text-[var(--text-muted)]'
          }`}
        >
          F2F
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[var(--portal)] text-[var(--portal)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <span className="material-symbols-outlined text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'overview' && (
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <h3 className="text-lg font-semibold mb-2">Discovery Meeting Overview</h3>
            <p className="text-sm text-[var(--text-muted)]">
              {mode === 'virtual'
                ? 'Virtual discovery session — screen share enabled, documents shared via portal.'
                : 'Face-to-face discovery session — F2F Kit will be generated with print materials.'}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 rounded bg-[var(--bg-hover)]">
                <div className="text-xs text-[var(--text-muted)]">Instance</div>
                <div className="text-sm font-mono">{instanceId}</div>
              </div>
              <div className="p-3 rounded bg-[var(--bg-hover)]">
                <div className="text-xs text-[var(--text-muted)]">Client</div>
                <div className="text-sm font-mono">{clientId}</div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'profile' && (
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Client Profile component loads here (RSPClientProfile).</p>
          </div>
        )}
        {activeTab === 'accounts' && (
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Account Review component loads here (RSPAccountReview).</p>
          </div>
        )}
        {activeTab === 'auth' && (
          <div className="p-4 rounded-lg bg-[var(--card)] border border-[var(--border)]">
            <p className="text-sm text-[var(--text-muted)]">Auth Status component loads here (RSPAuthStatus).</p>
          </div>
        )}
      </div>
    </div>
  )
}

export type { RSPDiscoveryPanelProps }
