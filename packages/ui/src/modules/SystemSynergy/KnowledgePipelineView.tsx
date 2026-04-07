'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'

// ── Types ──────────────────────────────────────────────────────────────

interface KnowledgeEntry {
  id: string
  type: string
  warrior: string
  content: string
  confidence: number
  tags: string[]
  promoted_to_claude_md: boolean
  created_at: string
}

interface KnowledgeQuery {
  entries: KnowledgeEntry[]
  count: number
  filters: { type: string | null; warrior: string | null; min_confidence: number | null }
}

interface MemoryFile {
  file: string
  name: string
  type: string
  lines: number
  last_modified: string
  days_stale: number
}

interface MemoryProject {
  project: string
  index_lines: number
  memory_files: number
  entries: MemoryFile[]
}

interface MemoryInventory {
  projects: MemoryProject[]
  total_memory_entries: number
  project_count: number
}

interface WarriorLayer {
  exists: boolean
  lines: number
  last_modified: string
  size_kb: number
}

interface BrainLayer extends WarriorLayer {
  days_since_update: number
}

interface WarriorBrain {
  warrior: string
  soul: WarriorLayer
  spirit: WarriorLayer
  brain: BrainLayer
}

interface BrainHealth {
  warriors: WarriorBrain[]
  warrior_count: number
  total_brain_lines: number
  warriors_missing_brain: string[]
}

interface ClaudeMdFile {
  label: string
  path: string
  lines: number
  last_modified: string
  recent_commits: string[]
  diff_preview: string | null
}

interface ClaudeMdDiff {
  diffs: ClaudeMdFile[]
  days_queried: number
}

// ── Colors ─────────────────────────────────────────────────────────────

const c = {
  bg:        '#0a0e17',
  bgCard:    '#111827',
  bgHover:   '#1a2236',
  border:    '#1e293b',
  text:      '#e2e8f0',
  textMuted: '#94a3b8',
  teal:      '#14b8a6',
  tealGlow:  'rgba(20,184,166,0.15)',
  green:     '#22c55e',
  red:       '#ef4444',
  orange:    '#f97316',
  purple:    '#a78bfa',
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}

// ── Sub-components ─────────────────────────────────────────────────────

function SectionCard({ title, badge, children }: {
  title: string
  badge?: string | number
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: c.bgCard,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: 24,
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: c.text, fontSize: 15, fontWeight: 600 }}>{title}</h3>
        {badge !== undefined && (
          <span style={{
            background: c.tealGlow,
            color: c.teal,
            border: `1px solid ${c.teal}`,
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 10px',
          }}>{badge}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr>
        {cols.map(col => (
          <th key={col} style={{
            textAlign: 'left',
            padding: '8px 12px',
            color: c.textMuted,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: `1px solid ${c.border}`,
          }}>{col}</th>
        ))}
      </tr>
    </thead>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    feedback:   c.teal,
    identity:   c.purple,
    project:    c.orange,
    reference:  c.green,
  }
  const color = colorMap[type.toLowerCase()] || c.textMuted
  return (
    <span style={{
      display: 'inline-block',
      background: `${color}20`,
      color,
      border: `1px solid ${color}`,
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 700,
      padding: '2px 8px',
      whiteSpace: 'nowrap',
    }}>{type}</span>
  )
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, Math.round(value * 100)))
  const color = pct >= 80 ? c.green : pct >= 50 ? c.orange : c.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 80 }}>
      <div style={{
        flex: 1,
        height: 6,
        background: c.border,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ color, fontSize: 11, fontWeight: 700, minWidth: 28 }}>{pct}%</span>
    </div>
  )
}

function LayerRow({ label, layer }: { label: string; layer: WarriorLayer | BrainLayer }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 0',
      borderBottom: `1px solid ${c.border}`,
      fontSize: 12,
    }}>
      <span style={{ color: c.textMuted, width: 44, flexShrink: 0, textTransform: 'capitalize' }}>{label}</span>
      <span className="material-symbols-outlined" style={{
        fontSize: 14,
        color: layer.exists ? c.green : c.red,
      }}>{layer.exists ? 'check_circle' : 'cancel'}</span>
      {layer.exists && (
        <>
          <span style={{ color: c.textMuted }}>{layer.lines}L</span>
          <span style={{ color: c.border }}>·</span>
          <span style={{ color: c.textMuted }}>{layer.size_kb.toFixed(1)}kb</span>
          <span style={{ color: c.border }}>·</span>
          <span style={{ color: c.textMuted, fontSize: 11 }}>{formatDate(layer.last_modified)}</span>
        </>
      )}
    </div>
  )
}

