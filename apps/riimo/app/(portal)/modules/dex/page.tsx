export default function DexPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">DEX — Document Efficiency</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Document management and processing</p>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] py-20">
        <span className="material-icons-outlined text-5xl text-[var(--text-muted)]">description</span>
        <p className="mt-4 text-sm text-[var(--text-muted)]">Document efficiency engine — automated filing, OCR extraction, and compliance tracking — coming soon.</p>
      </div>
    </div>
  )
}
