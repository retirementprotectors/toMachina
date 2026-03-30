'use client'

import type { DragEvent } from 'react'
import type { ProspectWithInventory, InventoryFlags } from './types'
import { InventoryBadge, ProductPill } from './InventoryBadge'

// ============================================================================
// ProspectRow — Single draggable prospect row for zone accordions
// ============================================================================

interface ProspectRowProps {
  prospect: ProspectWithInventory
  onCallClick?: (prospect: ProspectWithInventory) => void
}

const MEETING_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  field:  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Field' },
  office: { bg: 'bg-sky-500/10',     text: 'text-sky-400',     label: 'Office' },
}

export default function ProspectRow({ prospect, onCallClick }: ProspectRowProps) {
  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('application/json', JSON.stringify(prospect))
    e.dataTransfer.effectAllowed = 'move'
  }

  // Collect active product keys
  const activeProducts = (Object.keys(prospect.inventory) as Array<keyof InventoryFlags>).filter(
    (key) => prospect.inventory[key]
  )

  const meetingStyle = MEETING_STYLES[prospect.meeting_type]

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--bg-surface)] cursor-grab active:cursor-grabbing"
    >
      {/* Person icon */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface)]">
        <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
          person
        </span>
      </span>

      {/* Name — click navigates to contact detail */}
      <a
        href={`/clients/${prospect.client_id}`}
        onClick={(e) => { e.stopPropagation() }}
        className="min-w-[140px] text-sm font-medium text-[var(--text-primary)] truncate hover:underline hover:text-[var(--portal)]"
      >
        {prospect.first_name} {prospect.last_name}
      </a>

      {/* Location */}
      <span className="min-w-[120px] text-xs text-[var(--text-muted)] truncate">
        {prospect.county}, {prospect.city}
      </span>

      {/* Age */}
      <span className="w-10 text-right text-xs tabular-nums text-[var(--text-secondary)]">
        {prospect.age ?? '--'}
      </span>

      {/* Product pills */}
      <div className="flex items-center gap-1">
        {activeProducts.map((key) => (
          <ProductPill key={key} productKey={key} />
        ))}
      </div>

      {/* Flag badges */}
      {prospect.flags.length > 0 && (
        <div className="flex items-center gap-1">
          {prospect.flags.map((flag) => (
            <InventoryBadge key={flag} flag={flag} />
          ))}
        </div>
      )}

      {/* Pipeline stage badge */}
      {prospect.pipeline && (
        <span className="rounded-full bg-[var(--portal)]/10 px-2.5 py-0.5 text-[10px] font-medium text-[var(--portal)]">
          {prospect.pipeline.stage}
        </span>
      )}

      {/* Cross-sell badge */}
      {prospect.cross_sell_from && (
        <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-medium text-orange-400">
          {prospect.cross_sell_from}
        </span>
      )}

      {/* Spacer to push trailing items right */}
      <div className="flex-1" />

      {/* Phone button */}
      {prospect.phone && onCallClick && (
        <button
          type="button"
          onClick={() => onCallClick(prospect)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-emerald-500/10"
          title={`Call ${prospect.phone}`}
        >
          <span className="material-icons-outlined text-emerald-400" style={{ fontSize: '16px' }}>
            call
          </span>
        </button>
      )}

      {/* Meeting type badge */}
      {meetingStyle && (
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${meetingStyle.bg} ${meetingStyle.text}`}>
          {meetingStyle.label}
        </span>
      )}
    </div>
  )
}
