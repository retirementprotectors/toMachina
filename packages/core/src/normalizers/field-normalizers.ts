/**
 * Field-to-normalizer mapping and alias maps.
 * Ported from RAPID_CORE CORE_Database.gs FIELD_NORMALIZERS (lines 1278-1369)
 * and CORE_Normalize.gs alias constants.
 *
 * 16 normalizer types applied to 90+ fields.
 */

// ============================================================================
// NORMALIZER TYPE DEFINITION
// ============================================================================

export type NormalizerType =
  | 'name'
  | 'phone'
  | 'email'
  | 'date'
  | 'state'
  | 'zip'
  | 'amount'
  | 'carrier'
  | 'product'
  | 'product_name'
  | 'plan_name'
  | 'imo'
  | 'status'
  | 'bob'
  | 'address'
  | 'city'
  | 'skip'

// ============================================================================
// FIELD → NORMALIZER MAP (90+ fields)
// ============================================================================

export const FIELD_NORMALIZERS: Record<string, NormalizerType> = {
  // === Name fields -> normalizeName() ===
  first_name: 'name',
  last_name: 'name',
  middle_name: 'name',
  preferred_name: 'name',
  spouse_name: 'name',
  child_1_name: 'name',
  child_2_name: 'name',
  child_3_name: 'name',
  child_4_name: 'name',
  child_5_name: 'name',
  child_6_name: 'name',
  insured_name: 'name',

  // === Phone fields -> normalizePhone() ===
  phone: 'phone',
  cell_phone: 'phone',
  alternate_phone: 'phone',
  spouse_phone: 'phone',
  contact_phone: 'phone',

  // === Email fields -> normalizeEmail() ===
  email: 'email',
  secondary_email: 'email',
  spouse_email: 'email',
  contact_email: 'email',

  // === Date fields -> normalizeDate() -> YYYY-MM-DD ===
  dob: 'date',
  spouse_dob: 'date',
  insured_dob: 'date',
  effective_date: 'date',
  wedding_date: 'date',
  source_date: 'date',
  issue_date: 'date',
  maturity_date: 'date',
  as_of_date: 'date',
  surrender_period_end: 'date',
  income_start_date: 'date',
  submitted_date: 'date',
  term_date: 'date',
  rate_action_date: 'date',
  soa_date: 'date',
  opened_date: 'date',
  next_premium_due: 'date',
  draft_date: 'date',
  options_approval_date: 'date',
  payoff_date: 'date',
  payment_date: 'date',
  due_date: 'date',
  driver_license_issued: 'date',
  driver_license_expires: 'date',

  // === Skip fields -> never normalize ===
  created_at: 'skip',
  updated_at: 'skip',
  deleted_at: 'skip',
  ghl_created_at: 'skip',
  ghl_updated_at: 'skip',

  // === State fields -> normalizeState() -> 2-letter code ===
  state: 'state',
  mailing_state: 'state',
  driver_license_state: 'state',

  // === Zip fields -> normalizeZip() -> 5 or 5+4 digits ===
  zip: 'zip',
  mailing_zip: 'zip',

  // === Carrier fields -> normalizeCarrierName() ===
  carrier_name: 'carrier',
  custodian: 'carrier',
  institution_name: 'carrier',
  parent_carrier: 'skip',
  carrier_charter: 'skip',
  charter_code: 'skip',
  naic_code: 'skip',
  carrier_id: 'skip',

  // === Product type fields -> normalizeProductType() ===
  product_type: 'product',
  core_product_type: 'product',
  policy_type: 'product',

  // === Product name fields -> normalizeProductName() ===
  product_name: 'product_name',

  // === Plan name fields -> normalizePlanName() ===
  plan_name: 'plan_name',

  // === IMO name fields -> normalizeIMOName() ===
  imo_name: 'imo',

  // === Status fields -> normalizeStatus() ===
  status: 'status',
  client_status: 'status',
  account_status: 'status',
  policy_status: 'status',
  agent_status: 'status',

  // === BoB fields -> normalizeBoB() ===
  book_of_business: 'bob',

  // === Address fields -> normalizeAddress() ===
  address: 'address',
  address_2: 'address',
  mailing_address: 'address',
  mailing_address_2: 'address',

  // === City fields -> normalizeCity() ===
  city: 'city',
  mailing_city: 'city',

  // === Currency/Amount fields -> normalizeAmount() -> number ===
  amount: 'amount',
  value: 'amount',
  premium: 'amount',
  scheduled_premium: 'amount',
  annual_premium: 'amount',
  planned_premium: 'amount',
  commissionable_premium: 'amount',
  monthly_premium: 'amount',
  net_worth: 'amount',
  investable_assets: 'amount',
  household_income: 'amount',
  annual_income: 'amount',
  account_value: 'amount',
  net_deposits: 'amount',
  surrender_value: 'amount',
  death_benefit: 'amount',
  benefit_base: 'amount',
  guaranteed_minimum: 'amount',
  income_gross: 'amount',
  income_net: 'amount',
  income_base: 'amount',
  cash_value: 'amount',
  face_amount: 'amount',
  total_premiums_paid: 'amount',
  loan_balance: 'amount',
  loan_principal: 'amount',
  market_value: 'amount',
  cost_basis: 'amount',
  cash_balance: 'amount',
  margin_balance: 'amount',
  buying_power: 'amount',
  advisory_fees_annual: 'amount',
  prior_year_fmv: 'amount',
  rmd_calculated: 'amount',
  rmd_taken: 'amount',
  rmd_remaining: 'amount',
  balance: 'amount',
  payment_amount: 'amount',
  original_amount: 'amount',
  part_b_premium: 'amount',
  part_d_premium: 'amount',
  part_b_giveback: 'amount',
  drug_deductible: 'amount',
  medical_deductible: 'amount',
  rate_action_premium: 'amount',
  total_discount: 'amount',
}

