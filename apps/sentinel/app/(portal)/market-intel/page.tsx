export default function MarketIntelPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Market Intelligence</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Agent search, carrier intel, and cross-referencing</p>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">travel_explore</span>
        <p className="mt-4 text-sm text-[var(--text-muted)]">
          Market intelligence — agent search, carrier intel, NPI cross-reference, and competitive analysis — coming soon.
        </p>
      </div>
    </div>
  )
}
