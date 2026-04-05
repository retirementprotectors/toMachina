/**
 * MystAIBioPage — Full biography detail page for a single MYST.AI bot.
 *
 * Sections: header (avatar + name + title), about (traits + voice guide),
 * voice sample, fun facts, and "Talk to me" action footer.
 *
 * Built by RONIN — Sprint 008 DOJO (TRK-14112)
 */

import React from 'react'
import type { AiBotName, AiBotCharacter } from './myst-ai-data'
import { getCharacterByName } from './myst-ai-data'

// ── Bio-specific metadata (extends base AiBotProfile) ───────────────

interface BotBioMeta {
  icon: string
  color: string
  voiceSample: string
  talkLink: string
  isLive: boolean
}

const BIO_META: Record<AiBotName, BotBioMeta> = {
  VOLTRON: {
    icon: '\u{1F4A9}',
    color: '#3b82f6',
    voiceSample:
      "Hey! No such thing as a dumb question \u2014 I mean it. You want to know how the intake form works? Let me walk you through it step by step. And if you forget tomorrow, just ask me again. I'll be right here.",
    talkLink: '/mdj',
    isLive: false,
  },
  SENSEI: {
    icon: '\u{1F4A9}',
    color: '#f59e0b',
    voiceSample:
      "Let's take this one piece at a time. See that button on the top right? That's your intake form. Click it, and I'll walk you through each field. Don't worry about getting it perfect the first time \u2014 that's what I'm here for. We'll practice until it feels natural.",
    talkLink: '/training',
    isLive: false,
  },
  RAIDEN: {
    icon: '\u{1F4A9}',
    color: '#ef4444',
    voiceSample:
      "Stop. That ticket already exists \u2014 TRK-4092, filed two weeks ago. Here's the link. And while I'm at it, the three you just created? Two are duplicates and one belongs to a different sprint. I've already reassigned them. You're welcome.",
    talkLink: '/guardian',
    isLive: false,
  },
  RONIN: {
    icon: '\u{1F4A9}',
    color: '#f97316',
    voiceSample:
      "Ticket says build it. Plan says how. I say when \u2014 and the answer is now. Three files changed, zero warnings, tests green. Moving to the next one. You'll see the PR in the morning.",
    talkLink: '/forge',
    isLive: false,
  },
  MUSASHI: {
    icon: '\u{1F4A9}',
    color: '#d4a44c',
    voiceSample:
      "That hero section? It's fine. But \"fine\" isn't what we do. Give me 20 minutes and I'll make it something they screenshot and send to their friends. Design isn't decoration \u2014 it's the first conversation you have with someone before a single word is spoken.",
    talkLink: '/creative',
    isLive: false,
  },
  '2HINOBI': {
    icon: '\u{1F4A9}',
    color: '#22c55e',
    voiceSample:
      "You've got six bots running right now. RONIN just shipped a sprint, RAIDEN caught a duplicate ticket, and VOLTRON handled three client questions while you were in that meeting. Everything's green. Go home.",
    talkLink: '/architect',
    isLive: false,
  },
  SHINOB1: {
    icon: '\u{1F4A9}',
    color: '#a78bfa',
    voiceSample:
      "Found the bug. One-line fix in three files. PR is up, build is green, auto-merge set. Moving to the next fire. You'll see seven PRs merged by the time you wake up.",
    talkLink: '/dojo',
    isLive: false,
  },
}

// ── Design Tokens ───────────────────────────────────────────────────

const colors = {
  bgPrimary: '#0f1117',
  bgCard: '#1a1d27',
  textPrimary: '#f0f0f0',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  borderColor: '#2d3348',
} as const

// ── Props ───────────────────────────────────────────────────────────

export interface MystAIBioPageProps {
  /** Bot name key (case-insensitive). Renders not-found state if invalid. */
  botName: string
  /** Callback when user clicks "Back to Team" */
  onBack?: () => void
}

// ── Styles ──────────────────────────────────────────────────────────

const wrapperStyle: React.CSSProperties = {
  maxWidth: 700,
  margin: '0 auto',
  padding: '2rem 1.5rem 4rem',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  color: colors.textPrimary,
  lineHeight: 1.6,
}

const backLinkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.85rem',
  color: colors.textSecondary,
  marginBottom: '2rem',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  padding: 0,
  fontFamily: 'inherit',
}

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '2.5rem',
}

const bioNameStyle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  margin: 0,
}

const bioTitleStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: colors.textSecondary,
  marginTop: '0.25rem',
}

const bioQuoteStyle: React.CSSProperties = {
  fontSize: '1rem',
  color: colors.textMuted,
  fontStyle: 'italic',
  marginTop: '0.75rem',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '2rem',
}

const sectionHeadingBaseStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: '0.75rem',
  paddingBottom: '0.5rem',
  fontWeight: 600,
}

const sectionTextStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  color: colors.textSecondary,
  lineHeight: 1.7,
  margin: 0,
}

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
}

const voiceSampleBoxStyle: React.CSSProperties = {
  background: colors.bgCard,
  border: `1px solid ${colors.borderColor}`,
  borderRadius: 12,
  padding: '1.25rem 1.5rem',
  fontStyle: 'italic',
  color: colors.textSecondary,
  lineHeight: 1.7,
}

const ctaBtnBaseStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.85rem 2rem',
  borderRadius: 10,
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  marginTop: '0.5rem',
  fontFamily: 'inherit',
  transition: 'opacity 0.2s ease, transform 0.2s ease',
}