// ============================================================================
// CARRIER ALIASES (ported from CORE_Normalize.gs CARRIER_ALIASES)
// ============================================================================

export const CARRIER_ALIASES: Record<string, string> = {
  // Aetna family
  'aetna': 'Aetna',
  'aetna medicare': 'Aetna',
  'aetna add charters': 'Aetna',
  'ahic': 'AHIC',
  'aetna ahic aetna health insurance company': 'AHIC',
  'ahlc': 'AHLC',
  'aetna ahlc aetna health life insurance company': 'AHLC',
  'aetna ahlc aetna health  life insurance company': 'AHLC',
  'aetna mapd': 'Aetna',
  'aetna pdp': 'Aetna',
  'aetna life': 'Aetna',
  'aetna cli continental life': 'Continental Life',
  'aetna aci american continental insurance': 'American Continental',

  // UnitedHealthcare
  'uhc': 'UnitedHealthcare',
  'united': 'UnitedHealthcare',
  'united healthcare': 'UnitedHealthcare',
  'unitedhealthcare': 'UnitedHealthcare',
  'aarp': 'UnitedHealthcare',

  // Humana / Anthem
  'humana': 'Humana',
  'anthem': 'Anthem',

  // Cigna family
  'cigna': 'Cigna',
  'cigna add charters': 'Cigna',
  'chlic': 'CHLIC',
  'cigna chlic cigna health life insurance company': 'CHLIC',
  'cigna chlic cigna health  life insurance company': 'CHLIC',
  'cigna-healthspring': 'Cigna-Healthspring',
  'cigna mapd': 'Cigna',
  'cigna pdp': 'Cigna',

  // WellCare / Wellabe
  'wellcare': 'WellCare',
  'well care': 'WellCare',
  'wellabe': 'Wellabe',
  'wellabe fka medico': 'Wellabe',
  'wellabe ml medico life and health insurance company': 'Medico',
  'medico': 'Medico',

  // Devoted / Clover
  'devoted': 'Devoted',
  'clover': 'Clover',

  // BCBS family
  'bcbs': 'BCBS',
  'blue cross': 'BCBS',
  'blue cross blue shield': 'BCBS',
  'bluekc': 'BlueKC',
  'blue kc': 'BlueKC',
  'wellmark bcbs of iowa': 'Wellmark BCBS of Iowa',
  'wellmark': 'Wellmark BCBS of Iowa',
  'elevance anthem bcbs': 'Elevance',
  'elevance': 'Elevance',

  // Mutual of Omaha family
  'mutual of omaha': 'Mutual of Omaha',
  'mutual of omaha add charters': 'Mutual of Omaha',
  'mutual of omaha uo united of omaha': 'United of Omaha',
  'mutual of omaha oic omaha insurance company': 'Omaha Insurance Company',
  'mutual of omaha uw united world': 'United World',
  'moo': 'Mutual of Omaha',

  // CoF
  'catholic order of foresters': 'Catholic Order of Foresters',
  'cof': 'Catholic Order of Foresters',

  // Life/Annuity carriers
  'kansas city life': 'Kansas City Life',
  'kcl': 'Kansas City Life',
  'north american company': 'North American Company',
  'north american': 'North American Company',
  'nac': 'North American Company',
  'national western': 'National Western Life',
  'national western life': 'National Western Life',
  'nwl': 'National Western Life',
  'great western': 'Great Western Insurance',
  'great western insurance': 'Great Western Insurance',
  'american equity': 'American Equity',
  'american equity life': 'American Equity',
  'athene': 'Athene',
  'global atlantic': 'Global Atlantic',

  // GHL compound carrier names
  'central states indemnity': 'Central States Indemnity',
  'silac fka equitable': 'SILAC',
  'silac': 'SILAC',
  'aflac tierone': 'Aflac',
  'aflac': 'Aflac',
  'prosperity fka susa life': 'Prosperity Life',
  'prosperity life': 'Prosperity Life',
  'alignment health': 'Alignment Health',
  'medmutual protect': 'Medical Mutual',
  'medmutual': 'Medical Mutual',
  'medical mutual': 'Medical Mutual',
  'woodmen of the world': 'Woodmen of the World',
  'allstate natgen': 'Allstate',
  'allstate': 'Allstate',
  'delta dental': 'Delta Dental',
  'manhattan life': 'Manhattan Life',
  'guarantee trust life': 'Guarantee Trust Life',
  'gtl': 'Guarantee Trust Life',
  'genworth life': 'Genworth',
  'genworth': 'Genworth',
  'voya ing life': 'Voya',
  'voya ing': 'Voya',
  'voya': 'Voya',
  'midland national': 'Midland National',
  'midland national life': 'Midland National',
  'assurity life': 'Assurity Life',
  'assurity': 'Assurity Life',
  'farm bureau life': 'Farm Bureau Life',
  'farm bureau': 'Farm Bureau Life',
  'united life': 'United Life',
  'northwestern mutual': 'Northwestern Mutual',
  'corebridge aig life': 'Corebridge',
  'corebridge aig': 'Corebridge',
}

