export default function PipelinesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pipelines</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">view_kanban</span>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Client pipeline stages — Discovery, Data Foundation, Case Building, Close — coming soon.</p>
      </div>
    </div>
  )
}
