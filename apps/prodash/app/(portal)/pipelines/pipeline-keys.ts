// Single source of truth for pipeline key ↔ URL slug mapping
const PIPELINE_KEY_TO_SLUG: Record<string, string> = {
  NBX_INVESTMENTS: 'nbx-investments',
  NBX_LIFE: 'nbx-life',
  NBX_ANNUITY: 'nbx-annuity',
  NBX_MEDICARE_MEDSUP: 'nbx-medicare-medsup',
  NBX_MEDICARE_MAPD: 'nbx-medicare-mapd',
  SALES_RETIREMENT: 'sales-retirement',
  SALES_MEDICARE: 'sales-medicare',
  SALES_LEGACY: 'sales-legacy',
  PROSPECT_RETIREMENT: 'prospect-retirement',
  PROSPECT_MEDICARE: 'prospect-medicare',
  PROSPECT_LEGACY: 'prospect-legacy',
  REACTIVE_RETIREMENT: 'reactive-retirement',
  REACTIVE_MEDICARE: 'reactive-medicare',
}

// Derive the inverse map programmatically
const SLUG_TO_PIPELINE_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(PIPELINE_KEY_TO_SLUG).map(([key, slug]) => [slug, key])
)

/** Convert a pipeline key (e.g. NBX_INVESTMENTS) to a URL slug (e.g. nbx-investments) */
export function toSlug(pipelineKey: string): string {
  return PIPELINE_KEY_TO_SLUG[pipelineKey] || pipelineKey.toLowerCase().replace(/_/g, '-')
}

/** Convert a URL slug (e.g. nbx-investments) back to a pipeline key (e.g. NBX_INVESTMENTS) */
export function toPipelineKey(slug: string): string {
  return SLUG_TO_PIPELINE_KEY[slug] || slug.toUpperCase().replace(/-/g, '_')
}
