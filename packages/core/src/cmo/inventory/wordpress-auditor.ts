/**
 * WordPress Page Auditor (MUS-D03)
 *
 * Audits all pages at retireprotected.com.
 * Identifies live, draft, stale, and gap pages.
 *
 * Server-only — do NOT export through client barrel.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoWordPressPageAudit } from '../types'

const STALE_THRESHOLD_DAYS = 365

/** Expected pages — gaps if not found */
const EXPECTED_PAGES: Array<{
  slug: string
  title: string
  market: CmoWordPressPageAudit['market']
  pageType: CmoWordPressPageAudit['pageType']
}> = [
  { slug: 'medicare', title: 'Medicare Landing Page', market: 'b2c', pageType: 'landing' },
  { slug: 'fia', title: 'FIA Product Page', market: 'b2c', pageType: 'product' },
  { slug: 'myga', title: 'MYGA Product Page', market: 'b2c', pageType: 'product' },
  { slug: 'life-insurance', title: 'Life Insurance Page', market: 'b2c', pageType: 'product' },
  { slug: 'david-partnership', title: 'DAVID/Partnership Page', market: 'b2b', pageType: 'partner' },
  { slug: 'about', title: 'About Page', market: 'all', pageType: 'about' },
  { slug: 'contact', title: 'Contact Page', market: 'all', pageType: 'other' },
]

function classifyPageType(
  slug: string,
  title: string,
): CmoWordPressPageAudit['pageType'] {
  const lower = (slug + ' ' + title).toLowerCase()
  if (lower.includes('landing') || lower.includes('lp-')) return 'landing'
  if (lower.includes('product') || lower.includes('fia') || lower.includes('myga') || lower.includes('medicare'))
    return 'product'
  if (lower.includes('blog') || lower.includes('news') || lower.includes('article')) return 'blog'
  if (lower.includes('about') || lower.includes('team') || lower.includes('story')) return 'about'
  if (lower.includes('partner') || lower.includes('david')) return 'partner'
  return 'other'
}

function classifyPageMarket(slug: string, title: string): CmoWordPressPageAudit['market'] {
  const lower = (slug + ' ' + title).toLowerCase()
  if (lower.includes('david') || lower.includes('partner') || lower.includes('b2b')) return 'b2b'
  if (lower.includes('internal') || lower.includes('team') || lower.includes('rapid')) return 'b2e'
  if (lower.includes('medicare') || lower.includes('client') || lower.includes('fia') || lower.includes('myga'))
    return 'b2c'
  return 'all'
}

/**
 * Audit all WordPress pages.
 * Returns empty array on MCP error.
 */
export async function auditWordPressPages(): Promise<CmoWordPressPageAudit[]> {
  try {
    console.log('[MUSASHI] WordPress page audit requested')
    // MCP calls dispatched by API layer
    return []
  } catch {
    console.log('[MUSASHI] WordPress auditor unavailable, returning empty audit')
    return []
  }
}

/**
 * Process raw WordPress page data into audit entries.
 * Called by API route after wordpress MCP responses.
 */
export function processWordPressPages(
  pages: Array<{
    id: number | string
    slug: string
    title: string
    status: string
    modified?: string
    link?: string
  }>,
): CmoWordPressPageAudit[] {
  const entries: CmoWordPressPageAudit[] = []
  const foundSlugs = new Set<string>()

  for (const page of pages) {
    foundSlugs.add(page.slug.toLowerCase())
    const lastModified = new Date(page.modified || Date.now())
    const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24)

    let status: CmoWordPressPageAudit['status']
    if (page.status === 'draft' || page.status === 'pending') {
      status = 'draft'
    } else if (daysSinceModified > STALE_THRESHOLD_DAYS) {
      status = 'stale'
    } else {
      status = 'live'
    }

    entries.push({
      id: `wp-${page.id}`,
      url: page.link || `https://retireprotected.com/${page.slug}`,
      title: page.title,
      status,
      lastModified,
      market: classifyPageMarket(page.slug, page.title),
      pageType: classifyPageType(page.slug, page.title),
    })
  }

  // Add gap entries for expected pages not found
  for (const expected of EXPECTED_PAGES) {
    if (!foundSlugs.has(expected.slug)) {
      entries.push({
        id: `wp-gap-${expected.slug}`,
        url: `https://retireprotected.com/${expected.slug}`,
        title: expected.title,
        status: 'gap',
        lastModified: new Date(),
        market: expected.market,
        pageType: expected.pageType,
        notes: 'Expected page not found — gap identified by MUSASHI auditor',
      })
    }
  }

  return entries
}
