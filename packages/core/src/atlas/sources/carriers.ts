/**
 * Carrier Source Catalog
 * Static registry of all known RPI carriers with automation status.
 * Used by POST /api/atlas/sources/bulk-register to seed the source registry.
 */

export interface CarrierSourceDefinition {
  carrierId: string
  carrierName: string
  status: 'GREEN' | 'YELLOW' | 'RED'
  feedType: 'automated' | 'manual_csv' | 'none'
  productLine: string
  dataDomain: string
  notes: string
}

export const CARRIER_SOURCES: CarrierSourceDefinition[] = [
  // Medicare carriers
  { carrierId: 'CARRIER_AETNA', carrierName: 'Aetna', status: 'GREEN', feedType: 'automated', productLine: 'MAPD', dataDomain: 'ENROLLMENT', notes: 'Automated enrollment feed via IMO portal' },
  { carrierId: 'CARRIER_HUMANA', carrierName: 'Humana', status: 'GREEN', feedType: 'automated', productLine: 'MAPD', dataDomain: 'ENROLLMENT', notes: 'Automated enrollment feed via Gradient' },
  { carrierId: 'CARRIER_UNITEDHEALTHCARE', carrierName: 'UnitedHealthcare', status: 'GREEN', feedType: 'automated', productLine: 'MAPD', dataDomain: 'ENROLLMENT', notes: 'Automated feed via Gradient portal' },
  { carrierId: 'CARRIER_CIGNA', carrierName: 'Cigna', status: 'YELLOW', feedType: 'manual_csv', productLine: 'MAPD', dataDomain: 'ENROLLMENT', notes: 'Manual CSV export from carrier portal' },
  { carrierId: 'CARRIER_WELLCARE', carrierName: 'WellCare/Centene', status: 'GREEN', feedType: 'automated', productLine: 'MAPD', dataDomain: 'ENROLLMENT', notes: 'Automated feed via Gradient' },
  { carrierId: 'CARRIER_MUTUAL_OMAHA', carrierName: 'Mutual of Omaha', status: 'YELLOW', feedType: 'manual_csv', productLine: 'MED_SUPP', dataDomain: 'ENROLLMENT', notes: 'Manual CSV for Med Supp policies' },
  { carrierId: 'CARRIER_DEVOTED', carrierName: 'Devoted Health', status: 'YELLOW', feedType: 'manual_csv', productLine: 'MAPD', dataDomain: 'ENROLLMENT', notes: 'Manual CSV export' },
  // Life/Annuity carriers
  { carrierId: 'CARRIER_ATHENE', carrierName: 'Athene', status: 'GREEN', feedType: 'automated', productLine: 'FIA', dataDomain: 'ACCOUNTS', notes: 'DTCC feed for FIA accounts' },
  { carrierId: 'CARRIER_NATIONWIDE', carrierName: 'Nationwide', status: 'GREEN', feedType: 'automated', productLine: 'FIA', dataDomain: 'ACCOUNTS', notes: 'DTCC feed for annuity accounts' },
  { carrierId: 'CARRIER_NORTH_AMERICAN', carrierName: 'North American', status: 'YELLOW', feedType: 'manual_csv', productLine: 'FIA', dataDomain: 'ACCOUNTS', notes: 'Manual export from Sammons portal' },
  { carrierId: 'CARRIER_MIDLAND', carrierName: 'Midland National', status: 'YELLOW', feedType: 'manual_csv', productLine: 'FIA', dataDomain: 'ACCOUNTS', notes: 'Manual export from Sammons portal' },
  { carrierId: 'CARRIER_AMERICAN_EQUITY', carrierName: 'American Equity', status: 'GREEN', feedType: 'automated', productLine: 'FIA', dataDomain: 'ACCOUNTS', notes: 'Automated feed via Gradient' },
  { carrierId: 'CARRIER_GLOBAL_ATLANTIC', carrierName: 'Global Atlantic', status: 'YELLOW', feedType: 'manual_csv', productLine: 'FIA', dataDomain: 'ACCOUNTS', notes: 'Manual CSV export' },
  { carrierId: 'CARRIER_COF', carrierName: 'Catholic Order of Foresters', status: 'RED', feedType: 'none', productLine: 'WHOLE_LIFE', dataDomain: 'ACCOUNTS', notes: 'No automated pipeline — statements only' },
  // Commission sources
  { carrierId: 'CARRIER_GRADIENT_COMMISSIONS', carrierName: 'Gradient (Commissions)', status: 'GREEN', feedType: 'automated', productLine: 'ALL', dataDomain: 'COMMISSIONS', notes: 'Gradient IMO commission statements' },
  { carrierId: 'CARRIER_SIGNAL_COMMISSIONS', carrierName: 'Signal (Commissions)', status: 'YELLOW', feedType: 'manual_csv', productLine: 'ALL', dataDomain: 'COMMISSIONS', notes: 'Legacy Signal commission files — transitioning to Gradient' },
  // Investment
  { carrierId: 'CARRIER_SCHWAB', carrierName: 'Charles Schwab', status: 'GREEN', feedType: 'automated', productLine: 'INVESTMENTS', dataDomain: 'ACCOUNTS', notes: 'RIA custodian via Gradient RIA side' },
  { carrierId: 'CARRIER_RBC', carrierName: 'RBC', status: 'YELLOW', feedType: 'manual_csv', productLine: 'INVESTMENTS', dataDomain: 'ACCOUNTS', notes: 'BD custodian — manual export' },
  // Reference data
  { carrierId: 'CARRIER_NAIC', carrierName: 'NAIC', status: 'GREEN', feedType: 'automated', productLine: 'ALL', dataDomain: 'DEMOGRAPHICS', notes: 'Carrier seeding via NAIC database' },
  { carrierId: 'CARRIER_DST_VISION', carrierName: 'DST Vision', status: 'YELLOW', feedType: 'manual_csv', productLine: 'INVESTMENTS', dataDomain: 'ACCOUNTS', notes: 'Data aggregator for directly held mutual fund / variable annuity accounts' },
]
