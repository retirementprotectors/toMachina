/**
 * MystAIBioCard — Circular avatar + name + title + signature quote card.
 *
 * Reusable bio card for the MYST.AI Technology Team grid and anywhere
 * an individual bot identity needs to be rendered.
 *
 * Features:
 *   - Circular avatar with image support + icon/initials fallback
 *   - Hover: scale transform + glow matching bot accent color
 *   - Click/keyboard navigation via onClick callback
 *
 * Built by RONIN — Sprint 008 DOJO (TRK-14111)
 */

import React from 'react'
import type { AiBotName } from '@tomachina/core'

export type { AiBotName }

// ── Component-local character shape (includes UI-specific fields) ────
// Uses AiBotName from @tomachina/core for the name discriminant.

export interface AiBotCharacter {
  name: AiBotName
  title: string
  signatureLine: string
  /** URL for circular avatar image. Falls back to icon or initials. */
  avatarUrl?: string
  /** Emoji icon shown when no avatarUrl is provided. */
  icon?: string
  /** Material icon name (e.g. 'precision_manufacturing'). Takes priority over emoji icon. */
  materialIcon?: string
  /** Accent color for border, glow, and hover effects. */
  accentColor: string
}

export interface MystAIBioCardProps {
  character: AiBotCharacter
  onClick?: (name: AiBotName) => void
}

// ── Design Tokens ──────────────────────────────────────────────────
// Inline for portability — mirrors MystAISection / MystAIBioPage tokens.

const colors = {
  bgPrimary: '#0f1117',
  bgCard: '#1a1d27',
  bgCardHover: '#222633',
  textPrimary: '#f0f0f0',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  borderColor: '#2d3348',
} as const

// ── Static Styles ──────────────────────────────────────────────────

const cardBaseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  padding: '1.75rem 1rem',
  borderRadius: 16,
  background: colors.bgCard,
  border: `1px solid ${colors.borderColor}`,
  cursor: 'pointer',
  transition:
    'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
}

const avatarBaseStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '2rem',
  fontWeight: 700,
  color: '#fff',
  marginBottom: '1rem',
  overflow: 'hidden',
  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
}

const nameStyle: React.CSSProperties = {
  fontSize: '1.15rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  marginBottom: '0.15rem',
  color: colors.textPrimary,
}

const titleStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: colors.textSecondary,
  marginBottom: '0.75rem',
}

const quoteStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: colors.textMuted,
  fontStyle: 'italic',
  lineHeight: 1.4,
  maxWidth: 220,
}

const avatarImgStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: '50%',
}

// ── Helpers ────────────────────────────────────────────────────────

/** Derive initials from bot name for the no-icon fallback. */
function getInitials(name: string): string {
  // Handle "2HINOBI" → "2H", others → first 2 chars
  return name.slice(0, 2)
}

// ── Component ──────────────────────────────────────────────────────

export const MystAIBioCard: React.FC<MystAIBioCardProps> = ({
  character,
  onClick,
}) => {
  const [hovered, setHovered] = React.useState(false)
  const { name, title, signatureLine, avatarUrl, icon, materialIcon, accentColor } = character

  // ── Dynamic avatar style ──────────────────────────────────────
  const avatarStyle: React.CSSProperties = {
    ...avatarBaseStyle,
    border: `3px solid ${accentColor}`,
    background: `color-mix(in srgb, ${accentColor} 15%, ${colors.bgPrimary})`,
    boxShadow: hovered
      ? `0 0 16px color-mix(in srgb, ${accentColor} 40%, transparent)`
      : 'none',
  }

  // ── Dynamic card style ────────────────────────────────────────
  const cardStyle: React.CSSProperties = {
    ...cardBaseStyle,
    borderColor: hovered ? accentColor : colors.borderColor,
    transform: hovered ? 'translateY(-4px) scale(1.02)' : 'none',
    boxShadow: hovered
      ? `0 8px 32px rgba(0,0,0,0.4), 0 0 20px color-mix(in srgb, ${accentColor} 25%, transparent)`
      : 'none',
  }

  // ── Avatar content: image → materialIcon → emoji icon → initials ──
  let avatarContent: React.ReactNode
  if (avatarUrl) {
    avatarContent = (
      <img src={avatarUrl} alt={`${name} avatar`} style={avatarImgStyle} />
    )
  } else if (materialIcon) {
    avatarContent = (
      <span className="material-icons-outlined" style={{ fontSize: '2.5rem', color: accentColor }}>{materialIcon}</span>
    )
  } else if (icon) {
    avatarContent = icon
  } else {
    avatarContent = getInitials(name)
  }

  const handleClick = () => onClick?.(name)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(name)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div style={avatarStyle}>{avatarContent}</div>
      <div style={nameStyle}>{name}</div>
      <div style={titleStyle}>{title}</div>
      <div style={quoteStyle}>&ldquo;{signatureLine}&rdquo;</div>
    </div>
  )
}
