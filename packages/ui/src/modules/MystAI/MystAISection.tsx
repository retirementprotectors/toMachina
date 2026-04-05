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

interface BotTier {
  label: string
  bots: AiBotCharacter[]
}

const BOT_TIERS: BotTier[] = [
  {
    label: "JDM's Ninja Advisors",
    bots: [
      { name: 'SHINOB1', title: 'The OG Ninja', signatureLine: "I'll architect it.", icon: '\u{1F4A9}', accentColor: '#a78bfa' },
      { name: '2HINOBI', title: 'The Architect', signatureLine: 'I feed it straight.', icon: '\u{1F4A9}', accentColor: '#22c55e' },
      { name: 'MUSASHI', title: 'Art × Blade', signatureLine: "Let's make it beautiful.", icon: '\u{1F4A9}', accentColor: '#d4a44c' },
    ],
  },
  {
    label: 'The Autonomous Builders',
    bots: [
      { name: 'RONIN', title: 'The Builder', signatureLine: 'Ship it tonight.', icon: '\u{1F4A9}', accentColor: '#f97316' },
      { name: 'RAIDEN', title: 'The Guardian', signatureLine: 'Not on my watch.', icon: '\u{1F4A9}', accentColor: '#ef4444' },
    ],
  },
  {
    label: 'Your Ninja Warriors',
    bots: [
      { name: 'SENSEI', title: 'Patient Teacher', signatureLine: 'Let me show you.', icon: '\u{1F4A9}', accentColor: '#f59e0b' },
      { name: 'VOLTRON', title: 'The BFF', signatureLine: 'Let me help.', icon: '\u{1F4A9}', accentColor: '#3b82f6' },
    ],
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

const tierLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#7ba8d4',
  marginBottom: '1rem',
  paddingBottom: '0.4rem',
  borderBottom: '1px solid #2d3348',
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
      {BOT_TIERS.map((tier) => (
        <div key={tier.label} style={{ marginBottom: '1.5rem' }}>
          <div style={tierLabelStyle}>{tier.label}</div>
          <div style={gridStyle}>
            {tier.bots.map((character) => (
              <MystAIBioCard
                key={character.name}
                character={character}
                onClick={onBotSelect ? (name) => onBotSelect(name) : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
