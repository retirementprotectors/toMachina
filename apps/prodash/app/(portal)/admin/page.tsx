export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Admin</h1>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">admin_panel_settings</span>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Portal administration and system settings — coming soon.</p>
      </div>
    </div>
  )
}
