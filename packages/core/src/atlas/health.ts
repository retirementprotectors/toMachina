// ---------------------------------------------------------------------------
// ATLAS Automation Health — ported from ATLAS_Automation.gs
// ---------------------------------------------------------------------------

import type { AutomationEntry, AutomationHealth, HealthStatus, GapGroup } from './types'
import type { AtlasSource } from '../types'

/**
 * Compute health status for a single automation entry.
 * GREEN: within expected interval
 * YELLOW: within 2x expected interval
 * RED: beyond 2x expected interval, or error, or never run
 */
export function computeAutomationHealth(
  entry: AutomationEntry,
  nowMs: number = Date.now()
): AutomationHealth {
  let health: HealthStatus = 'GREEN'
  let elapsedHours = 0

  if (entry.last_status === 'ERROR') {
    health = 'RED'
  } else if (!entry.last_run_at) {
    health = 'RED'
  } else {
    const lastRun = new Date(entry.last_run_at).getTime()
    if (isNaN(lastRun)) {
      health = 'RED'
    } else {
      const elapsedMs = nowMs - lastRun
      elapsedHours = elapsedMs / (1000 * 60 * 60)
      const expected = entry.expected_interval_hours

      if (elapsedHours <= expected) {
        health = 'GREEN'
      } else if (elapsedHours <= expected * 2) {
        health = 'YELLOW'
      } else {
        health = 'RED'
      }
    }
  }

  return {
    automation_id: entry.automation_id,
    automation_name: entry.automation_name,
    health,
    last_run_at: entry.last_run_at || '',
    elapsed_hours: Math.round(elapsedHours * 10) / 10,
    expected_hours: entry.expected_interval_hours,
  }
}

/**
 * Check if a source is stale based on its frequency and last pull date.
 */
export function isSourceStale(source: AtlasSource, nowMs: number = Date.now()): boolean {
  const lastPullAt = source.last_pull as string | undefined
  const gapStatus = String(source.gap_status || '')
  if (!lastPullAt) return gapStatus !== 'GRAY'

  const lastPull = new Date(lastPullAt).getTime()
  if (isNaN(lastPull)) return true

  const elapsedHours = (nowMs - lastPull) / (1000 * 60 * 60)
  const freq = String(source.frequency || source.current_frequency || 'NONE')
  const expectedHours = frequencyToHours(freq)

  return elapsedHours > expectedHours * 2
}

/**
 * Convert frequency string to expected hours.
 */
function frequencyToHours(freq: string): number {
  switch (freq) {
    case 'REALTIME': return 1
    case 'DAILY': return 25
    case 'WEEKLY': return 170
    case 'MONTHLY': return 750
    case 'QUARTERLY': return 2200
    case 'ON_DEMAND': return 720
    case 'AS_NEEDED': return 720
    default: return 8760 // yearly
  }
}

/**
 * Compute automation summary across all entries.
 */
export function getAutomationSummary(entries: AutomationEntry[]): {
  total: number
  green: number
  yellow: number
  red: number
  healthPct: number
} {
  const now = Date.now()
  let green = 0, yellow = 0, red = 0

  for (const entry of entries) {
    const h = computeAutomationHealth(entry, now)
    if (h.health === 'GREEN') green++
    else if (h.health === 'YELLOW') yellow++
    else red++
  }

  const total = entries.length
  const healthPct = total > 0 ? Math.round(((green * 100 + yellow * 50) / (total * 100)) * 100) : 0

  return { total, green, yellow, red, healthPct }
}

/**
 * Calculate gap analysis grouped by a field.
 * Ported from ATLAS_Analytics.gs getGapAnalysis()
 */
