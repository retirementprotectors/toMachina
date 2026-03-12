// ---------------------------------------------------------------------------
// DEX Rules — 5-layer form selection engine
// Ported from DEX_Rules.gs
//
// Pure functions. No Firestore dependency — forms are passed in.
// ---------------------------------------------------------------------------

import type {
  DexForm,
  DexRuleParams,
  DexRuleResult,
  DexRuleLayers,
  DexRuleFormEntry,
} from './types'
import { RuleLayer } from './types'

// ============================================================================
// TAF (Transaction Authorization Form) mapping by platform — 13 platforms
// ============================================================================

export const TAF_MAP: Record<string, string | null> = {
  'GWM (Schwab)': 'Gradient Wealth Management TAF',
  'RBC Brokerage': 'RBC TAF',
  'VA (Direct)': 'Variable Annuity TAF',
  'FIA (Direct)': 'Fixed Annuity TAF (Non-FMO)',
  'VUL (Direct)': 'Variable Universal Life TAF',
  'MF (Direct)': 'Mutual Fund TAF',
  'REIT': 'REIT TAF',
  '401k': 'Financial Planning TAF',
  'Financial Planning': 'Financial Planning TAF',
  'Estate Guru': null,
  'Medicare Advantage': null,
  'Medicare Supplement': null,
  'Part D': null,
}

// ============================================================================
// Main Rule Engine
// ============================================================================

/**
 * Evaluate the 5-layer rule engine and return the list of required forms.
 *
 * @param params        - Kit parameters (platform, registration type, etc.)
 * @param allForms      - Full form library to search against
 * @returns             - Layered result with all matched forms
 */
export function evaluateRules(params: DexRuleParams, allForms: DexForm[]): DexRuleResult {
  const layers: DexRuleLayers = {
    firmClient: [],
    firmAccount: [],
    productClient: [],
    supporting: [],
    disclosures: [],
  }

  // -------------------------------------------------------------------------
  // Layer 1: Firm:Client Forms (almost always required)
  // -------------------------------------------------------------------------
  if (params.platform !== '401k') {
    const comra = findForm(allForms, 'COMRA')
    if (comra) layers.firmClient.push(toEntry(comra, RuleLayer.FIRM_CLIENT))

    const caf = findForm(allForms, 'Client Account Form')
    if (caf && !caf.form_name.includes('Legal Entity')) {
      layers.firmClient.push(toEntry(caf, RuleLayer.FIRM_CLIENT))
    }
  } else {
    // 401k uses Legal Entity CAF
    const legalCaf = findForm(allForms, 'Legal Entity Client Account Form')
    if (legalCaf) layers.firmClient.push(toEntry(legalCaf, RuleLayer.FIRM_CLIENT))
  }

  // -------------------------------------------------------------------------
  // Layer 2: Firm:Account Forms (TAF based on platform)
  // -------------------------------------------------------------------------
  const tafName = TAF_MAP[params.platform]
  if (tafName) {
    const taf = findForm(allForms, tafName)
    if (taf) layers.firmAccount.push(toEntry(taf, RuleLayer.FIRM_ACCOUNT))
  }

  // IAA for advisory platforms
  if (['GWM (Schwab)', 'RBC Brokerage', 'Financial Planning'].includes(params.platform)) {
    const iaa = findForm(allForms, 'Investment Advisory Agreement')
    if (iaa) layers.firmAccount.push(toEntry(iaa, RuleLayer.FIRM_ACCOUNT))
  }

  // L-Share Letter for L-Share VAs
  if (params.isLShare && params.platform === 'VA (Direct)') {
    const lshare = findForm(allForms, 'L-Share Letter')
    if (lshare) layers.firmAccount.push(toEntry(lshare, RuleLayer.FIRM_ACCOUNT))
  }

  // -------------------------------------------------------------------------
  // Layer 3: Product:Client Forms
  // -------------------------------------------------------------------------

  // GI Forms for GWM platform
  if (params.platform === 'GWM (Schwab)') {
    const giDisclosure = findForm(allForms, 'GI Disclosure Statement')
    if (giDisclosure) layers.productClient.push(toEntry(giDisclosure, RuleLayer.PRODUCT_CLIENT))

    const giProposal = findForm(allForms, 'GI Investment Proposal')
    if (giProposal) layers.productClient.push(toEntry(giProposal, RuleLayer.PRODUCT_CLIENT))

    // GI Schedules
    const schedules = findForms(allForms, 'Schedule').filter((f) => f.source === 'GI')
    for (const s of schedules) {
      layers.productClient.push(toEntry(s, RuleLayer.PRODUCT_CLIENT))
    }

    // Schwab forms based on registration type
    addSchwabForms(layers.productClient, params, allForms)
  }

  // RBC Forms
  if (params.platform === 'RBC Brokerage') {
    addRBCForms(layers.productClient, params, allForms)
  }

  // Carrier forms for direct products
  if (['VA (Direct)', 'FIA (Direct)', 'VUL (Direct)'].includes(params.platform)) {
    const carrierApp = findForm(allForms, 'Carrier Application')
    if (carrierApp) layers.productClient.push(toEntry(carrierApp, RuleLayer.PRODUCT_CLIENT))
  }

  // Estate Guru forms
  if (params.platform === 'Estate Guru') {
    const egForms = findForms(allForms, 'Estate Guru')
    for (const f of egForms) {
      layers.productClient.push(toEntry(f, RuleLayer.PRODUCT_CLIENT))
    }
  }

  // -------------------------------------------------------------------------
  // Layer 4: Supporting Documentation
  // -------------------------------------------------------------------------
  if (params.isTrust) {
    const trustCert = findForm(allForms, 'Certificate of Investment Powers')
    if (trustCert) layers.supporting.push(toEntry(trustCert, RuleLayer.SUPPORTING))

    const trustDocs = findForm(allForms, 'Copy of Original Trust')
    if (trustDocs) layers.supporting.push(toEntry(trustDocs, RuleLayer.SUPPORTING))
  }

  // AdvisoryLink for RBC
  if (params.platform === 'RBC Brokerage') {
    const advisoryLink = findForm(allForms, 'AdvisoryLink Proposal')
    if (advisoryLink) layers.supporting.push(toEntry(advisoryLink, RuleLayer.SUPPORTING))
  }

  // -------------------------------------------------------------------------
  // Layer 5: Disclosures
  // -------------------------------------------------------------------------
  addDisclosures(layers.disclosures, params, allForms)

  // Combine all forms
  const allFormEntries = [
    ...layers.firmClient,
    ...layers.firmAccount,
    ...layers.productClient,
    ...layers.supporting,
    ...layers.disclosures,
  ]

  return {
    layers,
    allForms: allFormEntries,
    formCount: allFormEntries.length,
  }
}