// ============================================================================
// PRODUCT TYPE MAP (ported from CORE_Normalize.gs PRODUCT_TYPES)
// ============================================================================

export const PRODUCT_TYPES: Record<string, string> = {
  // Medicare
  'mapd': 'MAPD',
  'mapd medicare advantage': 'MAPD',
  'ma-pd': 'MAPD',
  'medicare advantage': 'MAPD',
  'pdp': 'PDP',
  'part d': 'PDP',
  'dsnp': 'DSNP',
  'csnp': 'CSNP',
  'snp': 'SNP',

  // MedSupp
  'medsup': 'Medicare Supplement',
  'medsupp': 'Medicare Supplement',
  'medigap': 'Medicare Supplement',
  'medicare supplement': 'Medicare Supplement',
  'med supp': 'Medicare Supplement',

  // Life
  'term': 'Term Life',
  'term life': 'Term Life',
  'whole life': 'Whole Life',
  'final expense': 'Final Expense',
  'fe': 'Final Expense',
  'iul': 'IUL',
  'indexed universal life': 'IUL',

  // Annuity
  'annuity': 'Annuity',
  'fia': 'FIA',
  'fixed indexed annuity': 'FIA',
  'fia fixed indexed': 'FIA',
  'fia fixed indexed annuity': 'FIA',
  'myga': 'MYGA',
  'myga multiyear guarantee': 'MYGA',
  'spia': 'SPIA',
  'spia single premium immediate': 'SPIA',
  'variable annuity': 'Variable Annuity',

  // Investments (Securities & Advisory)
  'advisory feebased': 'Advisory (Fee-Based)',
  'advisory fee-based': 'Advisory (Fee-Based)',
  'brokerage commissionbased': 'Brokerage (Commission-Based)',
  'brokerage commission-based': 'Brokerage (Commission-Based)',

  // GHL broad product types
  'medicare': 'Medicare',
  'life': 'Life',
  'annuities': 'Annuity',
  'bd ria': 'Investments',
  'bd/ria': 'Investments',
  'bdria': 'Investments',
  'investments': 'Investments',
  'investment': 'Investments',

  // Ancillary
  'dental': 'Dental',
  'vision': 'Vision',
  'hearing': 'Hearing',
  'dvh': 'DVH',
  'hospital indemnity': 'Hospital Indemnity',
  'cancer': 'Cancer',
  'critical illness': 'Critical Illness',
}

