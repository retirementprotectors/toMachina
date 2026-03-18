'use client'

// ============================================================================
// InventoryBadge + ProductPill — Badge components for ProZone prospect rows
// ============================================================================

// -- Flag badge styles -------------------------------------------------------

const FLAG_STYLES: Record<string, { bg: string; text: string }> = {
  'Active Medicare': { bg: 'bg-sky-500/10', text: 'text-sky-400' },
  'L&A 80+':        { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  'No Core Product': { bg: 'bg-red-500/10', text: 'text-red-400' },
}

const FALLBACK_STYLE = { bg: 'bg-neutral-500/10', text: 'text-neutral-400' }

interface InventoryBadgeProps {
  flag: string
  count?: number
}

export function InventoryBadge({ flag, count }: InventoryBadgeProps) {
  const style = FLAG_STYLES[flag] ?? FALLBACK_STYLE
  const label = count != null ? `${flag} (${count})` : flag

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
    >
      {label}
    </span>
  )
}

// -- Product pill styles -----------------------------------------------------

const PRODUCT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  has_medicare: { bg: 'bg-sky-500/10',     text: 'text-sky-400',     label: 'MA' },
  has_life:     { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Life' },
  has_annuity:  { bg: 'bg-violet-500/10',  text: 'text-violet-400',  label: 'Ann' },
  has_ria:      { bg: 'bg-cyan-500/10',    text: 'text-cyan-400',    label: 'RIA' },
  has_bd:       { bg: 'bg-orange-500/10',  text: 'text-orange-400',  label: 'BD' },
}

interface ProductPillProps {
  productKey: string
}

export function ProductPill({ productKey }: ProductPillProps) {
  const style = PRODUCT_STYLES[productKey]
  if (!style) return null

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  )
}