// ============================================================================
// Schwab Forms
// ============================================================================

/**
 * Add Schwab-specific forms based on registration type and account action.
 */
export function addSchwabForms(
  productForms: DexRuleFormEntry[],
  params: DexRuleParams,
  allForms: DexForm[],
): void {
  const findSchwab = (pattern: string) =>
    allForms.find(
      (f) =>
        f.form_name.toLowerCase().includes(pattern.toLowerCase()) &&
        f.source === 'Schwab',
    )

  // LPOA for transfers
  if (params.accountAction === 'LPOA/Transfer') {
    const lpoa = findSchwab('LPOA')
    if (lpoa) productForms.push(toEntry(lpoa, RuleLayer.PRODUCT_CLIENT))
  }

  // Account application based on registration
  if (params.accountAction === 'New Account' || params.accountAction === 'ACAT Transfer') {
    if (
      params.registrationType === 'Traditional IRA' ||
      params.registrationType === 'Roth IRA'
    ) {
      const iraApp = findSchwab('IRA Account Application')
      if (iraApp) productForms.push(toEntry(iraApp, RuleLayer.PRODUCT_CLIENT))
    } else if (
      params.registrationType === 'Individual (NQ)' ||
      params.registrationType === 'Joint WROS'
    ) {
      const nqApp = findSchwab('SchwabOne')
      if (nqApp) productForms.push(toEntry(nqApp, RuleLayer.PRODUCT_CLIENT))
    }
  }

  // ACAT Transfer form
  if (params.accountAction === 'ACAT Transfer') {
    const acat = findSchwab('Account Transfer - ACAT')
    if (acat) productForms.push(toEntry(acat, RuleLayer.PRODUCT_CLIENT))
  }

  // Beneficiary for non-qualified
  if (
    params.registrationType === 'Individual (NQ)' ||
    params.registrationType === 'Joint WROS'
  ) {
    const tod = findSchwab('Transfer on Death Beneficiary')
    if (tod) productForms.push(toEntry(tod, RuleLayer.PRODUCT_CLIENT))
  }

  // ACH Authorization (optional but common)
  const ach = findSchwab('ACH')
  if (ach) productForms.push(toEntry(ach, RuleLayer.PRODUCT_CLIENT))
}

