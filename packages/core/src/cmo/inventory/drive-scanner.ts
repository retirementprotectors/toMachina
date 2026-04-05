/**
 * Drive Asset Inventory Scanner (MUS-D02)
 *
 * Scans the RPI Shared Drive (0AFUXPgL0EWC6Uk9PVA) for creative assets.
 * Categorizes by type, market, and channel.
 *
 * Server-only — do NOT export through client barrel.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoInventoryEntry, CmoDesignStatus, CmoChannel } from '../types'

const DEFAULT_STALE_THRESHOLD_DAYS = 180

/** Files to exclude from inventory */
const EXCLUDED_PATTERNS = [
  /^claude\.md$/i,
  /^readme\.md$/i,
  /testing.guide/i,
  /\.mp3$/i,
  /\.wav$/i,
  /\.m4a$/i,
  /\.aac$/i,
  /^\./, // hidden files
]

function shouldExclude(name: string): boolean {
  return EXCLUDED_PATTERNS.some((p) => p.test(name))
}

function classifyDriveAssetType(
  name: string,
  parentFolder: string,
): CmoInventoryEntry['type'] {
  const lower = name.toLowerCase()
  const folder = parentFolder.toLowerCase()

  if (lower.includes('brochure') || folder.includes('brochure')) return 'brochure'
  if (lower.includes('deck') || lower.includes('presentation') || folder.includes('presentation'))
    return 'presentation'
  if (lower.includes('social') || folder.includes('social')) return 'social'
  if (lower.includes('email') || folder.includes('email')) return 'email'
  if (lower.includes('one-pager') || lower.includes('one pager') || folder.includes('one-pager'))
    return 'one-pager'
  if (lower.includes('video') || folder.includes('video')) return 'video'
  if (lower.includes('guide') || lower.includes('brand') || folder.includes('brand')) return 'guide'
  if (lower.includes('fact-finder') || lower.includes('fact finder')) return 'fact-finder'
  return 'other'
}

function classifyDriveMarket(name: string, parentFolder: string): CmoInventoryEntry['market'] {
  const lower = (name + ' ' + parentFolder).toLowerCase()
  if (lower.includes('david') || lower.includes('partner') || lower.includes('b2b') || lower.includes('sentinel'))
    return 'b2b'
  if (lower.includes('rapid') || lower.includes('internal') || lower.includes('b2e') || lower.includes('riimo'))
    return 'b2e'
  if (lower.includes('rpi') || lower.includes('prodash') || lower.includes('medicare') || lower.includes('client'))
    return 'b2c'
  return 'all'
}

function getDriveChannel(mimeType: string): CmoChannel | undefined {
  if (mimeType === 'application/pdf') return 'print'
  return undefined
}

function getStaleStatus(lastModified: Date, thresholdDays: number): CmoDesignStatus {
  const daysSince = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)
  return daysSince > thresholdDays ? 'stale' : 'current'
}

/**
 * Scan the Shared Drive for creative assets.
 * Returns empty array on MCP error.
 */
export async function scanDriveInventory(options?: {
  staleThresholdDays?: number
}): Promise<CmoInventoryEntry[]> {
  try {
    console.log('[MUSASHI] Drive inventory scan requested')
    // MCP calls dispatched by API layer
    return []
  } catch {
    console.log('[MUSASHI] Drive scanner unavailable, returning empty inventory')
    return []
  }
}

/**
 * Process raw Drive file data into inventory entries.
 * Called by API route after gdrive MCP listFolder responses.
 */
export function processDriveFiles(
  files: Array<{
    id: string
    name: string
    mimeType: string
    modifiedTime?: string
    webViewLink?: string
    parents?: string[]
    parentFolderName?: string
  }>,
  options?: { staleThresholdDays?: number },
): CmoInventoryEntry[] {
  const staleThreshold = options?.staleThresholdDays ?? DEFAULT_STALE_THRESHOLD_DAYS

  return files
    .filter((f) => !shouldExclude(f.name))
    .map((file) => {
      const parentFolder = file.parentFolderName || ''
      const lastModified = new Date(file.modifiedTime || Date.now())

      return {
        id: `drive-${file.id}`,
        source: 'drive' as const,
        type: classifyDriveAssetType(file.name, parentFolder),
        market: classifyDriveMarket(file.name, parentFolder),
        lastModified,
        status: getStaleStatus(lastModified, staleThreshold),
        channel: getDriveChannel(file.mimeType),
        url: file.webViewLink,
        notes: file.name,
      }
    })
}