const comingSoonBtnStyle: React.CSSProperties = {
  ...ctaBtnBaseStyle,
  background: colors.bgCard,
  border: `1px solid ${colors.borderColor}`,
  color: colors.textMuted,
  cursor: 'default',
}

const notFoundStyle: React.CSSProperties = {
  ...wrapperStyle,
  textAlign: 'center',
  paddingTop: '4rem',
}

// ── Sub-components ──────────────────────────────────────────────────

function ListItem({
  text,
  dotColor,
}: {
  text: string
  dotColor: string
}) {
  return (
    <li
      style={{
        padding: '0.35rem 0',
        paddingLeft: '1.25rem',
        position: 'relative',
        ...sectionTextStyle,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: 0,
          top: '0.85rem',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          display: 'inline-block',
        }}
      />
      {text}
    </li>
  )
}

function SectionHeading({
  children,
  accentColor,
}: {
  children: React.ReactNode
  accentColor: string
}) {
  return (
    <h2
      style={{
        ...sectionHeadingBaseStyle,
        color: accentColor,
        borderBottom: `1px solid ${colors.borderColor}`,
      }}
    >
      {children}
    </h2>
  )
}

// ── Main Component ──────────────────────────────────────────────────

export const MystAIBioPage: React.FC<MystAIBioPageProps> = ({
  botName,
  onBack,
}) => {
  const profile: AiBotCharacter | undefined = getCharacterByName(botName)
  const meta: BotBioMeta | undefined =
    BIO_META[botName.toUpperCase() as AiBotName]

  // ── Not found state ─────────────────────────────────────────────
  if (!profile || !meta) {
    return (
      <div style={notFoundStyle}>
        <p style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
          Bot &ldquo;{botName}&rdquo; not found.
        </p>
        {onBack && (
          <button type="button" style={backLinkStyle} onClick={onBack}>
            &larr; Back to Team
          </button>
        )}
      </div>
    )
  }

  const { color } = meta

  // ── Avatar styles ───────────────────────────────────────────────
  const avatarStyle: React.CSSProperties = {
    width: 140,
    height: 140,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '3.25rem',
    fontWeight: 700,
    color: '#fff',
    margin: '0 auto 1.25rem',
    border: `4px solid ${color}`,
    background: `color-mix(in srgb, ${color} 15%, ${colors.bgPrimary})`,
  }

  return (
    <div style={wrapperStyle}>
      {/* ── Back Navigation ──────────────────────────────────────── */}
      {onBack && (
        <button type="button" style={backLinkStyle} onClick={onBack}>
          &larr; Back to Team
        </button>
      )}

      {/* ── Header ───────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <div style={avatarStyle}>{meta.icon}</div>
        <h1 style={bioNameStyle}>{profile.name}</h1>
        <div style={bioTitleStyle}>{profile.title}</div>
        <div style={bioQuoteStyle}>
          &ldquo;{profile.signatureLine}&rdquo;
        </div>
      </header>

      {/* ── About ────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeading accentColor={color}>About</SectionHeading>
        <p style={{ ...sectionTextStyle, marginBottom: '0.75rem' }}>
          <strong>JDM Facet:</strong> {profile.jdmFacet}
        </p>
        <p
          style={{
            ...sectionTextStyle,
            marginBottom: '0.5rem',
            fontWeight: 600,
          }}
        >
          Personality Traits
        </p>
        <ul style={listStyle}>
          {profile.traits.map((trait) => (
            <ListItem key={trait} text={trait} dotColor={color} />
          ))}
        </ul>
      </div>

      {/* ── Voice Guide ──────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeading accentColor={color}>Voice Guide</SectionHeading>
        <ul style={listStyle}>
          <ListItem
            text={`Tone: ${profile.voiceGuide.tone}`}
            dotColor={color}
          />
          <ListItem
            text={`Word Choice: ${profile.voiceGuide.wordChoice.join(', ')}`}
            dotColor={color}
          />
          <ListItem
            text={`Sentence Length: ${profile.voiceGuide.sentenceLength}`}
            dotColor={color}
          />
          <ListItem
            text={`Humor Style: ${profile.voiceGuide.humorStyle}`}
            dotColor={color}
          />
        </ul>
      </div>

      {/* ── Voice Sample ─────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeading accentColor={color}>Voice Sample</SectionHeading>
        <div style={voiceSampleBoxStyle}>
          &ldquo;{meta.voiceSample}&rdquo;
        </div>
      </div>

      {/* ── Fun Facts ────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <SectionHeading accentColor={color}>Fun Facts</SectionHeading>
        <ul style={listStyle}>
          {profile.funFacts.map((fact) => (
            <ListItem key={fact} text={fact} dotColor={color} />
          ))}
        </ul>
      </div>

      {/* ── Action Footer ────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, textAlign: 'center' }}>
        <SectionHeading accentColor={color}>
          Primary Channel
        </SectionHeading>
        <p style={{ ...sectionTextStyle, marginBottom: '1rem' }}>
          {profile.primaryChannel}
        </p>
        {meta.isLive ? (
          <a
            href={meta.talkLink}
            style={{ ...ctaBtnBaseStyle, background: color, textDecoration: 'none' }}
          >
            Talk to me
          </a>
        ) : (
          <button type="button" style={comingSoonBtnStyle} disabled>
            Talk to me — Coming Soon
          </button>
        )}
      </div>
    </div>
  )
}
