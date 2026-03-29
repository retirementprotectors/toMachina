/**
 * MystAISection — Technology Team section for MYST team pages.
 *
 * Embeddable section that renders the 6 AI bot bio cards in a responsive grid,
 * consistent with human team sections (Leadership, Sales, Service, Support).
 *
 * Updated to consume MystAIBioCard (TRK-14111).
 * Built by RONIN — Sprint 008 DOJO (TRK-14114)
 */

import React from 'react'
import { MystAIBioCard } from './MystAIBioCard'
import type { AiBotCharacter, AiBotName } from './MystAIBioCard'

export type { AiBotName } from './MystAIBioCard'

export interface MystAISectionProps {
  className?: string
  onBotSelect?: (botName: AiBotName) => void
}

// ── Character Data ──────────────────────────────────────────────────
// Matches docs/myst-ai and services/api/src/routes/myst-ai.ts

const BOT_ROSTER: AiBotCharacter[] = [
  {
    name: 'VOLTRON',
    title: 'The BFF',
    signatureLine: 'Let me help.',
    icon: '\u{1F50B}',
    accentColor: '#3b82f6',
  },
  {
    name: 'SENSEI',
    title: 'Patient Teacher',
    signatureLine: 'Let me show you.',
    icon: '\u{1F525}',
    accentColor: '#f59e0b',
  },
  {
    name: 'RAIDEN',
    title: 'The Guardian',
    signatureLine: 'Not on my watch.',
    icon: '\u26A1',
    accentColor: '#ef4444',
  },
  {
    name: 'RONIN',
    title: 'The Builder',
    signatureLine: 'Ship it tonight.',
    icon: '\u{1F3C3}',
    accentColor: '#f97316',
  },
  {
    name: 'MUSASHI',
    title: 'Art \u00D7 Blade',
    signatureLine: "Let's make it beautiful.",
    icon: '\u2692',
    accentColor: '#d4a44c',
  },
  {
    name: '2HINOBI',
    title: 'The Architect',
    signatureLine: 'I feed it straight.',
    icon: '\u2328',
    accentColor: '#22c55e',
  },
]

// ── Styles ──────────────────────────────────────────────────────────

const colors = {
  textMuted: '#6b7280',
} as const

const sectionContainerStyle: React.CSSProperties = {
  width: '100%',
}

const headerStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: colors.textMuted,
  marginBottom: '1.5rem',
  textAlign: 'center',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '1.75rem',
  marginBottom: '1.5rem',
}

// ── Component ───────────────────────────────────────────────────────

export const MystAISection: React.FC<MystAISectionProps> = ({
  className,
  onBotSelect,
}) => {
  return (
    <section className={className ?? undefined} style={sectionContainerStyle}>
      <div style={headerStyle}>
        <h2 style={{ fontSize: 'inherit', fontWeight: 'inherit', margin: 0 }}>
          Technology Team
        </h2>
      </div>
      <div style={gridStyle}>
        {BOT_ROSTER.map((character) => (
          <MystAIBioCard
            key={character.name}
            character={character}
            onClick={onBotSelect ? (name) => onBotSelect(name) : undefined}
          />
        ))}
      </div>
    </section>
  )
}