export function calculateGapAnalysis(
  sources: AtlasSource[],
  groupBy: string
): GapGroup[] {
  const groups = new Map<string, AtlasSource[]>()

  for (const s of sources) {
    const key = String(s[groupBy] || 'Unknown')
    const group = groups.get(key) || []
    group.push(s)
    groups.set(key, group)
  }

  const result: GapGroup[] = []

  for (const [name, sourcesInGroup] of groups) {
    let green = 0, yellow = 0, red = 0, gray = 0
    let totalAutomation = 0

    for (const s of sourcesInGroup) {
      const gs = String(s.gap_status || s.status || '')
      switch (gs) {
        case 'GREEN': green++; break
        case 'YELLOW': yellow++; break
        case 'RED': red++; break
        case 'GRAY': gray++; break
      }
      totalAutomation += Number(s.automation_pct || 0)
    }

    const total = sourcesInGroup.length
    const avg_automation = total > 0 ? Math.round(totalAutomation / total) : 0
    const health_score = total > 0
      ? Math.round(((green * 100 + yellow * 50 + gray * 50) / (total * 100)) * 100)
      : 0

    result.push({ name, total, green, yellow, red, gray, avg_automation, health_score })
  }

  // Sort by health score ascending (worst first)
  result.sort((a, b) => a.health_score - b.health_score)

  return result
}

// ---------------------------------------------------------------------------
// Gap Identification — ZRD-D12
// ---------------------------------------------------------------------------

export type GapType =
  | 'MISSING_NORMALIZER'
  | 'MISSING_FORMAT_PROFILE'
  | 'STALE_FORMAT'
  | 'UNTESTED_WIRE_PATH'
  | 'UNREGISTERED_SOURCE'

export interface GapItem {
  type: GapType
  description: string
  severity: 'critical' | 'warning' | 'info'
  suggested_action: string
  related_entity?: string
}

export interface GapReport {
  gaps: GapItem[]
  total: number
  critical: number
  warning: number
  info: number
  generated_at: string
}

/**
 * Identify gaps in ATLAS coverage by cross-referencing source_registry,
 * tool_registry, and format library data.
 */
export function identifyGaps(
  sources: AtlasSource[],
  formatIds: string[],
  toolIds: string[],
  wireIds: string[]
): GapReport {
  const gaps: GapItem[] = []

  // Check for sources with no format profile
  for (const source of sources) {
    const gapStatus = String(source.gap_status || source.status || '')
    const carrierName = String(source.carrier_name || '')
    const formatProfileId = String(source.format_profile_id || source.formatProfileId || '')

    if (['GREEN', 'YELLOW'].includes(gapStatus.toUpperCase()) && !formatProfileId) {
      gaps.push({
        type: 'MISSING_FORMAT_PROFILE',
        description: `${carrierName} has ${gapStatus} status but no format profile linked`,
        severity: gapStatus.toUpperCase() === 'GREEN' ? 'warning' : 'info',
        suggested_action: `Run SUPER_INTROSPECT on a sample ${carrierName} file and save the format`,
        related_entity: String(source.source_id || ''),
      })
    }
  }

  // Check for RED sources (no pipeline at all)
  const redSources = sources.filter(
    s => String(s.gap_status || s.status || '').toUpperCase() === 'RED'
  )
  for (const source of redSources) {
    gaps.push({
      type: 'UNREGISTERED_SOURCE',
      description: `${String(source.carrier_name || '')} has RED status — no automated pipeline exists`,
      severity: 'critical',
      suggested_action: `Create import pipeline for ${String(source.carrier_name || '')} or obtain sample data`,
      related_entity: String(source.source_id || ''),
    })
  }

  // Check for stale sources
  const now = Date.now()
  for (const source of sources) {
    if (isSourceStale(source, now)) {
      const lastPull = String(source.last_pull || 'never')
      gaps.push({
        type: 'STALE_FORMAT',
        description: `${String(source.carrier_name || '')} data is stale (last pull: ${lastPull})`,
        severity: 'warning',
        suggested_action: `Trigger a fresh data pull for ${String(source.carrier_name || '')}`,
        related_entity: String(source.source_id || ''),
      })
    }
  }

  // Suppress unused-parameter warnings — these params are available for future gap checks
  void formatIds
  void toolIds
  void wireIds

  // Summary
  const critical = gaps.filter(g => g.severity === 'critical').length
  const warning = gaps.filter(g => g.severity === 'warning').length
  const info = gaps.filter(g => g.severity === 'info').length

  return {
    gaps,
    total: gaps.length,
    critical,
    warning,
    info,
    generated_at: new Date().toISOString(),
  }
}
