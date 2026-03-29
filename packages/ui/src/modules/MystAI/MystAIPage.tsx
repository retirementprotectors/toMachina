/**
 * MystAIPage — Full MYST.AI Technology Team page.
 *
 * Renders a branded header, responsive grid of 6 AI bot bio cards,
 * and handles navigation to individual bio detail pages.
 *
 * Acceptance Criteria (TRK-14110):
 *   - Page renders all 6 bots with avatars, names, titles
 *   - Responsive grid: 3 cols desktop, 2 cols tablet, 1 col mobile
 *   - Click-through navigation to individual bio pages
 *
 * Built by RONIN — Sprint 008 DOJO (TRK-14110)
 */

'use client'

import React, { useCallback, useState } from 'react'
import { MystAIBioCard } from './MystAIBioCard'
import type { AiBotCharacter, AiBotName } from './MystAIBioCard'
import { MystAIBioPage } from './MystAIBioPage'

// ── Props ──────────────────────────────────────────────────────────────

export interface MystAIPageProps {
  /** Portal key for multi-portal theming */
  portal?: string
  className?: string
}

// ── Bot Roster ─────────────────────────────────────────────────────────
// Complete character data for the grid view — matches myst-ai-data.ts

const BOT_ROSTER: AiBotCharacter[] = [
  {
    name: 'VOLTRON',
    title: 'The BFF',
    signatureLine: 'Let me help.',
    icon: '🔋',
    accentColor: '#3b82f6',
  },
  {
    name: 'SENSEI',
    title: 'Patient Teacher',
    signatureLine: 'Let me show you.',
    icon: '🔥',
    accentColor: '#f59e0b',
  },
  {
    name: 'RAIDEN',
    title: 'The Guardian',
    signatureLine: 'Not on my watch.',
    icon: '⚡',
    accentColor: '#ef4444',
  },
  {
    name: 'RONIN',
    title: 'The Builder',
    signatureLine: 'Ship it tonight.',
    icon: '🏃',
    accentColor: '#f97316',
  },
  {
    name: 'MUSASHI',
    title: 'Art × Blade',
    signatureLine: "Let's make it beautiful.",
    icon: '⚒',
    accentColor: '#d4a44c',
  },
  {
    name: '2HINOBI',
    title: 'The Architect',
    signatureLine: 'I feed it straight.',
    icon: '⌨',
    accentColor: '#22c55e',
  },
]

// ── Design Tokens ──────────────────────────────────────────────────────

const colors = {
  bgPrimary: '#0f1117',
  bgCard: '#1a1d27',
  textPrimary: '#f0f0f0',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  borderColor: '#2d3348',
  brandAccent: '#7ba8d4',
} as const

// ── Static Styles ──────────────────────────────────────────────────────

const pageContainerStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 1200,
  margin: '0 auto',
  padding: '2rem 1.5rem 4rem',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  color: colors.textPrimary,
}

const headerContainerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '3rem',
}

const brandLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.18em',
  color: colors.brandAccent,
  marginBottom: '0.5rem',
}

const pageTitleStyle: React.CSSProperties = {
  fontSize: '2.25rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  margin: '0 0 0.5rem',
  color: colors.textPrimary,
}

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: colors.textSecondary,
  maxWidth: 560,
  margin: '0 auto',
  lineHeight: 1.6,
}

const dividerStyle: React.CSSProperties = {
  width: 60,
  height: 2,
  background: `linear-gradient(90deg, transparent, ${colors.brandAccent}, transparent)`,
  margin: '1.5rem auto 0',
  border: 'none',
}

// ── Responsive Grid ────────────────────────────────────────────────────
// CSS-in-JS can't do @media, so we use auto-fill with minmax for
// responsive columns: ≈3 cols desktop, 2 tablet, 1 mobile.

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: '1.75rem',
}

// ── Component ──────────────────────────────────────────────────────────

export const MystAIPage: React.FC<MystAIPageProps> = ({ className }) => {
  const [selectedBot, setSelectedBot] = useState<AiBotName | null>(null)

  const handleBotSelect = useCallback((name: AiBotName) => {
    setSelectedBot(name)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedBot(null)
  }, [])

  // ── Bio Detail View ────────────────────────────────────────────────
  if (selectedBot) {
    return <MystAIBioPage botName={selectedBot} onBack={handleBack} />
  }

  // ── Team Grid View ─────────────────────────────────────────────────
  return (
    <div className={className ?? undefined} style={pageContainerStyle}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header style={headerContainerStyle}>
        <div style={brandLabelStyle}>MYST.AI</div>
        <h1 style={pageTitleStyle}>Technology Team</h1>
        <p style={pageSubtitleStyle}>
          Six AI personalities, each reflecting a facet of how we build, protect,
          teach, create, and connect. Click any card to learn more.
        </p>
        <hr style={dividerStyle} />
      </header>

      {/* ── Bot Grid ────────────────────────────────────────────────── */}
      <div style={gridStyle}>
        {BOT_ROSTER.map((character) => (
          <MystAIBioCard
            key={character.name}
            character={character}
            onClick={handleBotSelect}
          />
        ))}
      </div>
    </div>
  )
}
