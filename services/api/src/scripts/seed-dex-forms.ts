/**
 * DEX Forms Seeder — Complete form library for the Kit Builder
 *
 * Seeds the `dex_forms` Firestore collection with ~66 forms spanning:
 *   - Firm:Client forms (COMRA, CAF, Legal Entity CAF)
 *   - Firm:Account forms (TAFs by platform, IAA, L-Share Letter)
 *   - Product:Schwab forms (LPOA, IRA App, SchwabOne, ACAT, TOD, ACH)
 *   - Product:RBC forms (IRA App, Individual/Joint, Trust, Transfer, Bene, ACH)
 *   - Product:GI forms (Disclosure, Investment Proposal, Schedules A-F)
 *   - Product:Carrier forms (Carrier Application placeholder)
 *   - Disclosure forms (GS CRS, GI Privacy, GI Form CRS, GI Form ADV, 408(b)(2))
 *   - Supporting forms (Trust docs, AdvisoryLink)
 *   - Estate Guru forms
 *
 * Data ported from DEX_FormLibrary.gs + DEX_Rules.gs form references.
 * Known Google Drive file IDs embedded for forms with existing PDFs.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/seed-dex-forms.ts --all
 *   npx tsx services/api/src/scripts/seed-dex-forms.ts --all --dry-run
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { COLLECTIONS, SOURCES, CATEGORIES } from '../../../../packages/core/src/dex/config'
import type { DexForm } from '../../../../packages/core/src/dex/types'
import { FormStatus } from '../../../../packages/core/src/dex/types'

// ============================================================================
// Constants
// ============================================================================

const BATCH_LIMIT = 500

// Known Google Drive file IDs (PDFs already uploaded)
const DRIVE_IDS: Record<string, string> = {
  CAF: '1S544tn5hUOjx3Jv3Zm4ihWKKgMUvX9-6',
  IAA: '1bqv_4Yj75fDuS9hR1ngRLHrsDwQQp70T',
  GWM_TAF: '1vae_EWYZlP5JxyQ5CY4bRF9YgKieKxOB',
  COMRA: '1shq2PhUZFFw3tI5Wud-YhQjNsOwMUpTh',
  SCHWAB_LPOA: '1c0JHFoDoiCPYBhfxuugvuHjVrh45rdar',
  RBC_TAF: '14Sl2XRseLVMNdlcIi3gERKqnU8D6wd01',
  IRA_ADOPTION: '1hK_XGcIzvqsoH4PC4FaUuZvZ7Cn3q3Om',
  GI_DISCLOSURE: '16WqzfN3CnYvIi0z9jgeeg0EyXg6z-om9',
  GI_PRIVACY: '1JOoLjitY11WmrxjgKQjp4l0WibKKxW26',
  FORM_CRS: '18oeJxm_gbblraDvZzCFjTHLY3L_Vhytm',
  GI_ADV: '1rxjUz-HV4IQau8dpcN8NsRLv5I6Unbfb',
  INVESTMENT_PROPOSAL: '1rOaigKmRLOThHUGOkF1JXLlXhTpzLyPx',
  RBC_TRANSFER: '1SE3sYXo64eTJhECYWTBazCLiH3IowjCp',
  RBC_IRA_KIT: '1Cul6_I2yeIU89TitVntTbt4cVLjRp4CX',
}

function driveUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`
}

// ============================================================================
// Form Data (~66 forms)
// ============================================================================

const FORMS: DexForm[] = [
  // ---------------------------------------------------------------------------
  // Layer 1: Firm:Client Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0001',
    form_name: 'COMRA - Client Onboarding & Mutual Risk Assessment',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_CLIENT,
    status: FormStatus.ACTIVE,
    document_type: 'compliance',
    pdf_template_id: DRIVE_IDS.COMRA,
    notes: 'Required for all non-401k platforms. Captures risk tolerance, investment experience.',
  },
  {
    form_id: 'FORM_0002',
    form_name: 'Client Account Form (CAF)',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_CLIENT,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    pdf_template_id: DRIVE_IDS.CAF,
    notes: 'Master client info form. 3 pages: demographics, financial, trusted contact. "Home Phone" field = email position.',
  },
  {
    form_id: 'FORM_0003',
    form_name: 'Legal Entity Client Account Form',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_CLIENT,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    notes: '401k/ERISA-specific CAF for entities, trusts, partnerships.',
  },

  // ---------------------------------------------------------------------------
  // Layer 2: Firm:Account Forms — TAFs
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0004',
    form_name: 'Gradient Wealth Management TAF',
    source: SOURCES.GWM,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    pdf_template_id: DRIVE_IDS.GWM_TAF,
    notes: 'GWM (Schwab) platform TAF. Contains BI narrative, fee grid, product comparison.',
  },
  {
    form_id: 'FORM_0005',
    form_name: 'RBC TAF',
    source: SOURCES.RBC,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    pdf_template_id: DRIVE_IDS.RBC_TAF,
    notes: 'RBC Brokerage platform TAF.',
  },
  {
    form_id: 'FORM_0006',
    form_name: 'Variable Annuity TAF',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'VA (Direct) platform TAF.',
  },
  {
    form_id: 'FORM_0007',
    form_name: 'Fixed Annuity TAF (Non-FMO)',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'FIA (Direct) platform TAF.',
  },
  {
    form_id: 'FORM_0008',
    form_name: 'Variable Universal Life TAF',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'VUL (Direct) platform TAF.',
  },
  {
    form_id: 'FORM_0009',
    form_name: 'Mutual Fund TAF',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'MF (Direct) platform TAF.',
  },
  {
    form_id: 'FORM_0010',
    form_name: 'REIT TAF',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'REIT platform TAF.',
  },
  {
    form_id: 'FORM_0011',
    form_name: 'Financial Planning TAF',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: '401k and Financial Planning platform TAF.',
  },

  // Firm:Account — IAA & L-Share
  {
    form_id: 'FORM_0012',
    form_name: 'Investment Advisory Agreement (IAA)',
    source: SOURCES.GWM,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'agreement',
    pdf_template_id: DRIVE_IDS.IAA,
    notes: 'Required for advisory platforms: GWM (Schwab), RBC Brokerage, Financial Planning.',
  },
  {
    form_id: 'FORM_0013',
    form_name: 'L-Share Letter',
    source: SOURCES.GS,
    category: CATEGORIES.FIRM_ACCOUNT,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    notes: 'Required only for L-Share Variable Annuity transactions.',
  },

  // ---------------------------------------------------------------------------
  // Layer 3: Product:Schwab Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0014',
    form_name: 'Schwab LPOA (Limited Power of Attorney)',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    pdf_template_id: DRIVE_IDS.SCHWAB_LPOA,
    notes: 'Required for LPOA/Transfer action on GWM (Schwab) platform.',
  },
  {
    form_id: 'FORM_0015',
    form_name: 'Schwab IRA Account Application',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    pdf_template_id: DRIVE_IDS.IRA_ADOPTION,
    notes: 'New Account or ACAT for Traditional/Roth IRA registrations.',
  },
  {
    form_id: 'FORM_0016',
    form_name: 'SchwabOne Individual/Joint Account Application',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    notes: 'New Account or ACAT for Individual (NQ) and Joint WROS registrations.',
  },
  {
    form_id: 'FORM_0017',
    form_name: 'Schwab Account Transfer - ACAT',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'transfer',
    notes: 'Required for ACAT Transfer action on GWM (Schwab).',
  },
  {
    form_id: 'FORM_0018',
    form_name: 'Schwab Transfer on Death Beneficiary Designation',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'beneficiary',
    notes: 'Required for Individual (NQ) and Joint WROS on Schwab.',
  },
  {
    form_id: 'FORM_0019',
    form_name: 'Schwab ACH Authorization',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'Optional but common. Authorizes electronic funds transfer.',
  },
  {
    form_id: 'FORM_0020',
    form_name: 'Schwab Trust Account Application',
    source: SOURCES.SCHWAB,
    category: CATEGORIES.PRODUCT_SCHWAB,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    notes: 'New Account or ACAT for Trust registrations on Schwab.',
  },

  // ---------------------------------------------------------------------------
  // Layer 3: Product:RBC Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0021',
    form_name: 'RBC IRA Account Application',
    source: SOURCES.RBC,
    category: CATEGORIES.PRODUCT_RBC,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    pdf_template_id: DRIVE_IDS.RBC_IRA_KIT,
    notes: 'Traditional/Roth IRA on RBC Brokerage.',
  },
  {
    form_id: 'FORM_0022',
    form_name: 'RBC Individual/Joint Account Application',
    source: SOURCES.RBC,
    category: CATEGORIES.PRODUCT_RBC,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    notes: 'Individual (NQ) and Joint WROS on RBC Brokerage.',
  },
  {
    form_id: 'FORM_0023',
    form_name: 'RBC Trust Account Application',
    source: SOURCES.RBC,
    category: CATEGORIES.PRODUCT_RBC,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    notes: 'Trust registration on RBC Brokerage.',
  },
  {
    form_id: 'FORM_0024',
    form_name: 'RBC Account Transfer Form',
    source: SOURCES.RBC,
    category: CATEGORIES.PRODUCT_RBC,
    status: FormStatus.ACTIVE,
    document_type: 'transfer',
    pdf_template_id: DRIVE_IDS.RBC_TRANSFER,
    notes: 'Required for ACAT Transfer action on RBC Brokerage.',
  },
  {
    form_id: 'FORM_0025',
    form_name: 'RBC Beneficiary Designation',
    source: SOURCES.RBC,
    category: CATEGORIES.PRODUCT_RBC,
    status: FormStatus.ACTIVE,
    document_type: 'beneficiary',
    notes: 'Always included for RBC Brokerage.',
  },
  {
    form_id: 'FORM_0026',
    form_name: 'RBC ACH Authorization',
    source: SOURCES.RBC,
    category: CATEGORIES.PRODUCT_RBC,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'Always included for RBC Brokerage.',
  },

  // ---------------------------------------------------------------------------
  // Layer 3: Product:GI Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0027',
    form_name: 'GI Disclosure Statement',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    pdf_template_id: DRIVE_IDS.GI_DISCLOSURE,
    notes: 'Required for GWM (Schwab) platform.',
  },
  {
    form_id: 'FORM_0028',
    form_name: 'GI Investment Proposal',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'proposal',
    pdf_template_id: DRIVE_IDS.INVESTMENT_PROPOSAL,
    notes: 'Required for GWM (Schwab) platform.',
  },
  {
    form_id: 'FORM_0029',
    form_name: 'GI Schedule A - Fee Schedule',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'schedule',
    notes: 'GWM fee schedule attachment.',
  },
  {
    form_id: 'FORM_0030',
    form_name: 'GI Schedule B - Investment Strategy',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'schedule',
    notes: 'GWM investment strategy attachment.',
  },
  {
    form_id: 'FORM_0031',
    form_name: 'GI Schedule C - Wrap Fee Program',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'schedule',
    notes: 'GWM wrap fee program attachment.',
  },
  {
    form_id: 'FORM_0032',
    form_name: 'GI Schedule D - Model Portfolio',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'schedule',
    notes: 'GWM model portfolio attachment.',
  },
  {
    form_id: 'FORM_0033',
    form_name: 'GI Schedule E - Additional Services',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'schedule',
    notes: 'GWM additional services attachment.',
  },
  {
    form_id: 'FORM_0034',
    form_name: 'GI Schedule F - TPMM Authorization',
    source: SOURCES.GI,
    category: CATEGORIES.PRODUCT_GI,
    status: FormStatus.ACTIVE,
    document_type: 'schedule',
    notes: 'GWM third-party money manager authorization.',
  },

  // ---------------------------------------------------------------------------
  // Layer 3: Product:Carrier (Direct Products)
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0035',
    form_name: 'Carrier Application (Variable Annuity)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'Carrier-specific app. Used for VA (Direct), FIA (Direct), VUL (Direct). Template varies by carrier.',
  },
  {
    form_id: 'FORM_0036',
    form_name: 'Carrier Application (Fixed Index Annuity)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'FIA carrier-specific application. Carrier determines exact form.',
  },
  {
    form_id: 'FORM_0037',
    form_name: 'Carrier Application (Variable Universal Life)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'VUL carrier-specific application. Carrier determines exact form.',
  },
  {
    form_id: 'FORM_0038',
    form_name: 'Carrier Application (Term Life)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'Term life carrier-specific application.',
  },
  {
    form_id: 'FORM_0039',
    form_name: 'Carrier Application (IUL)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'Indexed Universal Life carrier-specific application.',
  },
  {
    form_id: 'FORM_0040',
    form_name: 'Carrier Application (Survivorship Life)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'Survivorship life carrier-specific application.',
  },
  {
    form_id: 'FORM_0041',
    form_name: '1035 Exchange Request Form',
    source: SOURCES.GS,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.ACTIVE,
    document_type: 'transfer',
    notes: 'Tax-free insurance policy transfer request.',
  },

  // ---------------------------------------------------------------------------
  // Layer 4: Supporting Documentation
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0042',
    form_name: 'Certificate of Investment Powers (Trust)',
    source: SOURCES.GS,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'supporting',
    notes: 'Required when registration type is Trust.',
  },
  {
    form_id: 'FORM_0043',
    form_name: 'Copy of Original Trust Agreement',
    source: SOURCES.CLIENT,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'supporting',
    notes: 'Client provides. Required for Trust registrations.',
  },
  {
    form_id: 'FORM_0044',
    form_name: 'AdvisoryLink Proposal',
    source: SOURCES.RBC,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'proposal',
    notes: 'Supporting document for RBC Brokerage platform.',
  },
  {
    form_id: 'FORM_0045',
    form_name: 'Beneficiary Designation (Generic)',
    source: SOURCES.GS,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'beneficiary',
    notes: 'Generic beneficiary form when custodian-specific not available.',
  },
  {
    form_id: 'FORM_0046',
    form_name: 'IRA Adoption Agreement',
    source: SOURCES.GS,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'agreement',
    pdf_template_id: DRIVE_IDS.IRA_ADOPTION,
    notes: 'Standard IRA adoption agreement.',
  },

  // ---------------------------------------------------------------------------
  // Layer 5: Disclosure Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0047',
    form_name: 'GS Client Relationship Summary (Form CRS)',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    pdf_template_id: DRIVE_IDS.FORM_CRS,
    notes: 'Always required. Gradient Securities CRS.',
  },
  {
    form_id: 'FORM_0048',
    form_name: 'GI Privacy Policy',
    source: SOURCES.GI,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    pdf_template_id: DRIVE_IDS.GI_PRIVACY,
    notes: 'Required for GWM (Schwab) platform.',
  },
  {
    form_id: 'FORM_0049',
    form_name: 'GI Form CRS',
    source: SOURCES.GI,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    notes: 'Required for GWM (Schwab) platform. Gradient Investments Form CRS.',
  },
  {
    form_id: 'FORM_0050',
    form_name: 'GI Form ADV Part 2A',
    source: SOURCES.GI,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    pdf_template_id: DRIVE_IDS.GI_ADV,
    notes: 'Required for GWM (Schwab) platform. Gradient Investments Form ADV.',
  },
  {
    form_id: 'FORM_0051',
    form_name: '408(b)(2) Fee Disclosure',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    notes: 'Required for 401k platform. ERISA fee disclosure.',
  },
  {
    form_id: 'FORM_0052',
    form_name: 'Reg BI Disclosure',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    notes: 'Regulation Best Interest disclosure.',
  },

  // ---------------------------------------------------------------------------
  // Estate Guru Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0053',
    form_name: 'Estate Guru Client Intake',
    source: SOURCES.ADVISOR,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.TBD,
    document_type: 'intake',
    notes: 'Estate Guru platform intake form.',
  },
  {
    form_id: 'FORM_0054',
    form_name: 'Estate Guru Planning Questionnaire',
    source: SOURCES.ADVISOR,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.TBD,
    document_type: 'questionnaire',
    notes: 'Estate Guru platform planning questionnaire.',
  },
  {
    form_id: 'FORM_0055',
    form_name: 'Estate Guru Legacy Blueprint',
    source: SOURCES.ADVISOR,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.TBD,
    document_type: 'plan',
    notes: 'Estate Guru platform legacy blueprint document.',
  },

  // ---------------------------------------------------------------------------
  // Medicare / Health Forms
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0056',
    form_name: 'Medicare Enrollment Application (CMS)',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.ACTIVE,
    document_type: 'enrollment',
    notes: 'Standard CMS enrollment form for MAPD/MA/PDP.',
  },
  {
    form_id: 'FORM_0057',
    form_name: 'Medicare Supplement Application',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.ACTIVE,
    document_type: 'application',
    notes: 'Medigap application. Carrier-specific form.',
  },
  {
    form_id: 'FORM_0058',
    form_name: 'Scope of Appointment (SOA)',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'compliance',
    notes: 'CMS-required SOA before Medicare sales conversations.',
  },
  {
    form_id: 'FORM_0059',
    form_name: 'Medicare Enrollment Disclaimer',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    notes: 'Standard Medicare enrollment disclosure.',
  },

  // ---------------------------------------------------------------------------
  // Additional Forms (MYGA, SPIA, etc.)
  // ---------------------------------------------------------------------------
  {
    form_id: 'FORM_0060',
    form_name: 'MYGA Application',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'Multi-Year Guaranteed Annuity application. Carrier-specific.',
  },
  {
    form_id: 'FORM_0061',
    form_name: 'SPIA Application',
    source: SOURCES.CARRIER,
    category: CATEGORIES.PRODUCT_CARRIER,
    status: FormStatus.TBD,
    document_type: 'application',
    notes: 'Single Premium Immediate Annuity application. Carrier-specific.',
  },
  {
    form_id: 'FORM_0062',
    form_name: 'Rollover Certification Form',
    source: SOURCES.GS,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'certification',
    notes: 'Required when rolling over from 401k/403b/457 to IRA.',
  },
  {
    form_id: 'FORM_0063',
    form_name: 'ACH Direct Deposit Authorization (Generic)',
    source: SOURCES.GS,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'authorization',
    notes: 'Generic ACH form when custodian-specific not available.',
  },
  {
    form_id: 'FORM_0064',
    form_name: 'Annuity Replacement Notice',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.ACTIVE,
    document_type: 'disclosure',
    notes: 'State-required replacement notice when exchanging annuity.',
  },
  {
    form_id: 'FORM_0065',
    form_name: 'State Replacement Form',
    source: SOURCES.GS,
    category: CATEGORIES.DISCLOSURE,
    status: FormStatus.TBD,
    document_type: 'disclosure',
    notes: 'State-specific replacement disclosure. Varies by state.',
  },
  {
    form_id: 'FORM_0066',
    form_name: 'Anti-Money Laundering (AML) Questionnaire',
    source: SOURCES.GS,
    category: CATEGORIES.SUPPORTING,
    status: FormStatus.ACTIVE,
    document_type: 'compliance',
    notes: 'Required for accounts over certain thresholds or flagged profiles.',
  },
]

// ============================================================================
// CLI
// ============================================================================

interface CliArgs {
  all: boolean
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { all: false, dryRun: false }

  for (const arg of args) {
    if (arg === '--all') result.all = true
    else if (arg === '--dry-run') result.dryRun = true
  }

  return result
}

// ============================================================================
// Seed Logic
// ============================================================================

async function seedForms(
  db: FirebaseFirestore.Firestore,
  dryRun: boolean,
): Promise<number> {
  const now = new Date().toISOString()
  const writes: Array<{ docId: string; data: Record<string, unknown> }> = []

  for (const form of FORMS) {
    writes.push({
      docId: form.form_id,
      data: {
        ...form,
        created_at: now,
        updated_at: now,
        _created_by: 'seed-dex-forms',
      },
    })
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would write ${writes.length} docs to ${COLLECTIONS.FORMS}:`)
    for (const w of writes) {
      const form = FORMS.find((f) => f.form_id === w.docId)!
      console.log(`  ${w.docId} — ${form.form_name} [${form.source}/${form.category}]`)
    }
    return writes.length
  }

  // Batched writes
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch()
    const chunk = writes.slice(i, i + BATCH_LIMIT)

    for (const w of chunk) {
      const ref = db.collection(COLLECTIONS.FORMS).doc(w.docId)
      batch.set(ref, w.data)
    }

    await batch.commit()
    console.log(`  Committed batch ${Math.floor(i / BATCH_LIMIT) + 1} (${chunk.length} docs)`)
  }

  return writes.length
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs()

  if (!args.all) {
    console.error('Usage:')
    console.error('  npx tsx services/api/src/scripts/seed-dex-forms.ts --all')
    console.error('  npx tsx services/api/src/scripts/seed-dex-forms.ts --all --dry-run')
    process.exit(1)
  }

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const serviceAccount = require(process.env.GOOGLE_APPLICATION_CREDENTIALS)
      initializeApp({ credential: cert(serviceAccount) })
    } else {
      initializeApp()
    }
  }
  const db = getFirestore()

  console.log(`\nSeeding DEX forms (${FORMS.length} forms)${args.dryRun ? ' [DRY RUN]' : ''}...\n`)

  const count = await seedForms(db, args.dryRun)

  // Print summary by category
  const byCat: Record<string, number> = {}
  for (const f of FORMS) {
    byCat[f.category] = (byCat[f.category] || 0) + 1
  }
  const byStatus: Record<string, number> = {}
  for (const f of FORMS) {
    byStatus[f.status] = (byStatus[f.status] || 0) + 1
  }

  console.log('='.repeat(60))
  console.log(`TOTAL: ${count} forms seeded to ${COLLECTIONS.FORMS}`)
  console.log('')
  console.log('By category:')
  for (const [cat, n] of Object.entries(byCat).sort()) {
    console.log(`  ${cat}: ${n}`)
  }
  console.log('')
  console.log('By status:')
  for (const [st, n] of Object.entries(byStatus).sort()) {
    console.log(`  ${st}: ${n}`)
  }
  console.log('')
  console.log(`Forms with PDF templates: ${FORMS.filter((f) => f.pdf_template_id).length}`)
  if (args.dryRun) console.log('[DRY RUN - no data was written to Firestore]')
  console.log('')
}

main().catch((err) => {
  console.error('Seed script failed:', err)
  process.exit(1)
})
