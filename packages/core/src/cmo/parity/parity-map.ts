/**
 * Parity Map Generator (MUS-D05)
 *
 * Cross-references print inventory against digital assets.
 * Generates CmoParityGap[] showing what's missing per print asset.
 *
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoInventoryEntry, CmoParityGap, CmoDigitalParityItem } from '../types'

/** Priority order for sorting */
const PRIORITY_ORDER: Record<CmoParityGap['priority'], number> = {
  high: 0,
  medium: 1,
  low: 2,
  backlog: 3,
}

/** AEP / B2B keywords that elevate priority */
const HIGH_PRIORITY_KEYWORDS = [
  'aep', 'medicare', 'mapd', 't65',
  'david', 'partner', 'partnership', 'b2b',
]

const MEDIUM_PRIORITY_KEYWORDS = [
  'fia', 'myga', 'annuity', 'life insurance', 'advisory',
  'brand overview', 'rpi',
]

/** Normalize a name for fuzzy matching */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Check if a digital asset matches a print asset by normalized name */
function isDigitalMatch(printName: string, digitalEntry: CmoInventoryEntry): boolean {
  const pNorm = normalizeName(printName)
  const dNorm = normalizeName(digitalEntry.notes || '')

  // Direct substring match
  if (dNorm.includes(pNorm) || pNorm.includes(dNorm)) return true

  // Key word overlap (at least 2 significant words match)
  const pWords = pNorm.split(' ').filter((w) => w.length > 2)
  const dWords = dNorm.split(' ').filter((w) => w.length > 2)
  const overlap = pWords.filter((w) => dWords.includes(w))
  return overlap.length >= 2
}

/** Determine priority based on asset name and market */
function determinePriority(name: string, market: string): CmoParityGap['priority'] {
  const lower = (name + ' ' + market).toLowerCase()

  if (HIGH_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw))) return 'high'
  if (MEDIUM_PRIORITY_KEYWORDS.some((kw) => lower.includes(kw))) return 'medium'

  // Known supplemental types
  const supplemental = ['checklist', 'worksheet', 'internal', 'training']
  if (supplemental.some((kw) => lower.includes(kw))) return 'low'

  return 'backlog'
}

/**
 * Generate a parity map from combined inventory.
 * Returns only entries with at least one missing digital item, sorted by priority.
 */
export function generateParityMap(inventory: CmoInventoryEntry[]): CmoParityGap[] {
  // Separate print vs digital assets
  const printAssets = inventory.filter(
    (e) => e.channel === 'print' || (e.source === 'drive' && e.type === 'brochure'),
  )
  const digitalAssets = inventory.filter(
    (e) => e.source !== 'drive' || e.channel !== 'print',
  )

  const gaps: CmoParityGap[] = []

  for (const print of printAssets) {
    const printName = print.notes || print.id

    // Check each digital format
    const digitalTypes: CmoDigitalParityItem['type'][] = [
      'email-sequence',
      'landing-page',
      'portal-content',
    ]

    const missingDigital: CmoDigitalParityItem[] = []

    for (const digitalType of digitalTypes) {
      // Find matching digital assets
      const matchingSource = digitalType === 'email-sequence' ? 'c3'
        : digitalType === 'landing-page' ? 'wordpress'
        : 'canva'

      const hasMatch = digitalAssets.some(
        (d) => d.source === matchingSource && isDigitalMatch(printName, d),
      )

      if (!hasMatch) {
        missingDigital.push({
          type: digitalType,
          status: 'missing',
        })
      }
    }

    if (missingDigital.length > 0) {
      gaps.push({
        printAssetId: print.id,
        printAssetName: printName,
        printAssetType: print.type,
        missingDigital,
        priority: determinePriority(printName, print.market),
        marketRelevance: [print.market],
      })
    }
  }

  // Sort by priority
  gaps.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  return gaps
}
