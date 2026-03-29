'use client'

/**
 * RSPYellowQUE — Yellow Stage QUE Hook Links
 *
 * Surfaces contextual "Open QUE-*" stub links based on account types present
 * in the RSP instance. Each link navigates to the QUE module with pre-loaded
 * context (product line + account ID).
 *
 * This is a stub-first implementation: full QUE integration is deferred to
 * dedicated QUE sprints. Links are functional navigation stubs.
 *
 * @ticket TRK-14130
 */

import {
  ACCOUNT_TYPE_TO_QUE,
  QUE_HOOK_META,
  type QueProductLine,
  type RSPAccount,
} from './types'

// ============================================================================
// PROPS
// ============================================================================

export interface RSPYellowQUEProps {
  /** Instance ID for the active RSP flow */
  instanceId: string
  /** Accounts loaded from the RSP instance (Blue-phase data) */
  accounts: RSPAccount[]
  /** Base URL for QUE module navigation (default: /modules/que) */
  queBaseUrl?: string
}

// ============================================================================
// HELPERS
// ============================================================================

interface ResolvedQueLink {
  productLine: QueProductLine
  account: RSPAccount
  href: string
  contextLabel: string
}

/**
 * Resolves the list of QUE links to render based on which account types are
 * present. Deduplicates by product line — one link per QUE app, using the
 * first matching account for context.
 */
function resolveQueLinks(
  accounts: RSPAccount[],
  queBaseUrl: string,
): ResolvedQueLink[] {
  const seen = new Set<QueProductLine>()
  const links: ResolvedQueLink[] = []

  for (const account of accounts) {
    const productLine = ACCOUNT_TYPE_TO_QUE[account.account_type]
    if (!productLine || seen.has(productLine)) continue

    seen.add(productLine)

    const contextParts: string[] = [account.carrier]
    if (account.policy_number) contextParts.push(`#${account.policy_number}`)
    if (account.face_amount) {
      contextParts.push(`(face $${formatCompact(account.face_amount)})`)
    }

    links.push({
      productLine,
      account,
      href: `${queBaseUrl}?type=${productLine.toLowerCase()}&account_id=${account.account_id}`,
      contextLabel: contextParts.join(' '),
    })
  }

  // Stable sort: LIFE → ANNUITY → MEDICARE → INVESTMENT
  const ORDER: QueProductLine[] = ['LIFE', 'ANNUITY', 'MEDICARE', 'INVESTMENT']
  links.sort((a, b) => ORDER.indexOf(a.productLine) - ORDER.indexOf(b.productLine))

  return links
}

/** Format large numbers compactly: 500000 → "500k" */
function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`
  return value.toLocaleString()
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RSPYellowQUE({
  instanceId,
  accounts,
  queBaseUrl = '/modules/que',
}: RSPYellowQUEProps) {
  const links = resolveQueLinks(accounts, queBaseUrl)

  if (links.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <p className="text-sm text-[var(--text-muted)]">
          No quoting-eligible accounts found for this instance.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3" data-instance-id={instanceId}>
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span
          className="material-icons-outlined text-[var(--text-muted)]"
          style={{ fontSize: '18px' }}
        >
          bolt
        </span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          QUE Analysis Tools
        </h3>
        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-yellow-800">
          Yellow Stage
        </span>
      </div>

      {/* QUE link cards */}
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => {
          const meta = QUE_HOOK_META[link.productLine]

          return (
            <a
              key={link.productLine}
              href={link.href}
              className="group flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-hover)]"
            >
              {/* Icon */}
              <span
                className="material-icons-outlined mt-0.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]"
                style={{ fontSize: '20px' }}
              >
                {meta.icon}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {meta.linkLabel}
                  </span>
                  <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    STUB
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                  {link.contextLabel}
                </p>
              </div>

              {/* Arrow */}
              <span
                className="material-icons-outlined mt-0.5 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
                style={{ fontSize: '16px' }}
              >
                arrow_forward
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