// ============================================================================
// RBC Forms
// ============================================================================

/**
 * Add RBC-specific forms based on registration type and account action.
 */
export function addRBCForms(
  productForms: DexRuleFormEntry[],
  params: DexRuleParams,
  allForms: DexForm[],
): void {
  const findRBC = (pattern: string) =>
    allForms.find(
      (f) =>
        f.form_name.toLowerCase().includes(pattern.toLowerCase()) &&
        f.source === 'RBC',
    )

  // Account application based on registration
  if (
    params.registrationType === 'Traditional IRA' ||
    params.registrationType === 'Roth IRA'
  ) {
    const iraApp = findRBC('RBC IRA Account Application')
    if (iraApp) productForms.push(toEntry(iraApp, RuleLayer.PRODUCT_CLIENT))
  } else if (
    params.registrationType === 'Individual (NQ)' ||
    params.registrationType === 'Joint WROS'
  ) {
    const nqApp = findRBC('RBC Individual/Joint')
    if (nqApp) productForms.push(toEntry(nqApp, RuleLayer.PRODUCT_CLIENT))
  } else if (params.registrationType === 'Trust') {
    const trustApp = findRBC('RBC Trust Account')
    if (trustApp) productForms.push(toEntry(trustApp, RuleLayer.PRODUCT_CLIENT))
  }

  // ACAT Transfer
  if (params.accountAction === 'ACAT Transfer') {
    const acat = findRBC('RBC Account Transfer')
    if (acat) productForms.push(toEntry(acat, RuleLayer.PRODUCT_CLIENT))
  }

  // Beneficiary
  const bene = findRBC('RBC Beneficiary')
  if (bene) productForms.push(toEntry(bene, RuleLayer.PRODUCT_CLIENT))

  // ACH
  const ach = findRBC('RBC ACH')
  if (ach) productForms.push(toEntry(ach, RuleLayer.PRODUCT_CLIENT))
}

// ============================================================================
// Disclosures
// ============================================================================

/**
 * Add required disclosure forms based on platform.
 */
export function addDisclosures(
  disclosureForms: DexRuleFormEntry[],
  params: DexRuleParams,
  allForms: DexForm[],
): void {
  // GS CRS always required
  const gsCRS = findForm(allForms, 'GS Client Relationship Summary')
  if (gsCRS) disclosureForms.push(toEntry(gsCRS, RuleLayer.DISCLOSURES))

  // GI Disclosures for GWM
  if (params.platform === 'GWM (Schwab)') {
    const giPrivacy = findForm(allForms, 'GI Privacy Policy')
    if (giPrivacy) disclosureForms.push(toEntry(giPrivacy, RuleLayer.DISCLOSURES))

    const giCRS = findForm(allForms, 'GI Form CRS')
    if (giCRS) disclosureForms.push(toEntry(giCRS, RuleLayer.DISCLOSURES))

    const giADV = findForm(allForms, 'GI Form ADV')
    if (giADV) disclosureForms.push(toEntry(giADV, RuleLayer.DISCLOSURES))
  }

  // 401k specific
  if (params.platform === '401k') {
    const disclosure408 = findForm(allForms, '408(b)(2)')
    if (disclosure408) disclosureForms.push(toEntry(disclosure408, RuleLayer.DISCLOSURES))
  }
}

// ============================================================================
// Condition Checks
// ============================================================================

/**
 * Check if a specific form should be included based on conditions.
 */
export function checkConditions(form: DexForm, params: DexRuleParams): boolean {
  // Trust documents only for trusts
  if (form.form_name.includes('Trust') && !params.isTrust) {
    return false
  }
  // L-Share only for L-Share VAs
  if (form.form_name.includes('L-Share') && !params.isLShare) {
    return false
  }
  return true
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Find first form whose name contains the pattern (case-insensitive). */
function findForm(forms: DexForm[], pattern: string): DexForm | undefined {
  return forms.find((f) =>
    f.form_name.toLowerCase().includes(pattern.toLowerCase()),
  )
}

/** Find all forms whose name contains the pattern (case-insensitive). */
function findForms(forms: DexForm[], pattern: string): DexForm[] {
  return forms.filter((f) =>
    f.form_name.toLowerCase().includes(pattern.toLowerCase()),
  )
}

/** Convert a DexForm into a DexRuleFormEntry with a layer tag. */
function toEntry(form: DexForm, layer: RuleLayer): DexRuleFormEntry {
  return {
    form_id: form.form_id,
    form_name: form.form_name,
    source: form.source,
    category: form.category,
    layer,
  }
}