// ============================================================================
// STATUS MAP (ported from CORE_Normalize.gs STATUS_MAP)
// ============================================================================

export const STATUS_MAP: Record<string, string> = {
  // --- Active ---
  'active': 'Active',
  'acive': 'Active',
  'actve': 'Active',
  'a': 'Active',
  'active policy': 'Active',
  'issued': 'Active',
  'enrolled': 'Active',
  'paid up': 'Active',
  // --- Active (Internal/External → just Active for clients) ---
  'active- internal': 'Active',
  'active-internal': 'Active',
  'active - internal': 'Active',
  'internal': 'Active',
  'active- external': 'Active',
  'active-external': 'Active',
  'active - external': 'Active',
  'external': 'Active',
  // --- Affiliate ---
  'active- affiliate ok': 'Active - Affiliate (OK to Market)',
  'active - affiliate ok': 'Active - Affiliate (OK to Market)',
  'active - affiliate ok to market': 'Active - Affiliate (OK to Market)',
  'active- affiliate (ok)': 'Active - Affiliate (OK to Market)',
  'active - affiliate (ok to market)': 'Active - Affiliate (OK to Market)',
  'affiliate ok': 'Active - Affiliate (OK to Market)',
  'active- affiliate do not market': 'Active - Affiliate (Do Not Market)',
  'active - affiliate do not market': 'Active - Affiliate (Do Not Market)',
  'active- affiliate (do not market)': 'Active - Affiliate (Do Not Market)',
  'active - affiliate (do not market)': 'Active - Affiliate (Do Not Market)',
  'affiliate do not market': 'Active - Affiliate (Do Not Market)',
  // --- Prospect ---
  'prospect': 'Prospect',
  'lead': 'Prospect',
  // --- Inactive ---
  'inactive': 'Inactive',
  'inactve': 'Inactive',
  'i': 'Inactive',
  'deleted': 'Inactive',
  'disenrolled': 'Inactive',
  'attrited': 'Inactive',
  'inactive - no active accounts': 'Inactive',
  'inactive- no active accounts': 'Inactive',
  'no active accounts': 'Inactive',
  // --- Inactive - Fired ---
  'inactive - fired': 'Inactive - Fired',
  'inactive- fired': 'Inactive - Fired',
  'fired': 'Inactive - Fired',
  // --- Inactive - Deceased (client) / Deceased (account) ---
  'deceased': 'Deceased',
  'dead': 'Deceased',
  'decease': 'Deceased',
  'death': 'Deceased',
  'inactive - deceased': 'Inactive - Deceased',
  'inactive- deceased': 'Inactive - Deceased',
  'inactive - death claim': 'Inactive - Deceased',
  'inactive- death claim': 'Inactive - Deceased',
  'death claim': 'Inactive - Deceased',
  // --- Inactive - Complaint ---
  'inactive - complaint': 'Inactive - Complaint',
  'inactive- complaint': 'Inactive - Complaint',
  'complaint': 'Inactive - Complaint',
  // --- Pending ---
  'pending': 'Pending',
  'p': 'Pending',
  'application': 'Pending',
  'issued contract': 'Pending',
  'account funding': 'Pending',
  'new business submission': 'Pending',
  'approved pending req': 'Pending',
  'approved, pending req': 'Pending',
  'pending placement': 'Pending',
  'carrier underwriting': 'Pending',
  // --- Terminated ---
  'terminated': 'Terminated',
  'term': 'Terminated',
  't': 'Terminated',
  'term submitted': 'Terminated',
  'pending terminated': 'Terminated',
  'rolled over to aspida': 'Terminated',
  // --- Surrendered ---
  'surrendered': 'Surrendered',
  // --- Cancelled ---
  'cancelled': 'Cancelled',
  'canceled': 'Cancelled',
  'complete': 'Cancelled',
  'completed': 'Cancelled',
  // --- Lapsed ---
  'lapsed': 'Lapsed',
  // --- Matured ---
  'matured': 'Matured',
  'maturity': 'Matured',
  'annpayo': 'Matured',
  // --- Claim ---
  'claim': 'Claim',
  // --- Unknown (catch-all for garbage) ---
  'unknown': 'Unknown',
  'annuity': 'Unknown',
  'reclassified annuity': 'Unknown',
  'reclassifiedannuity': 'Unknown',
}

