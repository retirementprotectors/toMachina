/**
 * Two-layer carrier identity map: Parent Brand → Underwriting Charters.
 *
 * Each Medicare account is underwritten by a specific legal entity (charter),
 * not by the parent brand. This map enables the normalizer to preserve
 * charter identity instead of flattening everything to the parent.
 *
 * Source: services/api/src/scripts/seed-carriers.ts (Firestore carrier docs)
 * + commission file field analysis (Legal Entity, COMPANYCODE, Company codes)
 */

// ============================================================================
// Types
// ============================================================================

export interface CarrierIdentity {
  /** Marketing parent brand (e.g., "Aetna") */
  parent: string
  /** Underwriting charter / legal entity (e.g., "Accendo Insurance Company") */
  charter: string
  /** Charter short code (e.g., "ACC") */
  charter_code: string
  /** NAIC code if known */
  naic?: number
  /** Carrier doc ID in Firestore */
  carrier_id: string
}

// ============================================================================
// Charter → Identity Map
//
// Keys are LOWERCASE variants of how charter names appear in:
//   - Commission files (Legal Entity, Company, COMPANYCODE fields)
//   - BoB exports (carrier_name, company_name fields)
//   - Policy number prefixes (CLI, AHC, 000M1, etc.)
//   - GHL imports (compound carrier names)
// ============================================================================

