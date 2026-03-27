'use client'

import type { VoltronArtifact } from '../types'

interface ArtifactDisplayProps {
  artifacts: VoltronArtifact[]
  simulation?: boolean
}

/** Icon mapping for artifact types */
const ARTIFACT_ICONS: Record<string, string> = {
  drive_file: 'description',
  html: 'code',
  pdf: 'picture_as_pdf',
  slack: 'chat',
  email: 'mail',
  sms: 'sms',
  calendar: 'event',
  report: 'summarize',
  link: 'link',
}

/**
 * Displays artifacts produced by a wire execution.
 * Shows clickable links to Drive files, Slack messages, reports, etc.
 */
export function ArtifactDisplay({ artifacts, simulation }: ArtifactDisplayProps) {
  if (artifacts.length === 0) return null

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
        <span className="material-icons-outlined text-[18px] text-[var(--portal)]">
          inventory_2
        </span>
        Artifacts
        {simulation && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--warning)]/10 text-[var(--warning)] normal-case tracking-normal">
            simulated
          </span>
        )}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {artifacts.map((artifact, idx) => {
          const icon = ARTIFACT_ICONS[artifact.type] ?? 'attachment'
          const label = artifact.label ?? formatArtifactType(artifact.type)

          return (
            <a
              key={`${artifact.type}-${idx}`}
              href={simulation ? undefined : artifact.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (simulation) e.preventDefault()
              }}
              className={`
                flex items-center gap-3 rounded-lg border border-[var(--border-subtle)]
                bg-[var(--bg-surface)] px-3 py-2.5 transition-all duration-150
                ${simulation
                  ? 'opacity-60 cursor-default'
                  : 'hover:border-[var(--portal)] hover:bg-[var(--bg-hover)] cursor-pointer'}
              `}
            >
              <span
                className="material-icons-outlined text-[20px] shrink-0"
                style={{ color: artifactColor(artifact.type) }}
              >
                {icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text-primary)] font-medium truncate">
                  {label}
                </div>
                {!simulation && artifact.link && (
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {artifact.link}
                  </div>
                )}
              </div>
              {!simulation && (
                <span className="material-icons-outlined text-[16px] text-[var(--text-muted)] shrink-0">
                  open_in_new
                </span>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function formatArtifactType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function artifactColor(type: string): string {
  switch (type) {
    case 'drive_file':
    case 'html':
    case 'pdf':
      return 'var(--info)'
    case 'slack':
    case 'sms':
      return 'var(--success)'
    case 'email':
      return 'var(--portal)'
    case 'calendar':
      return 'var(--warning)'
    default:
      return 'var(--text-secondary)'
  }
}