// ============================================================================
// IMO ALIASES (ported from CORE_Normalize.gs IMO_ALIASES)
// ============================================================================

export const IMO_ALIASES: Record<string, string> = {
  'spark': 'SPARK',
  'spark imo': 'SPARK',
  'sms': 'SMS',
  'senior market sales': 'SMS',
  'psmi': 'PSMI',
  'integrity': 'Integrity',
  'amerilife': 'AmeriLife',
}

// ============================================================================
// BOB ALIASES (ported from CORE_Normalize.gs BOB_ALIASES)
// ============================================================================

export const BOB_ALIASES: Record<string, string> = {
  'millang financial group': 'Millang Financial Group',
  'millang financial group josh millang': 'Millang Financial Group',
  'millang financial group  josh millang': 'Millang Financial Group',
  'millang financial group josh d millang': 'Millang Financial Group',
  'mfg': 'Millang Financial Group',
  'gloria stevensrissman': 'Millang Financial Group',
  'bob king': 'Millang Financial Group',
  'sarah dory': 'Millang Financial Group',
  'retirement protectors': 'Retirement Protectors',
  'rpi': 'Retirement Protectors',
  'retirement protectors inc': 'Retirement Protectors',
  'senior products insurance larry dean': 'Senior Products Insurance',
  'senior products insurance': 'Senior Products Insurance',
  'retirewise christa': 'RetireWise',
  'retirewise': 'RetireWise',
  'dexter': 'Dexter',
  'lucas dexter': 'Dexter',
  'archer': 'Archer',
  'josh archer': 'Archer',
  'alex haase': 'Greene Point Partners',
  'janet woods - cof': 'Janet Woods - CoF',
  'janet woods-cof': 'Janet Woods - CoF',
  'janet woods cof': 'Janet Woods - CoF',
  'cof janet woods': 'Janet Woods - CoF',
  'cof': 'Janet Woods - CoF',
  'greene point partners': 'Greene Point Partners',
  'green point partners': 'Greene Point Partners',
  'greenpoint partners': 'Greene Point Partners',
  'greenepoint partners': 'Greene Point Partners',
  'green point': 'Greene Point Partners',
  'greene point': 'Greene Point Partners',
  'greene point partners alex haase dubosc': 'Greene Point Partners',
  'green point partners alex': 'Greene Point Partners',
  'green pointe partners alex': 'Greene Point Partners',
  'greene point partners alex': 'Greene Point Partners',
  'alex haase dubosc': 'Greene Point Partners',
}

// ============================================================================
// PRODUCT NAME ALIASES (ported from CORE_Normalize.gs PRODUCT_NAME_ALIASES)
// ============================================================================