export const CHARTER_IDENTITY_MAP: Record<string, CarrierIdentity> = {
  // ── Aetna / CVS Health (7 charters) ──────────────────────────────────────
  'accendo': { parent: 'Aetna', charter: 'Accendo Insurance Company', charter_code: 'ACC', naic: 63444, carrier_id: 'aetna-cvs' },
  'accendo insurance': { parent: 'Aetna', charter: 'Accendo Insurance Company', charter_code: 'ACC', naic: 63444, carrier_id: 'aetna-cvs' },
  'accendo insurance company': { parent: 'Aetna', charter: 'Accendo Insurance Company', charter_code: 'ACC', naic: 63444, carrier_id: 'aetna-cvs' },
  'acc': { parent: 'Aetna', charter: 'Accendo Insurance Company', charter_code: 'ACC', naic: 63444, carrier_id: 'aetna-cvs' },
  '0aacc': { parent: 'Aetna', charter: 'Accendo Insurance Company', charter_code: 'ACC', naic: 63444, carrier_id: 'aetna-cvs' },

  'first health': { parent: 'Aetna', charter: 'First Health Life & Health Insurance Company', charter_code: 'FHLH', naic: 90328, carrier_id: 'aetna-cvs' },
  'first health life': { parent: 'Aetna', charter: 'First Health Life & Health Insurance Company', charter_code: 'FHLH', naic: 90328, carrier_id: 'aetna-cvs' },
  'fhlh': { parent: 'Aetna', charter: 'First Health Life & Health Insurance Company', charter_code: 'FHLH', naic: 90328, carrier_id: 'aetna-cvs' },

  'continental general': { parent: 'Aetna', charter: 'Continental General Insurance Company', charter_code: 'CGI', naic: 71404, carrier_id: 'aetna-cvs' },
  'continental general insurance': { parent: 'Aetna', charter: 'Continental General Insurance Company', charter_code: 'CGI', naic: 71404, carrier_id: 'aetna-cvs' },
  'cgi': { parent: 'Aetna', charter: 'Continental General Insurance Company', charter_code: 'CGI', naic: 71404, carrier_id: 'aetna-cvs' },

  'resource life': { parent: 'Aetna', charter: 'Resource Life Insurance Company', charter_code: 'RLI', naic: 61506, carrier_id: 'aetna-cvs' },
  'resource life insurance': { parent: 'Aetna', charter: 'Resource Life Insurance Company', charter_code: 'RLI', naic: 61506, carrier_id: 'aetna-cvs' },
  'rli': { parent: 'Aetna', charter: 'Resource Life Insurance Company', charter_code: 'RLI', naic: 61506, carrier_id: 'aetna-cvs' },

  'aetna health insurance company': { parent: 'Aetna', charter: 'Aetna Health Insurance Company', charter_code: 'AHIC', carrier_id: 'aetna-cvs' },
  'ahic': { parent: 'Aetna', charter: 'Aetna Health Insurance Company', charter_code: 'AHIC', carrier_id: 'aetna-cvs' },
  'ahc': { parent: 'Aetna', charter: 'Aetna Health Insurance Company', charter_code: 'AHIC', carrier_id: 'aetna-cvs' },
  '0aahc': { parent: 'Aetna', charter: 'Aetna Health Insurance Company', charter_code: 'AHIC', carrier_id: 'aetna-cvs' },

  'aetna health and life': { parent: 'Aetna', charter: 'Aetna Health + Life Insurance Company', charter_code: 'AHLC', carrier_id: 'aetna-cvs' },
  'aetna health life': { parent: 'Aetna', charter: 'Aetna Health + Life Insurance Company', charter_code: 'AHLC', carrier_id: 'aetna-cvs' },
  'aetna health  life insurance company': { parent: 'Aetna', charter: 'Aetna Health + Life Insurance Company', charter_code: 'AHLC', carrier_id: 'aetna-cvs' },
  'ahlc': { parent: 'Aetna', charter: 'Aetna Health + Life Insurance Company', charter_code: 'AHLC', carrier_id: 'aetna-cvs' },
  'ahl': { parent: 'Aetna', charter: 'Aetna Health + Life Insurance Company', charter_code: 'AHLC', carrier_id: 'aetna-cvs' },

  'continental life': { parent: 'Aetna', charter: 'Continental Life Insurance Company', charter_code: 'CLI', carrier_id: 'aetna-cvs' },
  'continental life insurance': { parent: 'Aetna', charter: 'Continental Life Insurance Company', charter_code: 'CLI', carrier_id: 'aetna-cvs' },
  'cli': { parent: 'Aetna', charter: 'Continental Life Insurance Company', charter_code: 'CLI', carrier_id: 'aetna-cvs' },
  'cnhic': { parent: 'Aetna', charter: 'Continental Life Insurance Company', charter_code: 'CLI', carrier_id: 'aetna-cvs' },

  // ── Mutual of Omaha (4 charters) ─────────────────────────────────────────
  'mutual of omaha insurance company': { parent: 'Mutual of Omaha', charter: 'Mutual of Omaha Insurance Company', charter_code: 'MUT', naic: 71412, carrier_id: 'mutual-of-omaha' },
  'mutual': { parent: 'Mutual of Omaha', charter: 'Mutual of Omaha Insurance Company', charter_code: 'MUT', naic: 71412, carrier_id: 'mutual-of-omaha' },
  'mut': { parent: 'Mutual of Omaha', charter: 'Mutual of Omaha Insurance Company', charter_code: 'MUT', naic: 71412, carrier_id: 'mutual-of-omaha' },
  'm1': { parent: 'Mutual of Omaha', charter: 'Mutual of Omaha Insurance Company', charter_code: 'MUT', naic: 71412, carrier_id: 'mutual-of-omaha' },

  'omaha insurance company': { parent: 'Mutual of Omaha', charter: 'Omaha Insurance Company', charter_code: 'OIC', naic: 13100, carrier_id: 'mutual-of-omaha' },
  'omaha ins co': { parent: 'Mutual of Omaha', charter: 'Omaha Insurance Company', charter_code: 'OIC', naic: 13100, carrier_id: 'mutual-of-omaha' },
  'oic': { parent: 'Mutual of Omaha', charter: 'Omaha Insurance Company', charter_code: 'OIC', naic: 13100, carrier_id: 'mutual-of-omaha' },

  'united of omaha': { parent: 'Mutual of Omaha', charter: 'United of Omaha Life Insurance Company', charter_code: 'UO', naic: 69868, carrier_id: 'mutual-of-omaha' },
  'united of omaha life': { parent: 'Mutual of Omaha', charter: 'United of Omaha Life Insurance Company', charter_code: 'UO', naic: 69868, carrier_id: 'mutual-of-omaha' },
  'united of omaha life insurance company': { parent: 'Mutual of Omaha', charter: 'United of Omaha Life Insurance Company', charter_code: 'UO', naic: 69868, carrier_id: 'mutual-of-omaha' },
  'uo': { parent: 'Mutual of Omaha', charter: 'United of Omaha Life Insurance Company', charter_code: 'UO', naic: 69868, carrier_id: 'mutual-of-omaha' },
  'ml': { parent: 'Mutual of Omaha', charter: 'United of Omaha Life Insurance Company', charter_code: 'UO', naic: 69868, carrier_id: 'mutual-of-omaha' },
  'ms': { parent: 'Mutual of Omaha', charter: 'Omaha Supplemental Insurance Company', charter_code: 'OIC', naic: 13100, carrier_id: 'mutual-of-omaha' },

  'united world': { parent: 'Mutual of Omaha', charter: 'United World Life Insurance Company', charter_code: 'UW', naic: 72850, carrier_id: 'mutual-of-omaha' },
  'united world life': { parent: 'Mutual of Omaha', charter: 'United World Life Insurance Company', charter_code: 'UW', naic: 72850, carrier_id: 'mutual-of-omaha' },
  'united world life insurance company': { parent: 'Mutual of Omaha', charter: 'United World Life Insurance Company', charter_code: 'UW', naic: 72850, carrier_id: 'mutual-of-omaha' },
  'uw': { parent: 'Mutual of Omaha', charter: 'United World Life Insurance Company', charter_code: 'UW', naic: 72850, carrier_id: 'mutual-of-omaha' },
  'omaha supp': { parent: 'Mutual of Omaha', charter: 'Omaha Supplemental Insurance Company', charter_code: 'OIC', naic: 13100, carrier_id: 'mutual-of-omaha' },

  // ── Humana (4 charters) ──────────────────────────────────────────────────
  'humana insurance company': { parent: 'Humana', charter: 'Humana Insurance Company', charter_code: 'HIC', naic: 73288, carrier_id: 'humana' },
  'hic': { parent: 'Humana', charter: 'Humana Insurance Company', charter_code: 'HIC', naic: 73288, carrier_id: 'humana' },

  'humana benefit plan of illinois': { parent: 'Humana', charter: 'Humana Benefit Plan of Illinois', charter_code: 'HBPI', naic: 60052, carrier_id: 'humana' },
  'hbpi': { parent: 'Humana', charter: 'Humana Benefit Plan of Illinois', charter_code: 'HBPI', naic: 60052, carrier_id: 'humana' },

  'humana health benefit plan of louisiana': { parent: 'Humana', charter: 'Humana Health Benefit Plan of Louisiana', charter_code: 'HHBPL', naic: 95642, carrier_id: 'humana' },
  'hhbpl': { parent: 'Humana', charter: 'Humana Health Benefit Plan of Louisiana', charter_code: 'HHBPL', naic: 95642, carrier_id: 'humana' },

  'humanadental': { parent: 'Humana', charter: 'Humanadental Insurance Company', charter_code: 'HDIC', naic: 70580, carrier_id: 'humana' },
  'humanadental insurance company': { parent: 'Humana', charter: 'Humanadental Insurance Company', charter_code: 'HDIC', naic: 70580, carrier_id: 'humana' },
  'hdic': { parent: 'Humana', charter: 'Humanadental Insurance Company', charter_code: 'HDIC', naic: 70580, carrier_id: 'humana' },

  // ── Wellabe / Medico (3 charters) ────────────────────────────────────────
  'elips': { parent: 'Wellabe', charter: 'Elips Life Insurance Company', charter_code: 'ELIPS', naic: 85561, carrier_id: 'wellabe-medico' },
  'elips life': { parent: 'Wellabe', charter: 'Elips Life Insurance Company', charter_code: 'ELIPS', naic: 85561, carrier_id: 'wellabe-medico' },

  'medico insurance company': { parent: 'Wellabe', charter: 'Medico Insurance Company', charter_code: 'M1', carrier_id: 'wellabe-medico' },
  'medico life and health': { parent: 'Wellabe', charter: 'Medico Life and Health Insurance Company', charter_code: 'ML', carrier_id: 'wellabe-medico' },
  'medico life and health insurance company': { parent: 'Wellabe', charter: 'Medico Life and Health Insurance Company', charter_code: 'ML', carrier_id: 'wellabe-medico' },

  // ── Cigna (2 charters) ──────────────────────────────────────────────────
  'cigna national health insurance company': { parent: 'Cigna', charter: 'CIGNA National Health Insurance Company', charter_code: 'CNHIC', carrier_id: 'cigna' },
  'cigna health life insurance company': { parent: 'Cigna', charter: 'CIGNA Health + Life Insurance Company', charter_code: 'CHLIC', carrier_id: 'cigna' },
  'chlic': { parent: 'Cigna', charter: 'CIGNA Health + Life Insurance Company', charter_code: 'CHLIC', carrier_id: 'cigna' },
  'arlic': { parent: 'Cigna', charter: 'American Republic Life Insurance Company', charter_code: 'ARLIC', carrier_id: 'cigna' },
  'american republic': { parent: 'Cigna', charter: 'American Republic Life Insurance Company', charter_code: 'ARLIC', carrier_id: 'cigna' },

  // ── Chubb / ACE (2 charters) ────────────────────────────────────────────
  'chubb ina': { parent: 'Chubb', charter: 'CHUBB (INA)', charter_code: 'INA', carrier_id: 'chubb' },
  'ina': { parent: 'Chubb', charter: 'CHUBB (INA)', charter_code: 'INA', carrier_id: 'chubb' },
  'chubb ace': { parent: 'Chubb', charter: 'CHUBB (ACE)', charter_code: 'ACE', carrier_id: 'chubb' },
  'ace': { parent: 'Chubb', charter: 'CHUBB (ACE)', charter_code: 'ACE', carrier_id: 'chubb' },

  // ── Aflac (2 charters) ──────────────────────────────────────────────────
  'aflac columbus': { parent: 'Aflac', charter: 'American Family Life Assurance Company of Columbus', charter_code: 'AFLAC', naic: 60380, carrier_id: 'aflac' },
  'american family life': { parent: 'Aflac', charter: 'American Family Life Assurance Company of Columbus', charter_code: 'AFLAC', naic: 60380, carrier_id: 'aflac' },
  'aflac tierone': { parent: 'Aflac', charter: 'Aflac TierOne', charter_code: 'TierOne', carrier_id: 'aflac' },
  'tierone': { parent: 'Aflac', charter: 'Aflac TierOne', charter_code: 'TierOne', carrier_id: 'aflac' },

  // ── Anthem / Elevance (1 charter) ───────────────────────────────────────
  'wellpoint': { parent: 'Elevance', charter: 'Wellpoint Insurance Company', charter_code: 'WPI', naic: 14078, carrier_id: 'anthem-elevance' },
  'wellpoint insurance': { parent: 'Elevance', charter: 'Wellpoint Insurance Company', charter_code: 'WPI', naic: 14078, carrier_id: 'anthem-elevance' },

  // ── Single-charter carriers (auto-resolve) ──────────────────────────────
  'unitedhealthcare insurance company': { parent: 'UnitedHealthcare', charter: 'UnitedHealthcare Insurance Company', charter_code: 'UHC', carrier_id: 'uhc' },
  'wellmark blue cross blue shield of iowa': { parent: 'Wellmark BCBS of Iowa', charter: 'Wellmark Blue Cross Blue Shield of Iowa', charter_code: 'WBCBS', carrier_id: 'wellmark-bcbs-iowa' },
  'wellcare health plans': { parent: 'WellCare', charter: 'WellCare Health Plans', charter_code: 'WC', carrier_id: 'wellcare-centene' },
  'blue cross and blue shield of kansas city': { parent: 'Blue KC', charter: 'Blue Cross and Blue Shield of Kansas City', charter_code: 'BKC', carrier_id: 'bluekc' },
  'guarantee trust life insurance company': { parent: 'Guarantee Trust Life', charter: 'Guarantee Trust Life Insurance Company', charter_code: 'GTL', carrier_id: 'guarantee-trust' },
  'national general insurance': { parent: 'Allstate', charter: 'National General Insurance', charter_code: 'NatGen', carrier_id: 'allstate-natgen' },
  'natgen': { parent: 'Allstate', charter: 'National General Insurance', charter_code: 'NatGen', carrier_id: 'allstate-natgen' },
  'central states indemnity company of omaha': { parent: 'Central States Indemnity', charter: 'Central States Indemnity Company of Omaha', charter_code: 'CSI', naic: 34274, carrier_id: 'central-states' },
  'csi': { parent: 'Central States Indemnity', charter: 'Central States Indemnity Company of Omaha', charter_code: 'CSI', naic: 34274, carrier_id: 'central-states' },
  'lumico life insurance company': { parent: 'Lumico', charter: 'Lumico Life Insurance Company', charter_code: 'LUM', naic: 73504, carrier_id: 'lumico-cuna' },
  'medical mutual of ohio': { parent: 'Medical Mutual', charter: 'Medical Mutual of Ohio', charter_code: 'MMO', carrier_id: 'medmutual' },
  'mmo': { parent: 'Medical Mutual', charter: 'Medical Mutual of Ohio', charter_code: 'MMO', carrier_id: 'medmutual' },
  'silverscript insurance company': { parent: 'SilverScript', charter: 'SilverScript Insurance Company', charter_code: 'SS', carrier_id: 'silverscript' },
  'genworth life and annuity': { parent: 'Genworth', charter: 'Genworth Life and Annuity Insurance Company', charter_code: 'GLAIC', naic: 65536, carrier_id: 'genworth' },
  'glaic': { parent: 'Genworth', charter: 'Genworth Life and Annuity Insurance Company', charter_code: 'GLAIC', naic: 65536, carrier_id: 'genworth' },
}

