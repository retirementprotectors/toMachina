// ─── VOLTRON Lion Agent Types — VOL-O01 ─────────────────────────────────────
// Types for CCSDK Lion agents that execute product-domain wires autonomously.
// Each Lion is a product specialist: Medicare, Annuity, Investment,
// Life/Estate, Legacy/LTC.
// ─────────────────────────────────────────────────────────────────────────────

import type { VoltronLionDomain, VoltronRegistryEntry, VoltronWireResult } from './types'

// ── Lion Configuration ─────────────────────────────────────────────────────

/** Firestore specialist_configs entry for a Lion agent. */
export interface LionConfig {
  /** Lion domain (Firestore doc ID = domain) */
  domain: VoltronLionDomain
  /** Display name (e.g., "Medicare Lion") */
  display_name: string
  /** Whether this Lion is accepting work */
  enabled: boolean
  /** QUE wire IDs this Lion owns */
  wire_ids: string[]
  /** Tool IDs this Lion is permitted to call (VOL-H06 — baseline + domain extras) */
  available_tools: string[]
  /** System prompt additions (appended to soul.md + spirit.md base) */
  system_prompt_additions: string
  /** Domain-specific knowledge doc path on MDJ_SERVER */
  knowledge_doc: string
  /** MDJ_SERVER agent process ID (populated at runtime) */
  agent_pid?: string
  /** Last health check timestamp */
  last_heartbeat?: string
  /** Created timestamp */
  created_at: string
  /** Updated timestamp */
  updated_at: string
}

// ── Lion Wire Result ───────────────────────────────────────────────────────

/** Extended wire result with Lion attribution. */
export interface LionWireResult extends VoltronWireResult {
  /** Which Lion domain executed this wire */
  lion_domain: VoltronLionDomain
  /** Agent ID on MDJ_SERVER */
  agent_id?: string
}

// ── Lion Registry ──────────────────────────────────────────────────────────

/** Maps domain → list of registry entries that Lion owns. */
export type LionToolMap = Record<VoltronLionDomain, VoltronRegistryEntry[]>

/** Domain classification keywords for auto-tagging registry entries. */
export const LION_DOMAIN_KEYWORDS: Record<VoltronLionDomain, string[]> = {
  medicare: [
    'medicare', 'mapd', 'supplement', 'medigap', 'part_d', 'part_b', 'part_a',
    'aep', 'oep', 'sep', 't65', 'irmaa', 'humana', 'aetna', 'cms', 'coverage_gap',
  ],
  annuity: [
    'annuity', 'fia', 'myga', 'spia', 'dia', 'income_rider', 'gmib', 'surrender',
    'rollup', 'mva', 'bonus', 'accumulation', '1035', 'income_now', 'income_later',
    'growth_max', 'illustration', 'projection',
  ],
  investment: [
    'investment', 'ria', 'broker_dealer', 'rmd', 'roth', 'tax_harvest', 'portfolio',
    'schwab', 'rbc', 'gradient', 'mutual_fund', 'etf', 'growth_max', 'lot_selection',
    'breakeven', 'ltcg',
  ],
  'life-estate': [
    'life_insurance', 'life_estate', 'estate', 'beneficiary', 'death_benefit',
    'cash_value', 'term_life', 'whole_life', 'iul', 'ul', 'estate_max',
    'income_multiplier', 'net_outlay', 'college_funding',
  ],
  'legacy-ltc': [
    'ltc', 'long_term_care', 'legacy', 'hybrid_ltc', 'ltc_max', 'ltc_phase',
    'aprille', 'trupiano', 'care_planning',
  ],
  general: [
    'general', 'federal_tax', 'state_tax', 'household', 'delta', 'effective_tax',
    'ss_taxation', 'provisional_income', 'review_meeting', 'assemble',
  ],
}

/** Classify a registry entry into a Lion domain based on tool_id + description keywords. */
export function classifyLionDomain(entry: VoltronRegistryEntry): VoltronLionDomain {
  // If already tagged, return existing domain
  if (entry.domain) return entry.domain

  const searchText = `${entry.tool_id} ${entry.name} ${entry.description}`.toLowerCase()

  // Score each domain by keyword matches (skip 'general' — it's the fallback)
  let bestDomain: VoltronLionDomain = 'general'
  let bestScore = 0

  for (const [domain, keywords] of Object.entries(LION_DOMAIN_KEYWORDS)) {
    if (domain === 'general') continue
    const score = keywords.reduce((acc, kw) => acc + (searchText.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestDomain = domain as VoltronLionDomain
    }
  }

  return bestDomain
}

/** Build a LionToolMap from a flat registry array. */
export function buildLionToolMap(entries: VoltronRegistryEntry[]): LionToolMap {
  const map: LionToolMap = {
    medicare: [],
    annuity: [],
    investment: [],
    'life-estate': [],
    'legacy-ltc': [],
    general: [],
  }

  for (const entry of entries) {
    const domain = classifyLionDomain(entry)
    map[domain].push(entry)
  }

  return map
}

/** Get all Lion domains (excluding 'general'). */
export const LION_DOMAINS: VoltronLionDomain[] = [
  'medicare', 'annuity', 'investment', 'life-estate', 'legacy-ltc',
]

/** Human-readable labels for each Lion. */
export const LION_LABELS: Record<VoltronLionDomain, string> = {
  medicare: 'Medicare Lion',
  annuity: 'Annuity Lion',
  investment: 'Investment Lion',
  'life-estate': 'Life & Estate Lion',
  'legacy-ltc': 'Legacy/LTC Lion',
  general: 'General',
}

/** Brand colors for each Lion domain. */
export const LION_COLORS: Record<VoltronLionDomain, string> = {
  medicare: '#3b82f6',
  annuity: '#d4a44c',
  investment: '#06b6d4',
  'life-estate': '#22c55e',
  'legacy-ltc': '#a855f7',
  general: '#94a3b8',
}
