/**
 * Carrier seed script — three tasks in one:
 *
 * 1. Seed Firestore `carriers` collection (parent brand → underwriting charters)
 * 2. Seed BigQuery `SERFF_MedSupp.carrier_mapping` table
 * 3. Update ALL Medicare accounts in Firestore with parent_carrier, charter, naic, carrier_id
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-carriers.ts --all
 *   npx tsx services/api/src/scripts/seed-carriers.ts --firestore-only
 *   npx tsx services/api/src/scripts/seed-carriers.ts --bigquery-only
 *   npx tsx services/api/src/scripts/seed-carriers.ts --accounts-only
 *   npx tsx services/api/src/scripts/seed-carriers.ts --all --dry-run
 *
 * Requires Application Default Credentials (gcloud auth application-default login).
 */

import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { BigQuery } from '@google-cloud/bigquery'

// ============================================================================
// Types
// ============================================================================

interface UnderwritingCharter {
  naic: number | null
  legal_name: string
  short_code: string
}

interface CarrierDoc {
  carrier_id: string
  parent_brand: string
  display_name: string
  underwriting_charters: UnderwritingCharter[]
  ghl_format: string | null
  created_at: string
  status: 'ACTIVE'
}

// ============================================================================
// Constants
// ============================================================================

const PROJECT_ID = 'claude-mcp-484718'
const CARRIERS_COLLECTION = 'carriers'
const BQ_DATASET = 'SERFF_MedSupp'
const BQ_TABLE = 'carrier_mapping'
const BATCH_LIMIT = 400

// ============================================================================
// CLI Parsing
// ============================================================================

interface CliArgs {
  all: boolean
  firestoreOnly: boolean
  bigqueryOnly: boolean
  accountsOnly: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    all: args.includes('--all'),
    firestoreOnly: args.includes('--firestore-only'),
    bigqueryOnly: args.includes('--bigquery-only'),
    accountsOnly: args.includes('--accounts-only'),
    dryRun: args.includes('--dry-run'),
  }
}

// ============================================================================
// CARRIER DATA — Complete parent brand → charter mapping
// ============================================================================

const NOW = new Date().toISOString()

