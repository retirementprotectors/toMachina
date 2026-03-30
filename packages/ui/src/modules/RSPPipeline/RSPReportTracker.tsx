'use client'

/**
 * RSPReportTracker — TRK-RSP-011
 * Per-account report status tracker for Blue Gate compliance.
 */

interface ReportItem {
  report_id: string
  account_id: string
  report_type: string
  status: 'pending' | 'requested' | 'received' | 'reviewed'
  requested_at?: string
  received_at?: string
}

interface RSPReportTrackerProps {
  reports: ReportItem[]
  onRequestReport?: (reportId: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500/20 text-gray-400',
  requested: 'bg-blue-500/20 text-blue-400',
  received: 'bg-yellow-500/20 text-yellow-400',
  reviewed: 'bg-green-500/20 text-green-400',
}

export function RSPReportTracker({ reports, onRequestReport }: RSPReportTrackerProps) {
  const reviewed = reports.filter(r => r.status === 'reviewed').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Report Tracker</h3>
        <span className="text-sm text-[var(--text-muted)]">{reviewed}/{reports.length} reviewed</span>
      </div>

      <div className="space-y-2">
        {reports.map(report => (
          <div key={report.report_id} className="p-3 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{report.report_type}</div>
              <div className="text-xs text-[var(--text-muted)]">Account: {report.account_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[report.status]}`}>
                {report.status}
              </span>
              {report.status === 'pending' && onRequestReport && (
                <button
                  onClick={() => onRequestReport(report.report_id)}
                  className="px-2 py-1 rounded bg-[var(--portal)] text-white text-xs font-semibold"
                >
                  Request
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export type { RSPReportTrackerProps, ReportItem }