// ============================================================================
// Parent Brand → Default Charter (for single-charter carriers)
//
// When carrier_name resolves to a parent brand with only one charter,
// we can auto-assign that charter. Multi-charter parents (Aetna, MutOmaha,
// Humana, Cigna, Chubb) cannot be auto-resolved — charter stays null.
// ============================================================================

export const SINGLE_CHARTER_PARENTS: Record<string, CarrierIdentity> = {
  'UnitedHealthcare': { parent: 'UnitedHealthcare', charter: 'UnitedHealthcare Insurance Company', charter_code: 'UHC', carrier_id: 'uhc' },
  'Wellmark BCBS of Iowa': { parent: 'Wellmark BCBS of Iowa', charter: 'Wellmark Blue Cross Blue Shield of Iowa', charter_code: 'WBCBS', carrier_id: 'wellmark-bcbs-iowa' },
  'WellCare': { parent: 'WellCare', charter: 'WellCare Health Plans', charter_code: 'WC', carrier_id: 'wellcare-centene' },
  'BlueKC': { parent: 'Blue KC', charter: 'Blue Cross and Blue Shield of Kansas City', charter_code: 'BKC', carrier_id: 'bluekc' },
  'Guarantee Trust Life': { parent: 'Guarantee Trust Life', charter: 'Guarantee Trust Life Insurance Company', charter_code: 'GTL', carrier_id: 'guarantee-trust' },
  'Allstate': { parent: 'Allstate', charter: 'National General Insurance', charter_code: 'NatGen', carrier_id: 'allstate-natgen' },
  'Central States Indemnity': { parent: 'Central States Indemnity', charter: 'Central States Indemnity Company of Omaha', charter_code: 'CSI', naic: 34274, carrier_id: 'central-states' },
  'Lumico': { parent: 'Lumico', charter: 'Lumico Life Insurance Company', charter_code: 'LUM', naic: 73504, carrier_id: 'lumico-cuna' },
  'Medical Mutual': { parent: 'Medical Mutual', charter: 'Medical Mutual of Ohio', charter_code: 'MMO', carrier_id: 'medmutual' },
  'SilverScript': { parent: 'SilverScript', charter: 'SilverScript Insurance Company', charter_code: 'SS', carrier_id: 'silverscript' },
  'Genworth': { parent: 'Genworth', charter: 'Genworth Life and Annuity Insurance Company', charter_code: 'GLAIC', naic: 65536, carrier_id: 'genworth' },
  'Aflac': { parent: 'Aflac', charter: 'American Family Life Assurance Company of Columbus', charter_code: 'AFLAC', naic: 60380, carrier_id: 'aflac' },
  'Elevance': { parent: 'Elevance', charter: 'Wellpoint Insurance Company', charter_code: 'WPI', naic: 14078, carrier_id: 'anthem-elevance' },
  'Delta Dental': { parent: 'Delta Dental', charter: 'Delta Dental', charter_code: 'DD', carrier_id: 'delta-dental' },
  'SILAC': { parent: 'SILAC', charter: 'SILAC Insurance Company', charter_code: 'SILAC', carrier_id: 'silac' },
  'Prosperity Life': { parent: 'Prosperity Life', charter: 'Prosperity Life Insurance Group', charter_code: 'PLIG', carrier_id: 'prosperity' },
  'Manhattan Life': { parent: 'Manhattan Life', charter: 'Manhattan Life Insurance Company', charter_code: 'ML', carrier_id: 'manhattan-life' },
  'Woodmen of the World': { parent: 'Woodmen of the World', charter: 'Woodmen of the World Life Insurance Society', charter_code: 'WOW', carrier_id: 'woodmen' },
}

// ============================================================================
// Resolver
// ============================================================================

/**
 * Resolve a raw carrier name to a full two-layer identity.
 *
 * 1. Check CHARTER_IDENTITY_MAP for direct charter match
 * 2. If not found, return null (caller should use CARRIER_ALIASES for parent)
 */
export function resolveCharterIdentity(raw: string): CarrierIdentity | null {
  if (!raw) return null
  const cleaned = String(raw).trim().toLowerCase()
    .replace(/_/g, ' ')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ')

  return CHARTER_IDENTITY_MAP[cleaned] ?? null
}

/**
 * For a known parent brand name, resolve the default charter
 * (only works for single-charter carriers).
 */
export function resolveDefaultCharter(parentName: string): CarrierIdentity | null {
  return SINGLE_CHARTER_PARENTS[parentName] ?? null
}