const CARRIER_DATA: CarrierDoc[] = [
  // ── Major Medicare Supplement Brands ──────────────────────────────────
  {
    carrier_id: 'aetna-cvs',
    parent_brand: 'Aetna / CVS Health',
    display_name: 'Aetna',
    underwriting_charters: [
      { naic: 63444, legal_name: 'Accendo Insurance Company', short_code: 'ACC' },
      { naic: 90328, legal_name: 'First Health Life & Health Insurance Company', short_code: 'FHLH' },
      { naic: 71404, legal_name: 'Continental General Insurance Company', short_code: 'CGI' },
      { naic: 61506, legal_name: 'Resource Life Insurance Company', short_code: 'RLI' },
      { naic: null, legal_name: 'Aetna Health Insurance Company', short_code: 'AHIC' },
      { naic: null, legal_name: 'Aetna Health + Life Insurance Company', short_code: 'AHLC' },
      { naic: null, legal_name: 'Continental Life Insurance Company', short_code: 'CLI' },
    ],
    ghl_format: 'AETNA (ACC)- ACCENDO',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'humana',
    parent_brand: 'Humana',
    display_name: 'Humana',
    underwriting_charters: [
      { naic: 73288, legal_name: 'Humana Insurance Company', short_code: 'HIC' },
      { naic: 60052, legal_name: 'Humana Benefit Plan of Illinois', short_code: 'HBPI' },
      { naic: 95642, legal_name: 'Humana Health Benefit Plan of Louisiana', short_code: 'HHBPL' },
      { naic: 70580, legal_name: 'Humanadental Insurance Company', short_code: 'HDIC' },
    ],
    ghl_format: 'Humana',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'bcbs',
    parent_brand: 'Blue Cross Blue Shield',
    display_name: 'BCBS',
    underwriting_charters: [
      { naic: 70729, legal_name: 'Blue Cross Blue Shield of Kansas', short_code: 'BCBSKS' },
      { naic: 95610, legal_name: 'Blue Care Network of Michigan', short_code: 'BCNMI' },
      { naic: 54801, legal_name: 'BlueCross BlueShield of Georgia', short_code: 'BCBSGA' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'mutual-of-omaha',
    parent_brand: 'Mutual of Omaha',
    display_name: 'Mutual of Omaha',
    underwriting_charters: [
      { naic: 71412, legal_name: 'Mutual of Omaha Insurance Company', short_code: 'MUT' },
      { naic: 13100, legal_name: 'Omaha Insurance Company', short_code: 'OIC' },
      { naic: 69868, legal_name: 'United of Omaha Life Insurance Company', short_code: 'UO' },
      { naic: 72850, legal_name: 'United World Life Insurance Company', short_code: 'UW' },
    ],
    ghl_format: 'Mutual of Omaha (MUT)- Mutual of Omaha',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'wellabe-medico',
    parent_brand: 'Wellabe / Medico',
    display_name: 'Wellabe',
    underwriting_charters: [
      { naic: 85561, legal_name: 'Elips Life Insurance Company', short_code: 'ELIPS' },
      { naic: null, legal_name: 'Medico Insurance Company', short_code: 'M1' },
      { naic: null, legal_name: 'Medico Life and Health Insurance Company', short_code: 'ML' },
    ],
    ghl_format: 'Wellabe (M1)- Medico Insurance Company',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'aflac',
    parent_brand: 'Aflac',
    display_name: 'Aflac',
    underwriting_charters: [
      { naic: 60380, legal_name: 'American Family Life Assurance Company of Columbus', short_code: 'AFLAC' },
      { naic: null, legal_name: 'Aflac TierOne', short_code: 'TierOne' },
    ],
    ghl_format: 'Aflac',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'globe-life',
    parent_brand: 'Globe Life',
    display_name: 'Globe Life',
    underwriting_charters: [
      { naic: 65331, legal_name: 'Liberty National Life Insurance Company', short_code: 'LNL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'liberty-bankers',
    parent_brand: 'Liberty Bankers',
    display_name: 'Liberty Bankers',
    underwriting_charters: [
      { naic: 68543, legal_name: 'Liberty Bankers Life Insurance Company', short_code: 'LBL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'manhattan-life',
    parent_brand: 'Manhattan Life',
    display_name: 'Manhattan Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Manhattan Life Insurance Company', short_code: 'ML' },
    ],
    ghl_format: 'Manhattan Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'lumico-cuna',
    parent_brand: 'Lumico / CUNA Mutual',
    display_name: 'Lumico',
    underwriting_charters: [
      { naic: 73504, legal_name: 'Lumico Life Insurance Company', short_code: 'LUM' },
    ],
    ghl_format: 'Lumico',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'ngl',
    parent_brand: 'National Guardian Life (NGL)',
    display_name: 'NGL',
    underwriting_charters: [
      { naic: 66583, legal_name: 'National Guardian Life Insurance Company', short_code: 'NGL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'genworth',
    parent_brand: 'Genworth',
    display_name: 'Genworth',
    underwriting_charters: [
      { naic: 65536, legal_name: 'Genworth Life and Annuity Insurance Company', short_code: 'GLAIC' },
    ],
    ghl_format: 'Genworth Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'independence-holding',
    parent_brand: 'Independence Holding',
    display_name: 'Independence American',
    underwriting_charters: [
      { naic: 26581, legal_name: 'Independence American Insurance Company', short_code: 'IAIC' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'new-era',
    parent_brand: 'New Era',
    display_name: 'New Era',
    underwriting_charters: [
      { naic: 78743, legal_name: 'New Era Life Insurance Company', short_code: 'NEL' },
      { naic: 69698, legal_name: 'New Era Life Insurance Company of the Midwest', short_code: 'NELM' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'central-states',
    parent_brand: 'Central States Indemnity',
    display_name: 'Central States',
    underwriting_charters: [
      { naic: 34274, legal_name: 'Central States Indemnity Company of Omaha', short_code: 'CSI' },
    ],
    ghl_format: 'Central States Indemnity',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'epic',
    parent_brand: 'EPIC',
    display_name: 'EPIC',
    underwriting_charters: [
      { naic: 64149, legal_name: 'EPIC Life Insurance Company', short_code: 'EPIC' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'catholic-life',
    parent_brand: 'Catholic Life Insurance',
    display_name: 'Catholic Life',
    underwriting_charters: [
      { naic: 57347, legal_name: 'Catholic Life Insurance', short_code: 'CLI' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'lcba',
    parent_brand: 'LCBA',
    display_name: 'LCBA',
    underwriting_charters: [
      { naic: 56758, legal_name: 'Lithuanian Catholic Alliance', short_code: 'LCBA' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'anthem-elevance',
    parent_brand: 'Anthem / Elevance Health',
    display_name: 'Elevance',
    underwriting_charters: [
      { naic: 14078, legal_name: 'Wellpoint Insurance Company', short_code: 'WPI' },
    ],
    ghl_format: 'Elevance (Anthem BCBS)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'massmutual',
    parent_brand: 'MassMutual',
    display_name: 'MassMutual',
    underwriting_charters: [
      { naic: 65935, legal_name: 'Massachusetts Mutual Life Insurance Company', short_code: 'MMLIC' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'thrivent',
    parent_brand: 'Thrivent',
    display_name: 'Thrivent',
    underwriting_charters: [
      { naic: 56014, legal_name: 'Thrivent Financial for Lutherans', short_code: 'TFL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'wps',
    parent_brand: 'WPS',
    display_name: 'WPS',
    underwriting_charters: [
      { naic: 53139, legal_name: 'Wisconsin Physicians Service Insurance Corporation', short_code: 'WPS' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'allstate-natgen',
    parent_brand: 'Allstate / National General',
    display_name: 'Allstate',
    underwriting_charters: [
      { naic: null, legal_name: 'National General Insurance', short_code: 'NatGen' },
    ],
    ghl_format: 'Allstate (NatGen)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'chubb',
    parent_brand: 'CHUBB',
    display_name: 'CHUBB',
    underwriting_charters: [
      { naic: null, legal_name: 'CHUBB (INA)', short_code: 'INA' },
      { naic: null, legal_name: 'CHUBB (ACE)', short_code: 'ACE' },
    ],
    ghl_format: 'CHUBB (INA)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'wellmark-bcbs-iowa',
    parent_brand: 'Wellmark BCBS of Iowa',
    display_name: 'Wellmark',
    underwriting_charters: [
      { naic: null, legal_name: 'Wellmark Blue Cross Blue Shield of Iowa', short_code: 'WBCBS' },
    ],
    ghl_format: 'Wellmark BCBS of Iowa',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'uhc',
    parent_brand: 'UnitedHealthcare',
    display_name: 'UnitedHealthcare',
    underwriting_charters: [
      { naic: null, legal_name: 'UnitedHealthcare Insurance Company', short_code: 'UHC' },
    ],
    ghl_format: 'UnitedHealthcare',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'wellcare-centene',
    parent_brand: 'WellCare / Centene',
    display_name: 'WellCare',
    underwriting_charters: [
      { naic: null, legal_name: 'WellCare Health Plans', short_code: 'WC' },
    ],
    ghl_format: 'WellCare',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'gerber-life',
    parent_brand: 'Gerber Life',
    display_name: 'Gerber Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Gerber Life Insurance Company', short_code: 'GER' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'cigna',
    parent_brand: 'CIGNA',
    display_name: 'CIGNA',
    underwriting_charters: [
      { naic: null, legal_name: 'CIGNA National Health Insurance Company', short_code: 'CNHIC' },
      { naic: null, legal_name: 'CIGNA Health + Life Insurance Company', short_code: 'CHLIC' },
    ],
    ghl_format: 'CIGNA (CNHIC)- CIGNA National Health Insurance Company',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'medmutual',
    parent_brand: 'Medmutual Protect',
    display_name: 'Medmutual',
    underwriting_charters: [
      { naic: null, legal_name: 'Medical Mutual of Ohio', short_code: 'MMO' },
    ],
    ghl_format: 'Medmutual Protect',
    created_at: NOW,
    status: 'ACTIVE',
  },

  // ── Fraternal Organizations ──────────────────────────────────────────
  {
    carrier_id: 'cof',
    parent_brand: 'Catholic Order of Foresters',
    display_name: 'Catholic Order of Foresters',
    underwriting_charters: [
      { naic: null, legal_name: 'Catholic Order of Foresters', short_code: 'COF' },
    ],
    ghl_format: 'Catholic Order of Foresters',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'greek-catholic-union',
    parent_brand: 'Greek Catholic Union',
    display_name: 'Greek Catholic Union',
    underwriting_charters: [
      { naic: 56693, legal_name: 'Greek Catholic Union of the USA', short_code: 'GCU' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'kskj-life',
    parent_brand: 'KSKJ Life',
    display_name: 'KSKJ Life',
    underwriting_charters: [
      { naic: 56227, legal_name: 'KSKJ Life, American Slovenian Catholic Union', short_code: 'KSKJ' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'royal-arcanum',
    parent_brand: 'Royal Arcanum',
    display_name: 'Royal Arcanum',
    underwriting_charters: [
      { naic: 58181, legal_name: 'Royal Arcanum', short_code: 'RA' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'western-catholic-union',
    parent_brand: 'Western Catholic Union',
    display_name: 'Western Catholic Union',
    underwriting_charters: [
      { naic: 57711, legal_name: 'Western Catholic Union', short_code: 'WCU' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },

  // ── Other Small Carriers ─────────────────────────────────────────────
  {
    carrier_id: 'american-progressive',
    parent_brand: 'American Progressive Life',
    display_name: 'American Progressive',
    underwriting_charters: [
      { naic: 80624, legal_name: 'American Progressive Life & Health Insurance Company', short_code: 'APLH' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'christian-fidelity',
    parent_brand: 'Christian Fidelity Life',
    display_name: 'Christian Fidelity',
    underwriting_charters: [
      { naic: 61859, legal_name: 'Christian Fidelity Life Insurance Company', short_code: 'CFL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'columbian-mutual',
    parent_brand: 'Columbian Mutual Life',
    display_name: 'Columbian Mutual',
    underwriting_charters: [
      { naic: 62103, legal_name: 'Columbian Mutual Life Insurance Company', short_code: 'CML' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'everest-re',
    parent_brand: 'Everest Re',
    display_name: 'Everest Re',
    underwriting_charters: [
      { naic: 26921, legal_name: 'Everest Reinsurance Company', short_code: 'ERC' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'heartland-national',
    parent_brand: 'Heartland National Life',
    display_name: 'Heartland National',
    underwriting_charters: [
      { naic: 66214, legal_name: 'Heartland National Life Insurance Company', short_code: 'HNL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'magna-insurance',
    parent_brand: 'Magna Insurance',
    display_name: 'Magna',
    underwriting_charters: [
      { naic: 61018, legal_name: 'Magna Insurance Company', short_code: 'MAG' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'paramount-insurance',
    parent_brand: 'Paramount Insurance',
    display_name: 'Paramount',
    underwriting_charters: [
      { naic: 16128, legal_name: 'Paramount Insurance Company', short_code: 'PAR' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'philadelphia-american',
    parent_brand: 'Philadelphia American Life',
    display_name: 'Philadelphia American',
    underwriting_charters: [
      { naic: 67784, legal_name: 'Philadelphia American Life Insurance Company', short_code: 'PAL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'southern-guaranty',
    parent_brand: 'Southern Guaranty',
    display_name: 'Southern Guaranty',
    underwriting_charters: [
      { naic: 19178, legal_name: 'Southern Guaranty Insurance Company', short_code: 'SGI' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'unified-life',
    parent_brand: 'Unified Life',
    display_name: 'Unified Life',
    underwriting_charters: [
      { naic: 11121, legal_name: 'Unified Life Insurance Company', short_code: 'ULI' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'united-national',
    parent_brand: 'United National Life',
    display_name: 'United National',
    underwriting_charters: [
      { naic: 92703, legal_name: 'United National Life Insurance Company of America', short_code: 'UNL' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'wmi-mutual',
    parent_brand: 'WMI Mutual',
    display_name: 'WMI Mutual',
    underwriting_charters: [
      { naic: 68420, legal_name: 'WMI Mutual Insurance Company', short_code: 'WMI' },
    ],
    ghl_format: null,
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'western-united',
    parent_brand: 'Western United Life',
    display_name: 'Western United',
    underwriting_charters: [
      { naic: 85189, legal_name: 'Western United Life Assurance Company', short_code: 'WUL' },
    ],
    ghl_format: 'Western United Life',
    created_at: NOW,
    status: 'ACTIVE',
  },

  // ── Additional carriers found in Firestore accounts ──────────────────
  {
    carrier_id: 'guarantee-trust',
    parent_brand: 'Guarantee Trust Life',
    display_name: 'Guarantee Trust',
    underwriting_charters: [
      { naic: null, legal_name: 'Guarantee Trust Life Insurance Company', short_code: 'GTL' },
    ],
    ghl_format: 'Guarantee Trust Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'bluekc',
    parent_brand: 'Blue KC',
    display_name: 'Blue KC',
    underwriting_charters: [
      { naic: null, legal_name: 'Blue Cross and Blue Shield of Kansas City', short_code: 'BKC' },
    ],
    ghl_format: 'BlueKC',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'corebridge-aig',
    parent_brand: 'Corebridge / AIG',
    display_name: 'Corebridge',
    underwriting_charters: [
      { naic: null, legal_name: 'Corebridge Financial (fka AIG)', short_code: 'AIG' },
    ],
    ghl_format: 'Corebridge (AIG)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'north-american',
    parent_brand: 'North American',
    display_name: 'North American',
    underwriting_charters: [
      { naic: null, legal_name: 'North American Company for Property and Casualty Insurance', short_code: 'NAC' },
    ],
    ghl_format: 'North American',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'americo',
    parent_brand: 'Americo',
    display_name: 'Americo',
    underwriting_charters: [
      { naic: null, legal_name: 'Americo Financial Life and Annuity Insurance Company', short_code: 'AFL' },
    ],
    ghl_format: 'Americo Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'ameritas',
    parent_brand: 'Ameritas',
    display_name: 'Ameritas',
    underwriting_charters: [
      { naic: null, legal_name: 'Ameritas Life Insurance Corp', short_code: 'ALC' },
    ],
    ghl_format: 'Ameritas Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'equitable',
    parent_brand: 'Equitable',
    display_name: 'Equitable',
    underwriting_charters: [
      { naic: null, legal_name: 'Equitable Financial Life Insurance Company', short_code: 'AXA' },
    ],
    ghl_format: 'Equitable (AXA)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'jackson-national',
    parent_brand: 'Jackson National Life',
    display_name: 'Jackson',
    underwriting_charters: [
      { naic: null, legal_name: 'Jackson National Life Insurance Company', short_code: 'JNL' },
    ],
    ghl_format: 'Jackson National Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'kansas-city-life',
    parent_brand: 'Kansas City Life',
    display_name: 'Kansas City Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Kansas City Life Insurance Company', short_code: 'KCL' },
    ],
    ghl_format: 'Kansas City Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'silverscript',
    parent_brand: 'SilverScript',
    display_name: 'SilverScript',
    underwriting_charters: [
      { naic: null, legal_name: 'SilverScript Insurance Company', short_code: 'SS' },
    ],
    ghl_format: 'SilverScript',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'lincoln-financial',
    parent_brand: 'Lincoln Financial Group',
    display_name: 'Lincoln Financial',
    underwriting_charters: [
      { naic: null, legal_name: 'Lincoln National Life Insurance Company', short_code: 'LNL' },
    ],
    ghl_format: 'Lincoln Financial Group',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'brighthouse',
    parent_brand: 'Brighthouse / MetLife',
    display_name: 'Brighthouse',
    underwriting_charters: [
      { naic: null, legal_name: 'Brighthouse Life Insurance Company (fka MetLife)', short_code: 'MET' },
    ],
    ghl_format: 'Brighthouse (MET)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'nassau',
    parent_brand: 'Nassau',
    display_name: 'Nassau',
    underwriting_charters: [
      { naic: null, legal_name: 'Nassau Life and Annuity Company', short_code: 'NAS' },
    ],
    ghl_format: 'Nassau',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'prudential',
    parent_brand: 'Prudential',
    display_name: 'Prudential',
    underwriting_charters: [
      { naic: null, legal_name: 'Prudential Insurance Company of America', short_code: 'PRU' },
    ],
    ghl_format: 'Prudential',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'assurity',
    parent_brand: 'Assurity Life',
    display_name: 'Assurity',
    underwriting_charters: [
      { naic: null, legal_name: 'Assurity Life Insurance Company', short_code: 'ASR' },
    ],
    ghl_format: 'Assurity Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'midland-national',
    parent_brand: 'Midland National',
    display_name: 'Midland National',
    underwriting_charters: [
      { naic: null, legal_name: 'Midland National Life Insurance Company', short_code: 'MNL' },
    ],
    ghl_format: 'Midland National',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'silac',
    parent_brand: 'SILAC',
    display_name: 'SILAC',
    underwriting_charters: [
      { naic: null, legal_name: 'SILAC Insurance Company', short_code: 'SIL' },
    ],
    ghl_format: 'SILAC (fka Equitable)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'allianz',
    parent_brand: 'Allianz',
    display_name: 'Allianz',
    underwriting_charters: [
      { naic: null, legal_name: 'Allianz Life Insurance Company of North America', short_code: 'ALZ' },
    ],
    ghl_format: 'Allianz',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'transamerica',
    parent_brand: 'TransAmerica',
    display_name: 'TransAmerica',
    underwriting_charters: [
      { naic: null, legal_name: 'Transamerica Life Insurance Company', short_code: 'TA' },
    ],
    ghl_format: 'TransAmerica',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'delta-dental',
    parent_brand: 'Delta Dental',
    display_name: 'Delta Dental',
    underwriting_charters: [
      { naic: null, legal_name: 'Delta Dental Plans Association', short_code: 'DD' },
    ],
    ghl_format: 'Delta Dental',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'devoted',
    parent_brand: 'Devoted Health',
    display_name: 'Devoted',
    underwriting_charters: [
      { naic: null, legal_name: 'Devoted Health Plan', short_code: 'DH' },
    ],
    ghl_format: 'Devoted',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'securian',
    parent_brand: 'Securian Financial',
    display_name: 'Securian',
    underwriting_charters: [
      { naic: null, legal_name: 'Securian Financial Group', short_code: 'SEC' },
    ],
    ghl_format: 'Securian Financial',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'john-hancock',
    parent_brand: 'John Hancock',
    display_name: 'John Hancock',
    underwriting_charters: [
      { naic: null, legal_name: 'John Hancock Life Insurance Company', short_code: 'JH' },
    ],
    ghl_format: 'John Hancock Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'consolidated',
    parent_brand: 'Consolidated',
    display_name: 'Consolidated',
    underwriting_charters: [
      { naic: null, legal_name: 'Consolidated Insurance Company', short_code: 'CON' },
    ],
    ghl_format: 'Consolidated',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'delaware-life',
    parent_brand: 'Delaware Life',
    display_name: 'Delaware Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Delaware Life Insurance Company', short_code: 'DL' },
    ],
    ghl_format: 'Delaware Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'alignment-health',
    parent_brand: 'Alignment Health',
    display_name: 'Alignment',
    underwriting_charters: [
      { naic: null, legal_name: 'Alignment Health Plan', short_code: 'AHP' },
    ],
    ghl_format: 'Alignment Health',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'voya',
    parent_brand: 'VOYA / ING',
    display_name: 'VOYA',
    underwriting_charters: [
      { naic: null, legal_name: 'VOYA Financial (fka ING)', short_code: 'ING' },
    ],
    ghl_format: 'VOYA (ING)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'northwestern-mutual',
    parent_brand: 'Northwestern Mutual',
    display_name: 'Northwestern Mutual',
    underwriting_charters: [
      { naic: null, legal_name: 'Northwestern Mutual Life Insurance Company', short_code: 'NWM' },
    ],
    ghl_format: 'Northwestern Mutual',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'farm-bureau',
    parent_brand: 'Farm Bureau',
    display_name: 'Farm Bureau',
    underwriting_charters: [
      { naic: null, legal_name: 'Farm Bureau Life Insurance Company', short_code: 'FB' },
    ],
    ghl_format: 'Farm Bureau Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'prosperity',
    parent_brand: 'Prosperity Life (fka S.USA)',
    display_name: 'Prosperity',
    underwriting_charters: [
      { naic: null, legal_name: 'Prosperity Life Insurance Group (fka S.USA Life)', short_code: 'PRL' },
    ],
    ghl_format: 'Prosperity (fka S.USA Life)',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'fidelity-guaranty',
    parent_brand: 'Fidelity & Guaranty Life',
    display_name: 'F&G',
    underwriting_charters: [
      { naic: null, legal_name: 'Fidelity & Guaranty Life Insurance Company', short_code: 'FGL' },
    ],
    ghl_format: 'F&G Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'nationwide',
    parent_brand: 'Nationwide',
    display_name: 'Nationwide',
    underwriting_charters: [
      { naic: null, legal_name: 'Nationwide Life Insurance Company', short_code: 'NW' },
    ],
    ghl_format: 'Nationwide',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'athene',
    parent_brand: 'Athene',
    display_name: 'Athene',
    underwriting_charters: [
      { naic: null, legal_name: 'Athene Annuity and Life Company', short_code: 'ATH' },
    ],
    ghl_format: 'Athene',
    created_at: NOW,
    status: 'ACTIVE',
  },

  // ── Remaining carriers found in account data (unmatched in dry-run) ──
  {
    carrier_id: 'sentinel-security',
    parent_brand: 'Sentinel Security Life',
    display_name: 'Sentinel Security',
    underwriting_charters: [
      { naic: null, legal_name: 'Sentinel Security Life Insurance Company', short_code: 'SSL' },
    ],
    ghl_format: 'Sentinel Security',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'american-equity',
    parent_brand: 'American Equity',
    display_name: 'American Equity',
    underwriting_charters: [
      { naic: null, legal_name: 'American Equity Investment Life Insurance Company', short_code: 'AEL' },
    ],
    ghl_format: 'American Equity Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'new-york-life',
    parent_brand: 'New York Life',
    display_name: 'New York Life',
    underwriting_charters: [
      { naic: null, legal_name: 'New York Life Insurance Company', short_code: 'NYL' },
    ],
    ghl_format: 'New York Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'woodmen',
    parent_brand: 'Woodmen of the World',
    display_name: 'Woodmen',
    underwriting_charters: [
      { naic: null, legal_name: 'Woodmen of the World Life Insurance Society', short_code: 'WOW' },
    ],
    ghl_format: 'Woodmen of the World',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'knights-of-columbus',
    parent_brand: 'Knights of Columbus',
    display_name: 'Knights of Columbus',
    underwriting_charters: [
      { naic: null, legal_name: 'Knights of Columbus', short_code: 'KOC' },
    ],
    ghl_format: 'Knights of Columbus',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'lincoln-benefit',
    parent_brand: 'Lincoln Benefit Life',
    display_name: 'Lincoln Benefit',
    underwriting_charters: [
      { naic: null, legal_name: 'Lincoln Benefit Life Company', short_code: 'LBL' },
    ],
    ghl_format: 'Lincoln Benefit Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'aspida',
    parent_brand: 'Aspida',
    display_name: 'Aspida',
    underwriting_charters: [
      { naic: null, legal_name: 'Aspida Life Insurance Company', short_code: 'ASP' },
    ],
    ghl_format: 'ASPIDA',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'state-farm',
    parent_brand: 'State Farm',
    display_name: 'State Farm',
    underwriting_charters: [
      { naic: null, legal_name: 'State Farm Life Insurance Company', short_code: 'SF' },
    ],
    ghl_format: 'State Farm',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'accordia',
    parent_brand: 'Accordia Life',
    display_name: 'Accordia',
    underwriting_charters: [
      { naic: null, legal_name: 'Accordia Life and Annuity Company', short_code: 'ACC' },
    ],
    ghl_format: 'Accordia Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'bankers-life',
    parent_brand: 'Bankers Life',
    display_name: 'Bankers Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Bankers Life and Casualty Company', short_code: 'BLC' },
    ],
    ghl_format: 'Bankers Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'emc',
    parent_brand: 'EMC',
    display_name: 'EMC',
    underwriting_charters: [
      { naic: null, legal_name: 'EMC National Life Company', short_code: 'EMC' },
    ],
    ghl_format: 'EMC',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'banner-life',
    parent_brand: 'Banner Life',
    display_name: 'Banner Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Banner Life Insurance Company', short_code: 'BAN' },
    ],
    ghl_format: 'Banner Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'essence-healthcare',
    parent_brand: 'Essence Healthcare',
    display_name: 'Essence',
    underwriting_charters: [
      { naic: null, legal_name: 'Essence Healthcare', short_code: 'ESS' },
    ],
    ghl_format: 'Essence Healthcare',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'lafayette-life',
    parent_brand: 'Lafayette Life',
    display_name: 'Lafayette',
    underwriting_charters: [
      { naic: null, legal_name: 'Lafayette Life Insurance Company', short_code: 'LAF' },
    ],
    ghl_format: 'Lafayette Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'life-southwest',
    parent_brand: 'Life Insurance of the Southwest',
    display_name: 'Life of the Southwest',
    underwriting_charters: [
      { naic: null, legal_name: 'Life Insurance Company of the Southwest', short_code: 'LSW' },
    ],
    ghl_format: 'Life Insurance of the Southwest',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'oceanview',
    parent_brand: 'Oceanview Life',
    display_name: 'Oceanview',
    underwriting_charters: [
      { naic: null, legal_name: 'Oceanview Life and Annuity Company', short_code: 'OV' },
    ],
    ghl_format: 'Oceanview Life and Annuity',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'security-benefit',
    parent_brand: 'Security Benefit',
    display_name: 'Security Benefit',
    underwriting_charters: [
      { naic: null, legal_name: 'Security Benefit Life Insurance Company', short_code: 'SBL' },
    ],
    ghl_format: 'Security Benefit',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'federal-life',
    parent_brand: 'Federal Life',
    display_name: 'Federal Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Federal Life Insurance Company', short_code: 'FED' },
    ],
    ghl_format: 'Federal Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'pacific-life',
    parent_brand: 'Pacific Life',
    display_name: 'Pacific Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Pacific Life Insurance Company', short_code: 'PAC' },
    ],
    ghl_format: 'Pacific Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'global-atlantic',
    parent_brand: 'Global Atlantic',
    display_name: 'Global Atlantic',
    underwriting_charters: [
      { naic: null, legal_name: 'Global Atlantic Financial Group', short_code: 'GA' },
    ],
    ghl_format: 'Global Atlantic',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'minnesota-life',
    parent_brand: 'Minnesota Life',
    display_name: 'Minnesota Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Minnesota Life Insurance Company', short_code: 'MNL' },
    ],
    ghl_format: 'Minnesota Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'columbus-life',
    parent_brand: 'Columbus Life',
    display_name: 'Columbus Life',
    underwriting_charters: [
      { naic: null, legal_name: 'Columbus Life Insurance Company', short_code: 'CLU' },
    ],
    ghl_format: 'Columbus Life',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'employer-benefits',
    parent_brand: 'Employer Benefits',
    display_name: 'Employer Benefits',
    underwriting_charters: [
      { naic: null, legal_name: 'Employer Benefits Insurance Company', short_code: 'EB' },
    ],
    ghl_format: 'Employer Benefits',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'symetra',
    parent_brand: 'Symetra',
    display_name: 'Symetra',
    underwriting_charters: [
      { naic: null, legal_name: 'Symetra Life Insurance Company', short_code: 'SYM' },
    ],
    ghl_format: 'Symetra',
    created_at: NOW,
    status: 'ACTIVE',
  },
  {
    carrier_id: 'primerica',
    parent_brand: 'Primerica',
    display_name: 'Primerica',
    underwriting_charters: [
      { naic: null, legal_name: 'Primerica Life Insurance Company', short_code: 'PRI' },
    ],
    ghl_format: 'Primerica',
    created_at: NOW,
    status: 'ACTIVE',
  },
]

// ============================================================================
// TASK 1: Seed Firestore `carriers` collection
// ============================================================================

async function seedFirestoreCarriers(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<number> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 1: Seeding Firestore carriers collection')
  console.log('='.repeat(60))

  const writes: Array<{ docId: string; data: Record<string, unknown> }> = []

  for (const carrier of CARRIER_DATA) {
    // Write alias fields so all consumers work regardless of which field name they read:
    // - display_name: original seed field
    // - name: core Carrier interface + accounts page
    // - carrier_name: pipeline page + API search
    writes.push({
      docId: carrier.carrier_id,
      data: { ...carrier, name: carrier.display_name, carrier_name: carrier.display_name },
    })
  }

  console.log(`  Prepared ${writes.length} carrier documents`)

  if (dryRun) {
    console.log('  [DRY RUN] Would write:')
    for (const w of writes) {
      console.log(`    carriers/${w.docId} (${w.data.display_name}: ${w.data.underwriting_charters.length} charters)`)
    }
    return writes.length
  }

  // Batched writes
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_LIMIT)

    for (const w of chunk) {
      const ref = db.collection(CARRIERS_COLLECTION).doc(w.docId)
      batch.set(ref, w.data)
    }

    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} docs)`)
  }

  console.log(`  Done: ${writes.length} carrier docs written to Firestore`)
  return writes.length
}

// ============================================================================
// TASK 2: Seed BigQuery carrier_mapping table
// ============================================================================

async function seedBigQueryMapping(dryRun: boolean): Promise<number> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 2: Seeding BigQuery carrier_mapping table')
  console.log('='.repeat(60))

  const bq = new BigQuery({ projectId: PROJECT_ID })
  const now = new Date().toISOString()

  // Build rows: one per underwriting charter that has a NAIC code
  const rows: Array<{
    serff_company: string
    serff_naic: number
    rpi_carrier_name: string
    rpi_carrier_id: string
    match_method: string
    verified: boolean
    updated_at: string
  }> = []

  for (const carrier of CARRIER_DATA) {
    for (const charter of carrier.underwriting_charters) {
      if (charter.naic !== null) {
        rows.push({
          serff_company: charter.legal_name,
          serff_naic: charter.naic,
          rpi_carrier_name: carrier.display_name,
          rpi_carrier_id: carrier.carrier_id,
          match_method: 'manual_seed',
          verified: true,
          updated_at: now,
        })
      }
    }
  }

  console.log(`  Prepared ${rows.length} mapping rows (charters with NAIC codes)`)

  if (dryRun) {
    console.log('  [DRY RUN] Would insert:')
    for (const r of rows) {
      console.log(`    ${r.serff_naic} | ${r.serff_company} → ${r.rpi_carrier_name} (${r.rpi_carrier_id})`)
    }
    return rows.length
  }

  // Truncate existing rows first (clean seed)
  try {
    await bq.query(`DELETE FROM \`${PROJECT_ID}.${BQ_DATASET}.${BQ_TABLE}\` WHERE TRUE`)
    console.log('  Cleared existing carrier_mapping rows')
  } catch (e) {
    // Table might be empty, that's fine
    console.log('  Note: Could not clear existing rows (table may be empty)')
  }

  // Insert rows
  const table = bq.dataset(BQ_DATASET).table(BQ_TABLE)
  await table.insert(rows)
  console.log(`  Done: ${rows.length} rows inserted into BigQuery carrier_mapping`)

  return rows.length
}

// ============================================================================
// TASK 3: Update Medicare accounts with parent carrier mapping
// ============================================================================

/**
 * Parse GHL-format carrier_name into components.
 *
 * Patterns:
 *   "AETNA (ACC)- ACCENDO"       → parent: AETNA, short_code: ACC, charter_name: ACCENDO
 *   "Wellabe (M1)- Medico ..."   → parent: Wellabe, short_code: M1, charter_name: Medico ...
 *   "AETNA (MAPD)"               → parent: AETNA, short_code: MAPD
 *   "Allstate (NatGen)"          → parent: Allstate, short_code: NatGen
 *   "Mutual of Omaha"            → parent: Mutual of Omaha
 *   "UnitedHealthcare"           → parent: UnitedHealthcare
 */
interface ParsedCarrierName {
  rawParent: string
  shortCode: string | null
  charterFullName: string | null
}

function parseCarrierName(name: string): ParsedCarrierName {
  // Pattern: "PARENT (CODE)- FULL CHARTER NAME"
  const fullPattern = /^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/
  let match = name.match(fullPattern)
  if (match) {
    return {
      rawParent: match[1].trim(),
      shortCode: match[2].trim(),
      charterFullName: match[3].trim(),
    }
  }

  // Pattern: "PARENT (CODE)" — no dash/charter name
  const codeOnly = /^(.+?)\s*\(([^)]+)\)$/
  match = name.match(codeOnly)
  if (match) {
    return {
      rawParent: match[1].trim(),
      shortCode: match[2].trim(),
      charterFullName: null,
    }
  }

  // Plain name
  return {
    rawParent: name.trim(),
    shortCode: null,
    charterFullName: null,
  }
}

/**
 * Build a lookup index for matching carrier_name to our carrier data.
 * Returns a function that takes a carrier_name and returns the match result.
 */
interface MatchResult {
  carrier_id: string
  parent_carrier: string
  underwriting_charter: string | null
  naic_code: number | null
}

function buildCarrierMatcher(): (name: string) => MatchResult | null {
  // Build several indexes:
  // 1. By display_name (lowercase)
  // 2. By parent_brand keywords
  // 3. By charter short_code
  // 4. By charter legal_name fragments

  const byDisplayLower = new Map<string, CarrierDoc>()
  const byParentLower = new Map<string, CarrierDoc>()
  const byShortCode = new Map<string, { carrier: CarrierDoc; charter: UnderwritingCharter }>()

  for (const carrier of CARRIER_DATA) {
    byDisplayLower.set(carrier.display_name.toLowerCase(), carrier)
    byParentLower.set(carrier.parent_brand.toLowerCase(), carrier)

    for (const charter of carrier.underwriting_charters) {
      byShortCode.set(charter.short_code.toLowerCase(), { carrier, charter })
    }
  }

  // Alias map for common variations
  const aliasMap: Record<string, string> = {
    'united healthcare': 'uhc',
    'unitedhealthcare': 'uhc',
    'wellcare': 'wellcare-centene',
    'wellmark bcbs of iowa': 'wellmark-bcbs-iowa',
    'wellmark (bcbs of iowa)': 'wellmark-bcbs-iowa',
    'wellmark': 'wellmark-bcbs-iowa',
    'aetna': 'aetna-cvs',
    'medico': 'wellabe-medico',
    'wellabe': 'wellabe-medico',
    'aflac': 'aflac',
    'humana': 'humana',
    'mutual of omaha': 'mutual-of-omaha',
    'central states indemnity': 'central-states',
    'catholic order of foresters': 'cof',
    'lumico': 'lumico-cuna',
    'manhattan life': 'manhattan-life',
    'cigna': 'cigna',
    'chubb': 'chubb',
    'allstate': 'allstate-natgen',
    'guarantee trust life': 'guarantee-trust',
    'north american': 'north-american',
    'north american company': 'north-american',
    'bluekc': 'bluekc',
    'corebridge': 'corebridge-aig',
    'corebridge (aig)': 'corebridge-aig',
    'americo life': 'americo',
    'americo': 'americo',
    'ameritas life': 'ameritas',
    'ameritas': 'ameritas',
    'ameritas (legacy marketing group)': 'ameritas',
    'equitable': 'equitable',
    'equitable (axa)': 'equitable',
    'jackson national life': 'jackson-national',
    'kansas city life': 'kansas-city-life',
    'silverscript': 'silverscript',
    'lincoln financial group': 'lincoln-financial',
    'brighthouse (met)': 'brighthouse',
    'brighthouse': 'brighthouse',
    'nassau': 'nassau',
    'prudential': 'prudential',
    'assurity life': 'assurity',
    'midland national': 'midland-national',
    'midland national life': 'midland-national',
    'silac': 'silac',
    'silac (fka equitable)': 'silac',
    'allianz': 'allianz',
    'transamerica': 'transamerica',
    'delta dental': 'delta-dental',
    'devoted': 'devoted',
    'securian financial': 'securian',
    'john hancock life': 'john-hancock',
    'john hancock': 'john-hancock',
    'consolidated': 'consolidated',
    'delaware life': 'delaware-life',
    'alignment health': 'alignment-health',
    'voya (ing)': 'voya',
    'voya': 'voya',
    'northwestern mutual': 'northwestern-mutual',
    'farm bureau life': 'farm-bureau',
    'farm bureau': 'farm-bureau',
    'prosperity (fka s.usa life)': 'prosperity',
    'prosperity': 'prosperity',
    'medmutual protect': 'medmutual',
    'medmutual': 'medmutual',
    'genworth life': 'genworth',
    'genworth': 'genworth',
    'fidelity & guaranty life': 'fidelity-guaranty',
    'f&g life': 'fidelity-guaranty',
    'nationwide': 'nationwide',
    'cigna (mapd)': 'cigna',
    'elevance (anthem bcbs)': 'anthem-elevance',
    'aetna (mapd)': 'aetna-cvs',
    'aetna (pdp)': 'aetna-cvs',
    'continental life': 'aetna-cvs',
    'athene': 'athene',
    'western united life': 'western-united',
    // Unmatched names from dry-run
    'sentinel security': 'sentinel-security',
    'fg life': 'fidelity-guaranty',
    'american equity life': 'american-equity',
    'american equity': 'american-equity',
    'new york life': 'new-york-life',
    'woodmen of the world': 'woodmen',
    'knights of columbus': 'knights-of-columbus',
    'ace': 'chubb',
    'lincoln benefit life': 'lincoln-benefit',
    'medical mutual': 'medmutual',
    'aspida': 'aspida',
    'state farm': 'state-farm',
    'accordia life': 'accordia',
    'accordia': 'accordia',
    'bankers life': 'bankers-life',
    'emc': 'emc',
    'banner life': 'banner-life',
    'essence (mapd)': 'essence-healthcare',
    'essence healthcare': 'essence-healthcare',
    'essence': 'essence-healthcare',
    'lafayette life': 'lafayette-life',
    'lafayette': 'lafayette-life',
    'life insurance of the southwest': 'life-southwest',
    'life insurance company': 'life-southwest',
    'oceanview life and annuity': 'oceanview',
    'oceanview': 'oceanview',
    'security benefit': 'security-benefit',
    'federal life': 'federal-life',
    'pacific life': 'pacific-life',
    'global atlantic': 'global-atlantic',
    'minnesota life': 'minnesota-life',
    'columbus life': 'columbus-life',
    'employer benefits': 'employer-benefits',
    'symetra': 'symetra',
    'primerica': 'primerica',
  }

  // Build carrier_id → doc map
  const byId = new Map<string, CarrierDoc>()
  for (const carrier of CARRIER_DATA) {
    byId.set(carrier.carrier_id, carrier)
  }

  return (name: string): MatchResult | null => {
    if (!name || !name.trim()) return null

    const parsed = parseCarrierName(name)
    const nameLower = name.toLowerCase().trim()
    const parentLower = parsed.rawParent.toLowerCase().trim()

    // Step 1: Try alias map (exact match on full name)
    const aliasId = aliasMap[nameLower]
    if (aliasId) {
      const carrier = byId.get(aliasId)
      if (carrier) {
        // If we have a short code, try to match to a specific charter
        let matchedCharter: UnderwritingCharter | null = null
        if (parsed.shortCode) {
          matchedCharter = carrier.underwriting_charters.find(
            (c) => c.short_code.toLowerCase() === parsed.shortCode!.toLowerCase()
          ) || null
        }
        // If we have a charter full name, try that
        if (!matchedCharter && parsed.charterFullName) {
          const cfLower = parsed.charterFullName.toLowerCase()
          matchedCharter = carrier.underwriting_charters.find(
            (c) => c.legal_name.toLowerCase().includes(cfLower) || cfLower.includes(c.legal_name.toLowerCase())
          ) || null
        }

        return {
          carrier_id: carrier.carrier_id,
          parent_carrier: carrier.parent_brand,
          underwriting_charter: matchedCharter?.legal_name || null,
          naic_code: matchedCharter?.naic || null,
        }
      }
    }

    // Step 2: Try alias on just the parent part
    const parentAliasId = aliasMap[parentLower]
    if (parentAliasId) {
      const carrier = byId.get(parentAliasId)
      if (carrier) {
        let matchedCharter: UnderwritingCharter | null = null
        if (parsed.shortCode) {
          matchedCharter = carrier.underwriting_charters.find(
            (c) => c.short_code.toLowerCase() === parsed.shortCode!.toLowerCase()
          ) || null
        }
        if (!matchedCharter && parsed.charterFullName) {
          const cfLower = parsed.charterFullName.toLowerCase()
          matchedCharter = carrier.underwriting_charters.find(
            (c) => c.legal_name.toLowerCase().includes(cfLower) || cfLower.includes(c.legal_name.toLowerCase())
          ) || null
        }

        return {
          carrier_id: carrier.carrier_id,
          parent_carrier: carrier.parent_brand,
          underwriting_charter: matchedCharter?.legal_name || null,
          naic_code: matchedCharter?.naic || null,
        }
      }
    }

    // Step 3: If we have a short code, look it up directly
    if (parsed.shortCode) {
      const scMatch = byShortCode.get(parsed.shortCode.toLowerCase())
      if (scMatch) {
        return {
          carrier_id: scMatch.carrier.carrier_id,
          parent_carrier: scMatch.carrier.parent_brand,
          underwriting_charter: scMatch.charter.legal_name,
          naic_code: scMatch.charter.naic,
        }
      }
    }

    // Step 4: Fuzzy match on display name
    for (const [key, carrier] of byDisplayLower) {
      if (nameLower.includes(key) || key.includes(nameLower)) {
        return {
          carrier_id: carrier.carrier_id,
          parent_carrier: carrier.parent_brand,
          underwriting_charter: null,
          naic_code: null,
        }
      }
    }

    // Step 5: Fuzzy match on parent brand
    for (const [key, carrier] of byParentLower) {
      if (nameLower.includes(key) || key.includes(nameLower)) {
        return {
          carrier_id: carrier.carrier_id,
          parent_carrier: carrier.parent_brand,
          underwriting_charter: null,
          naic_code: null,
        }
      }
    }

    return null
  }
}

async function updateMedicareAccounts(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean
): Promise<{ total: number; matched: number; unmatched: number; unmatchedNames: Map<string, number> }> {
  console.log('\n' + '='.repeat(60))
  console.log('TASK 3: Updating Medicare accounts with parent carrier mapping')
  console.log('='.repeat(60))

  const matcher = buildCarrierMatcher()

  let totalAccounts = 0
  let matched = 0
  let unmatched = 0
  const unmatchedNames = new Map<string, number>()
  let clientsProcessed = 0

  // Paginate through all clients
  let lastDoc: FirebaseFirestore.DocumentSnapshot | null = null
  const PAGE_SIZE = 200

  while (true) {
    let query = db.collection('clients').orderBy('__name__').limit(PAGE_SIZE)
    if (lastDoc) {
      query = query.startAfter(lastDoc)
    }

    const clientSnap = await query.get()
    if (clientSnap.empty) break
    lastDoc = clientSnap.docs[clientSnap.docs.length - 1]!

    // Process each client's accounts
    for (const clientDoc of clientSnap.docs) {
      const accountsSnap = await db
        .collection('clients')
        .doc(clientDoc.id)
        .collection('accounts')
        .get()

      if (accountsSnap.empty) continue

      // Collect updates for this client's accounts
      const updates: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = []

      for (const accDoc of accountsSnap.docs) {
        const data = accDoc.data()
        const carrierName = data.carrier_name as string | undefined

        if (!carrierName) continue
        totalAccounts++

        const result = matcher(carrierName)
        if (result) {
          matched++
          const updateData: Record<string, unknown> = {
            parent_carrier: result.parent_carrier,
            carrier_id: result.carrier_id,
            updated_at: new Date().toISOString(),
          }
          if (result.underwriting_charter) {
            updateData.underwriting_charter = result.underwriting_charter
          }
          if (result.naic_code) {
            updateData.naic_code = result.naic_code
          }

          updates.push({ ref: accDoc.ref, data: updateData })
        } else {
          unmatched++
          unmatchedNames.set(carrierName, (unmatchedNames.get(carrierName) || 0) + 1)
        }
      }

      // Batch write updates for this client
      if (updates.length > 0 && !dryRun) {
        for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
          const batch = db.batch()
          const chunk = updates.slice(i, i + BATCH_LIMIT)
          for (const u of chunk) {
            batch.update(u.ref, u.data)
          }
          await batch.commit()
        }
      }
    }

    clientsProcessed += clientSnap.size
    process.stdout.write(`\r  Processed ${clientsProcessed} clients, ${totalAccounts} accounts with carrier_name, ${matched} matched, ${unmatched} unmatched`)
  }

  console.log('') // newline after progress
  console.log(`\n  Summary:`)
  console.log(`    Clients processed: ${clientsProcessed}`)
  console.log(`    Accounts with carrier_name: ${totalAccounts}`)
  console.log(`    Matched to parent carrier: ${matched}`)
  console.log(`    Unmatched: ${unmatched}`)

  if (unmatchedNames.size > 0) {
    console.log(`\n  Unmatched carrier names (${unmatchedNames.size} distinct):`)
    const sorted = [...unmatchedNames.entries()].sort((a, b) => b[1] - a[1])
    for (const [name, count] of sorted) {
      console.log(`    ${count}x  "${name}"`)
    }
  }

  if (dryRun) {
    console.log('\n  [DRY RUN — no accounts were updated]')
  }

  return { total: totalAccounts, matched, unmatched, unmatchedNames }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  if (!args.all && !args.firestoreOnly && !args.bigqueryOnly && !args.accountsOnly) {
    console.error('Usage:')
    console.error('  npx tsx services/api/src/scripts/seed-carriers.ts --all')
    console.error('  npx tsx services/api/src/scripts/seed-carriers.ts --firestore-only')
    console.error('  npx tsx services/api/src/scripts/seed-carriers.ts --bigquery-only')
    console.error('  npx tsx services/api/src/scripts/seed-carriers.ts --accounts-only')
    console.error('  npx tsx services/api/src/scripts/seed-carriers.ts --all --dry-run')
    process.exit(1)
  }

  // Initialize Firebase
  if (getApps().length === 0) {
    initializeApp({ projectId: PROJECT_ID })
  }
  const db = getFirestore()

  const runFirestore = args.all || args.firestoreOnly
  const runBigQuery = args.all || args.bigqueryOnly
  const runAccounts = args.all || args.accountsOnly

  console.log(`\nCarrier Seed Script${args.dryRun ? ' [DRY RUN]' : ''}`)
  console.log(`Tasks: ${[runFirestore && 'Firestore carriers', runBigQuery && 'BigQuery mapping', runAccounts && 'Account updates'].filter(Boolean).join(', ')}`)

  // Task 1
  if (runFirestore) {
    const count = await seedFirestoreCarriers(db, args.dryRun)
    console.log(`\n  Task 1 complete: ${count} carrier docs`)
  }

  // Task 2
  if (runBigQuery) {
    const count = await seedBigQueryMapping(args.dryRun)
    console.log(`\n  Task 2 complete: ${count} BigQuery rows`)
  }

  // Task 3
  if (runAccounts) {
    const result = await updateMedicareAccounts(db, args.dryRun)
    console.log(`\n  Task 3 complete: ${result.matched}/${result.total} accounts mapped`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('All tasks complete.')
  console.log('='.repeat(60) + '\n')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