function FilterSelect({ label, value, options, onChange }: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: c.textMuted, fontSize: 12 }}>{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function CollapsibleProject({ project }: { project: MemoryProject }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 8,
      marginBottom: 8,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span className="material-symbols-outlined" style={{
          fontSize: 16,
          color: c.teal,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(90deg)' : 'none',
        }}>
          chevron_right
        </span>
        <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>{project.project}</span>
        <span style={{ color: c.textMuted, fontSize: 12 }}>
          {project.memory_files} files · {project.index_lines} index lines
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TableHeader cols={['Name', 'Type', 'Lines', 'Last Modified', 'Days Stale']} />
            <tbody>
              {project.entries.map((entry, i) => (
                <tr
                  key={entry.file || i}
                  style={{ borderBottom: `1px solid ${c.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = c.bgHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 12px', color: c.text }}>{entry.name}</td>
                  <td style={{ padding: '8px 12px' }}><TypeBadge type={entry.type} /></td>
                  <td style={{ padding: '8px 12px', color: c.textMuted }}>{entry.lines}</td>
                  <td style={{ padding: '8px 12px', color: c.textMuted }}>{formatDate(entry.last_modified)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      color: entry.days_stale > 30 ? c.red : c.textMuted,
                      fontWeight: entry.days_stale > 30 ? 700 : 400,
                    }}>
                      {entry.days_stale}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────

export function KnowledgePipelineView() {
  const [knowledge, setKnowledge] = useState<KnowledgeQuery | null>(null)
  const [memory, setMemory] = useState<MemoryInventory | null>(null)
  const [brainHealth, setBrainHealth] = useState<BrainHealth | null>(null)
  const [claudeMd, setClaudeMd] = useState<ClaudeMdDiff | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState('')
  const [warriorFilter, setWarriorFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [kRes, mRes, bRes, cRes] = await Promise.all([
      fetchValidated<KnowledgeQuery>('/api/system-synergy/knowledge-query'),
      fetchValidated<MemoryInventory>('/api/system-synergy/memory-inventory'),
      fetchValidated<BrainHealth>('/api/system-synergy/brain-health'),
      fetchValidated<ClaudeMdDiff>('/api/system-synergy/claude-md-diff?days=7'),
    ])
    if (!kRes.success || !mRes.success || !bRes.success || !cRes.success) {
      setError(kRes.error || mRes.error || bRes.error || cRes.error || 'Failed to load knowledge data')
    } else {
      setKnowledge(kRes.data!)
      setMemory(mRes.data!)
      setBrainHealth(bRes.data!)
      setClaudeMd(cRes.data!)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: c.textMuted }}>
        <span className="material-symbols-outlined" style={{ fontSize: 28, marginRight: 10, color: c.teal }}>sync</span>
        Loading knowledge pipeline…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: `${c.red}15`,
        border: `1px solid ${c.red}`,
        borderRadius: 10,
        padding: 20,
        color: c.red,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: 20,
      }}>
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    )
  }

  const allTypes = Array.from(new Set((knowledge?.entries ?? []).map(e => e.type))).sort()
  const allWarriors = Array.from(new Set((knowledge?.entries ?? []).map(e => e.warrior))).sort()
  const filteredEntries = (knowledge?.entries ?? []).filter(e =>
    (!typeFilter || e.type === typeFilter) &&
    (!warriorFilter || e.warrior === warriorFilter)
  )

  const missingBrain = brainHealth?.warriors_missing_brain ?? []

  return (
    <div style={{ color: c.text }}>

      {/* ── Knowledge Entries ───────────────────────────────────────── */}
      <SectionCard title="Knowledge Entries" badge={filteredEntries.length}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <FilterSelect label="Type" value={typeFilter} options={allTypes} onChange={setTypeFilter} />
          <FilterSelect label="Warrior" value={warriorFilter} options={allWarriors} onChange={setWarriorFilter} />
          {(typeFilter || warriorFilter) && (
            <button
              onClick={() => { setTypeFilter(''); setWarriorFilter('') }}
              style={{
                background: 'transparent',
                color: c.textMuted,
                border: `1px solid ${c.border}`,
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >Clear</button>
          )}
        </div>

        {filteredEntries.length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No entries match the current filters
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <TableHeader cols={['Type', 'Warrior', 'Content', 'Confidence', 'Promoted']} />
              <tbody>
                {filteredEntries.map((entry, i) => (
                  <tr
                    key={entry.id || i}
                    style={{ borderBottom: `1px solid ${c.border}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = c.bgHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '10px 12px' }}><TypeBadge type={entry.type} /></td>
                    <td style={{ padding: '10px 12px', color: c.purple, fontWeight: 600, fontSize: 12 }}>
                      {entry.warrior}
                    </td>
                    <td style={{ padding: '10px 12px', color: c.textMuted, maxWidth: 300 }}>
                      <span title={entry.content}>{truncate(entry.content, 80)}</span>
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: 100 }}>
                      <ConfidenceBar value={entry.confidence} />
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {entry.promoted_to_claude_md
                        ? <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.green }}>check_circle</span>
                        : <span className="material-symbols-outlined" style={{ fontSize: 18, color: c.border }}>radio_button_unchecked</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Memory Inventory ────────────────────────────────────────── */}
      <SectionCard
        title="Memory Inventory"
        badge={`${memory?.project_count ?? 0} projects`}
      >
        <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
          <div style={{ background: c.tealGlow, border: `1px solid ${c.teal}`, borderRadius: 8, padding: '8px 16px', fontSize: 12 }}>
            <span style={{ color: c.textMuted }}>Total entries: </span>
            <span style={{ color: c.teal, fontWeight: 700 }}>{memory?.total_memory_entries ?? 0}</span>
          </div>
        </div>
        {(memory?.projects ?? []).length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No memory projects found
          </div>
        ) : (
          memory!.projects.map((p, i) => (
            <CollapsibleProject key={p.project || i} project={p} />
          ))
        )}
      </SectionCard>

      {/* ── Brain Health ────────────────────────────────────────────── */}
      <SectionCard
        title="Brain Health"
        badge={`${brainHealth?.warrior_count ?? 0} warriors`}
      >
        {missingBrain.length > 0 && (
          <div style={{
            background: `${c.red}15`,
            border: `1px solid ${c.red}`,
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14,
            color: c.red,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
            Missing brain: {missingBrain.join(', ')}
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {(brainHealth?.warriors ?? []).map((w, i) => (
            <div
              key={w.warrior || i}
              style={{
                background: c.bg,
                border: `1px solid ${missingBrain.includes(w.warrior) ? c.red : c.border}`,
                borderRadius: 8,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: c.purple }}>smart_toy</span>
                <span style={{ color: c.text, fontWeight: 700, fontSize: 14 }}>{w.warrior}</span>
                {missingBrain.includes(w.warrior) && (
                  <span style={{
                    marginLeft: 'auto',
                    background: `${c.red}20`,
                    color: c.red,
                    border: `1px solid ${c.red}`,
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                  }}>NO BRAIN</span>
                )}
              </div>
              <LayerRow label="Soul" layer={w.soul} />
              <LayerRow label="Spirit" layer={w.spirit} />
              <LayerRow label="Brain" layer={w.brain} />
              {w.brain.exists && (
                <div style={{ fontSize: 11, color: c.textMuted, marginTop: 6, paddingTop: 6 }}>
                  Updated {w.brain.days_since_update}d ago
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── CLAUDE.md Changes ───────────────────────────────────────── */}
      <SectionCard
        title={`CLAUDE.md Changes (last ${claudeMd?.days_queried ?? 7} days)`}
        badge={claudeMd?.diffs.length ?? 0}
      >
        {(claudeMd?.diffs ?? []).length === 0 ? (
          <div style={{ color: c.textMuted, fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
            No recent CLAUDE.md changes
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {claudeMd!.diffs.map((diff, i) => (
              <div
                key={diff.path || i}
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                  borderRadius: 8,
                  padding: 16,
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  gap: 10,
                }}>
                  <div>
                    <div style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>{diff.label}</div>
                    <div style={{ color: c.textMuted, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>
                      {diff.path}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ color: c.textMuted, fontSize: 11 }}>{diff.lines} lines</span>
                    <span style={{ color: c.textMuted, fontSize: 11 }}>{formatDate(diff.last_modified)}</span>
                  </div>
                </div>

                {diff.recent_commits.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{
                      color: c.textMuted,
                      fontSize: 11,
                      marginBottom: 6,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      Recent commits
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {diff.recent_commits.map((commit, j) => (
                        <div key={j} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          color: c.textMuted,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12, color: c.teal }}>
                            commit
                          </span>
                          <span style={{ fontFamily: 'monospace' }}>{commit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diff.diff_preview && (
                  <div>
                    <div style={{
                      color: c.textMuted,
                      fontSize: 11,
                      marginBottom: 6,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      Diff preview
                    </div>
                    <pre style={{
                      margin: 0,
                      padding: '12px 14px',
                      background: '#060a11',
                      border: `1px solid ${c.border}`,
                      borderRadius: 6,
                      fontSize: 11,
                      lineHeight: 1.6,
                      color: c.textMuted,
                      overflowX: 'auto',
                      fontFamily: 'monospace',
                      maxHeight: 200,
                      overflowY: 'auto',
                    }}>{diff.diff_preview}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

    </div>
  )
}
