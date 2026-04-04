// ── AI Bot Brand Types ──────────────────────────────────────────────
// Shared type definitions for MYST.AI bot profiles and bio pages.
// TRK-14109 — AiBot Brand Types

// ── Name & Tier Unions ──────────────────────────────────────────────

export type AiBotName = 'VOLTRON' | 'SENSEI' | 'RAIDEN' | 'RONIN' | 'MUSASHI' | '2HINOBI' | 'SHINOB1'

export type VoiceTier = 'internal' | 'team' | 'client'

// ── Interfaces ──────────────────────────────────────────────────────

export interface AiBotVoiceGuide {
  tone: string
  wordChoice: string[]
  sentenceLength: 'short' | 'medium' | 'long'
  humorStyle: string
  doGuidelines: string[]
  dontGuidelines: string[]
}

export interface AiBotCharacter {
  name: AiBotName
  title: string
  jdmFacet: string
  signatureLine: string
  traits: string[] // 3-5 personality traits
  voiceGuide: AiBotVoiceGuide
  primaryChannel: string
  funFacts: string[]
  avatarUrl?: string
  signoffEmoji?: string  // Slack emoji code (e.g. ':crossed_swords:')
  signoffIcon?: string   // Material icon name (e.g. 'temple_buddhist')
}

export interface AiBotProfile {
  character: AiBotCharacter
  voiceSamples: Record<string, string> // context -> sample message
  transcriptHighlights: string[]
}

export interface AiBotBioPage {
  profile: AiBotProfile
  fullBio: string
  talkToMeUrl: string
  sectionOrder: string[]
}

// ── Lookup Helper ───────────────────────────────────────────────────

/** Find a bot character by name from a collection. */
export function getAiBotByName(
  bots: AiBotCharacter[],
  name: AiBotName,
): AiBotCharacter | undefined {
  return bots.find((bot) => bot.name === name)
}