export const PRODUCT_NAME_ALIASES: Record<string, string> = {
  // Annuity products
  'income pay pro': 'Income Pay Pro',
  'ncome pay pro': 'Income Pay Pro',
  'versachoice10': 'VersaChoice 10',
  'verdachoice 10': 'VersaChoice 10',
  'versa choice 10': 'VersaChoice 10',
  'agchoice10': 'AG Choice 10',
  'benefit soulutions 10': 'BenefitSolutions 10',
  'accelerator plus@ 10': 'Accelerator Plus 10',
  'apexadvantage': 'ApexAdvantage',
  'apexadantage': 'ApexAdvantage',
  'personal income annuit': 'Personal Income Annuity',
  'growthtrack': 'GrowthTrack',
  'secure horizon plue': 'Secure Horizon Plus',
  'snyengery choice max 5': 'Synergy Choice Max 5',
  'synergy choice max5': 'Synergy Choice Max 5',
  'income plannin': 'Income Planning',
  'equty indexed flexible premium deferred': 'Equity Indexed Flexible Premium Deferred',
  'income shield 10': 'Income Shield 10',
  'incomeshield10': 'IncomeShield 10',
  'controlx versachoice': 'ControlX VersaChoice',
  'retirement chapters 10 yr': 'Retirement Chapters 10',
  '222': 'Allianz 222',
  '360': 'Allianz 360',

  // Life products
  'whole life': 'Whole Life',
  'genesis whole life': 'Genesis Whole Life',
  'flex wealth advantage': 'FlexWealth Advantage',
  'flexwealth advantage': 'FlexWealth Advantage',
  'super nova': 'SuperNOVA',
  'equiflex': 'EquiFlex',
  'equiflex iul': 'EquiFlex IUL',
  'compass elite': 'Compass Elite',
  'compass elite iul': 'Compass Elite IUL',
  'compass': 'Compass',
  'multiple option plan': 'Multiple Option Plan',
  'v4l': 'Value 4 Life',
  'value4life': 'Value 4 Life',
  'living promise-level benefit': 'Living Promise - Level Benefit',
  'builder plus iul3': 'Builder Plus 3 IUL',
  'special paid up @65': 'Special Paid Up @ 65',
  'special graded premium life': 'Special Graded Premium',
  'term- 15': 'Term 15',
  'term- 10': 'Term 10',
}

// ============================================================================
// PLAN NAME ALIASES (ported from CORE_Normalize.gs PLAN_NAME_ALIASES)
// ============================================================================

export const PLAN_NAME_ALIASES: Record<string, string> = {
  'aetna signature hmo-pos': 'Aetna Signature (HMO-POS)',
  'aetna medicare premier hmo-pos)': 'Aetna Medicare Premier (HMO-POS)',
  'aetna medicare premier hmo-pos': 'Aetna Medicare Premier (HMO-POS)',
  'aetna signature ppo': 'Aetna Signature (PPO)',
  'aetna medicare premier': 'Aetna Medicare Premier (HMO-POS)',
  'wellcare dual liberty (hmo-pos': 'Wellcare Dual Liberty (HMO-POS)',
  'wellcare simple': 'Wellcare Simple (HMO-POS)',
  'wellcare value script': 'WellCare Value Script (PDP)',
  'wellcare value script (pdp)': 'WellCare Value Script (PDP)',
  'wellcare classic pdp': 'WellCare Classic (PDP)',
  'wellcare hmo-pos': 'Wellcare (HMO-POS)',
  'humana full access': 'HUMANA FULL ACCESS PPO',
  'humana value choice ppo': 'HUMANA VALUE CHOICE PPO',
  'humana value plus': 'HUMANA VALUE PLUS PPO',
  'humanachoice ppo': 'HUMANACHOICE PPO',
  'humana gp': 'Humana Gold Plus',
  'humana usaa honor giveback': 'HUMANA USAA HONOR GIVEBACK PPO',
  'humana usaa honor gb ppo': 'HUMANA USAA HONOR GIVEBACK PPO',
  'humana honor gb ppo': 'HUMANA USAA HONOR GIVEBACK PPO',
  'humana value plus ppo': 'HUMANA VALUE PLUS PPO H7617-089',
  'smartrx': 'SilverScript SmartRx (PDP)',
  'aarp medicare supplement plan': 'AARP Medicare Supplement Plan',
  'aarpmodmedsup': 'AARP Medicare Supplement',
  'individual tax qualified long term car': 'Individual Tax Qualified Long Term Care',
  'ltc -tax qualified and non-t': 'Long Term Care - Tax Qualified',
  'ltc ind tax qualified': 'Individual Tax Qualified LTC',
  'preferred plan (a) dnt2': 'Preferred Plan (a) Dnt2',
  // Garbage CMS plan IDs used as plan names -- clear them
  's5921-363': '',
  'h8768-001': '',
  'h8768-023': '',
}
