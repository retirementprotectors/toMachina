/**
 * Brand Guide Registry (MUS-D11)
 *
 * Queryable brand rules: colors, fonts, logo rules, tone per channel,
 * prohibited patterns. Every Artisan output is validated against this.
 *
 * Pure data module — no runtime mutation, no MCP calls.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoBrandGuide } from '../types'

/** The RPI Brand Guide — singleton, immutable */
export const CMO_BRAND_GUIDE: CmoBrandGuide = {
  approvedColors: [
    '#4a7ab5', // RPI Blue
    '#d4a44c', // Gold
    '#0a0e17', // Dark BG
    '#22c55e', // Green accent
    '#06b6d4', // Cyan accent
    '#ffffff', // White
    '#f0f0f0', // Light gray
    '#111827', // Card BG
    '#1e293b', // Border
    '#e2e8f0', // Text primary
    '#94a3b8', // Text muted
  ],
  prohibitedColors: [
    '#ff0000', // Pure red (use brand accents)
    '#00ff00', // Pure green (use #22c55e)
    '#0000ff', // Pure blue (use #4a7ab5)
  ],
  approvedFonts: [
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'system-ui',
    'Helvetica Neue', // Print
    'Arial',
    'sans-serif',
  ],
  logoRules: 'Use only assets from packages/ui/src/logos/ — no generated SVGs. If a logo does not exist yet, use a text label. Never generate visual marks.',
  toneByChannel: {
    b2c: 'Warm, reassuring, plain language. No jargon. "We\'re Your People."',
    b2b: 'Professional, direct, capability-focused. No fluff.',
    b2e: 'Collegial, efficient, team-oriented.',
  },
  prohibitedPatterns: [
    'generated logo SVGs',
    'inline hex color styles',
    'lorem ipsum copy',
    'placeholder text',
    'stock photo watermarks',
  ],
  version: '1.0.0',
}

/**
 * Check if a hex color is in the approved palette.
 * Case-insensitive comparison.
 */
export function isApprovedColor(hex: string): boolean {
  const normalized = hex.toLowerCase().trim()
  return CMO_BRAND_GUIDE.approvedColors.some((c) => c.toLowerCase() === normalized)
}

/**
 * Get the tone guide for a specific channel.
 */
export function getToneForChannel(channel: 'b2c' | 'b2b' | 'b2e'): string {
  return CMO_BRAND_GUIDE.toneByChannel[channel]
}

/**
 * Get the logo usage rule.
 */
export function getLogoRule(): string {
  return CMO_BRAND_GUIDE.logoRules
}
