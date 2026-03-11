export default function AtlasPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">ATLAS — Source Registry</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">The Machine&apos;s nervous system</p>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">hub</span>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Source registry — tracks every data source, integration, and pipeline across the platform — coming soon.</p>
      </div>
    </div>
  )
}
