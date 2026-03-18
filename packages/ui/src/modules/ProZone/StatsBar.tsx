'use client'

// ============================================================================
// StatsBar — Combined stats + filter bar for ProZone single-pane view
// ============================================================================

interface StatsBarProps {
  zoneCount: number
  clientCount: number
  flaggedCount: number
  searchQuery: string
  onSearchChange: (q: string) => void
  tierFilter: string
  onTierFilterChange: (t: string) => void
  flaggedOnly: boolean
  onFlaggedOnlyChange: (v: boolean) => void
}

interface StatCardProps {
  label: string
  value: number
  highlight?: boolean
}

function StatCard({ label, value, highlight }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2.5">
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
      <p
        className={`text-lg font-bold ${
          highlight ? 'text-amber-400' : 'text-[var(--text-primary)]'
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  )
}

export default function StatsBar({
  zoneCount,
  clientCount,
  flaggedCount,
  searchQuery,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  flaggedOnly,
  onFlaggedOnlyChange,
}: StatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      {/* Left — Stat Cards */}
      <div className="flex items-center gap-2">
        <StatCard label="Zones" value={zoneCount} />
        <StatCard label="Clients" value={clientCount} />
        <StatCard label="Flagged" value={flaggedCount} highlight={flaggedCount > 0} />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right — Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <span
            className="material-icons-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            style={{ fontSize: '16px' }}
          >
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name..."
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--portal)] focus:outline-none"
          />
        </div>

        {/* Tier Filter */}
        <select
          value={tierFilter}
          onChange={(e) => onTierFilterChange(e.target.value)}
          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
        >
          <option value="all">All Tiers</option>
          <option value="I">Tier I</option>
          <option value="II">Tier II</option>
          <option value="III">Tier III</option>
          <option value="IV">Tier IV</option>
        </select>

        {/* Flagged Only Toggle */}
        <button
          type="button"
          onClick={() => onFlaggedOnlyChange(!flaggedOnly)}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            flaggedOnly
              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
              : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            flag
          </span>
          Flagged
        </button>
      </div>
    </div>
  )
}
