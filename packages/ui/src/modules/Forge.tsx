'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from './fetchWithAuth'
import { KanbanBoard, type KanbanColumn, type KanbanCard } from '../components/KanbanBoard'
import { useToast } from '../components/Toast'

/* ─── Types ─── */
interface Attachment {
  name: string
  original_name: string
  url: string
  content_type: string
  size: number
  path: string
  uploaded_at: string
  uploaded_by: string
}

interface TrackerItem {
  id: string
  item_id: string
  title: string
  description: string
  portal: string
  scope: string
  component: string
  section: string
  type: string
  status: string
  sprint_id: string | null
  discovery_url: string | null
  plan_link: string | null
  notes: string
  attachments?: Attachment[]
  created_by: string
  created_at: string
  updated_at: string
}

interface Sprint {
  id: string
  name: string
  description: string
  status: string
  discovery_url: string | null
  plan_link: string | null
  prompt_text: string
  created_by: string
  created_at: string
  updated_at: string
}

/* ─── Constants ─── */
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  queue:       { color: 'rgb(251,191,36)', bg: 'rgba(251,191,36,0.15)', label: 'Queue' },
  not_touched: { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Not Touched' },
  in_sprint:   { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'In Sprint' },
  planned:     { color: 'var(--portal, #4a7ab5)', bg: 'rgba(74,122,181,0.15)', label: 'Planned' },
  built:       { color: 'rgb(20,184,166)', bg: 'rgba(20,184,166,0.15)', label: 'Built' },
  audited:     { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Audited' },
  confirmed:   { color: 'rgb(34,197,94)', bg: 'rgba(34,197,94,0.15)', label: 'Confirmed' },
  deferred:    { color: 'rgb(156,163,175)', bg: 'rgba(156,163,175,0.15)', label: 'Deferred' },
  wont_fix:    { color: 'rgb(100,116,139)', bg: 'rgba(100,116,139,0.15)', label: "Won't Fix" },
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  broken:   { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Bug' },
  idea:     { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  improve:  { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Enhancement' },
  question: { color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.15)', label: 'Question' },
}

const TYPES = ['broken', 'idea', 'improve', 'question'] as const
const PORTALS = ['PRODASHX', 'RIIMO', 'SENTINEL', 'SHARED', 'INFRA', 'DATA'] as const
const SCOPES = ['Module', 'App', 'Platform', 'Data'] as const
const STATUSES = ['queue', 'not_touched', 'in_sprint', 'planned', 'built', 'audited', 'confirmed', 'deferred', 'wont_fix'] as const

const API_BASE = '/api'

/* ─── Styles ─── */
const s = {
  bg: 'var(--bg, #0f1219)',
  surface: 'var(--bg-surface, #1c2333)',
  hover: 'var(--bg-hover, #232b3e)',
  border: 'var(--border-color, #2a3347)',
  text: 'var(--text-primary, #e2e8f0)',
  textSecondary: 'var(--text-secondary, #94a3b8)',
  textMuted: 'var(--text-muted, #64748b)',
  portal: 'var(--portal, #4a7ab5)',
}

/* ─── Helpers ─── */
function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return '—' }
}

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

/* ─── Sub-Components (outside main to preserve focus) ─── */

function FSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--bg-surface, #1c2333)',
        border: '1px solid var(--border-color, #2a3347)',
        borderRadius: 6,
        padding: '6px 10px',
        color: 'var(--text-primary, #e2e8f0)',
        fontSize: 13,
        outline: 'none',
        minWidth: 110,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function FInput({ label, value, onChange, textarea }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{
            width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
            borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
            outline: 'none', resize: 'vertical',
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
            borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
            outline: 'none',
          }}
        />
      )}
    </div>
  )
}

function FFormSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
          borderRadius: 6, padding: '8px 10px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13, outline: 'none',
        }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { color: 'var(--text-muted, #64748b)', bg: 'rgba(100,116,139,0.15)', label: status }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

/* ─── Main Component ─── */
interface ForgeProps {
  portal: string
}

export function Forge({ portal }: ForgeProps) {
  const { showToast } = useToast()
  const [items, setItems] = useState<TrackerItem[]>([])
  const [allItems, setAllItems] = useState<TrackerItem[]>([])
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ status: '', portal: '', scope: '', component: '', sprint_id: '', type: '' })
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [editItem, setEditItem] = useState<TrackerItem | null>(null)
  const [editForm, setEditForm] = useState<Partial<TrackerItem>>({})
  const [showCreateSprint, setShowCreateSprint] = useState(false)
  const [sprintForm, setSprintForm] = useState({ name: '', description: '', discovery_url: '' })
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptText, setPromptText] = useState('')
  const [promptSprintId, setPromptSprintId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState<string>('item_id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [bulkStatus, setBulkStatus] = useState('')
  const [view, setView] = useState<'grid' | 'workflow' | 'sprints' | 'dedup'>('grid')
  const [dedupGroups, setDedupGroups] = useState<Array<{ winner: TrackerItem; duplicates: TrackerItem[]; reason: string }>>([])
  const [dedupLoading, setDedupLoading] = useState(false)
  const [reopeningSprintId, setReopeningSprintId] = useState<string | null>(null)
  // Track selected field values per group: { groupIndex: { fieldKey: itemIndex } }
  const [dedupSelections, setDedupSelections] = useState<Record<number, Record<string, number>>>({})
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showDiscoveryImport, setShowDiscoveryImport] = useState(false)
  const [discoveryContent, setDiscoveryContent] = useState('')
  const [discoveryPreview, setDiscoveryPreview] = useState<Record<string, unknown> | null>(null)
  const [discoveryPreviewing, setDiscoveryPreviewing] = useState(false)
  const [discoveryImporting, setDiscoveryImporting] = useState(false)
  const pageSize = 25

  /* ─── Data Loading ─── */
  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status) params.set('status', filters.status)
      if (filters.portal) params.set('portal', filters.portal)
      if (filters.scope) params.set('scope', filters.scope)
      if (filters.component) params.set('component', filters.component)
      if (filters.sprint_id) params.set('sprint_id', filters.sprint_id)
      if (filters.type) params.set('type', filters.type)
      if (search) params.set('search', search)
      params.set('limit', '100')
      const res = await fetchWithAuth(`${API_BASE}/tracker?${params}`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) setItems(json.data || [])
      }
    } catch { /* silent */ }
    setLoading(false)
    // Also refresh unfiltered items for sprint cards
    try {
      const allRes = await fetchWithAuth(`${API_BASE}/tracker?limit=500`)
      if (allRes.ok) {
        const allJson = await allRes.json()
        if (allJson.success) setAllItems(allJson.data || [])
      }
    } catch { /* silent */ }
  }, [filters, search])

  const loadAllItems = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker?limit=500`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) setAllItems(json.data || [])
      }
    } catch { /* silent */ }
  }, [])

  const loadSprints = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) setSprints(json.data || [])
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => { loadItems() }, [loadItems])
  useEffect(() => { loadAllItems() }, [loadAllItems])
  useEffect(() => { loadSprints() }, [loadSprints])

  /* ─── Derived ─── */
  const components = useMemo(() => {
    const set = new Set(items.map(i => i.component).filter(Boolean))
    return Array.from(set).sort()
  }, [items])

  const sortedItems = useMemo(() => {
    const sorted = [...items]
    sorted.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortField] as string || ''
      const bv = (b as unknown as Record<string, unknown>)[sortField] as string || ''
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [items, sortField, sortDir])

  const pagedItems = useMemo(() => {
    const start = page * pageSize
    return sortedItems.slice(start, start + pageSize)
  }, [sortedItems, page])

  const totalPages = Math.ceil(items.length / pageSize)

  const activeSprint = useMemo(() => {
    if (!filters.sprint_id) return null
    return sprints.find(s => s.id === filters.sprint_id) || null
  }, [filters.sprint_id, sprints])

  const sprintProgress = useMemo(() => {
    if (!activeSprint) return { confirmed: 0, total: 0 }
    const total = items.length
    const confirmed = items.filter(i => i.status === 'confirmed').length
    return { confirmed, total }
  }, [activeSprint, items])

  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    return STATUSES.map(status => {
      const cfg = STATUS_CONFIG[status]
      const statusItems = items.filter(i => i.status === status)
      const cards: KanbanCard[] = statusItems.map(item => ({
        id: item.id,
        title: item.title,
        subtitle: item.item_id,
        badges: [
          ...(TYPE_CONFIG[item.type] ? [{ label: TYPE_CONFIG[item.type].label, color: TYPE_CONFIG[item.type].color }] : []),
          { label: item.portal || '', color: 'var(--portal, #4a7ab5)' },
          ...(item.component ? [{ label: item.component, color: '#e07c3e' }] : []),
        ].filter(b => b.label),
        meta: [
          ...(item.section ? [{ text: item.section }] : []),
          ...(item.attachments?.length ? [{ icon: 'attach_file', text: `${item.attachments.length}` }] : []),
        ],
        onClick: () => openEdit(item),
      }))
      return { id: status, title: `${cfg?.label || status} (${statusItems.length})`, cards, color: cfg?.color }
    })
  }, [items])

  // Sprint lifecycle phases + phase detection
  const SPRINT_PHASES = ['in_sprint', 'planned', 'built', 'audited', 'confirmed'] as const
  const PHASE_CONFIG: Record<string, { label: string; color: string; action: string; actionLabel: string }> = {
    in_sprint:  { label: 'Discovery', color: 'rgb(245,158,11)', action: 'prompt', actionLabel: '#LetsPlanIt' },
    planned:    { label: 'Building',  color: 'var(--portal, #4a7ab5)', action: 'prompt', actionLabel: '#LetsBuildIt' },
    built:      { label: 'Audit',     color: 'rgb(20,184,166)', action: 'audit', actionLabel: '#LetsAuditIt' },
    audited:    { label: 'Confirm',   color: 'rgb(168,85,247)', action: 'sendit', actionLabel: '#SendIt' },
    confirmed:  { label: 'Complete',  color: 'rgb(34,197,94)', action: 'reopen', actionLabel: 'Reopen Sprint' },
  }

  const STATUS_RANK: Record<string, number> = { queue: 0, not_touched: 1, in_sprint: 2, planned: 3, built: 4, audited: 5, confirmed: 6 }

  const sprintCards = useMemo(() => {
    return sprints.map(sp => {
      const sprintItems = allItems.filter(i => i.sprint_id === sp.id)
      const bugs = sprintItems.filter(i => i.type === 'broken').length
      const enhancements = sprintItems.filter(i => i.type === 'improve').length
      const features = sprintItems.filter(i => i.type === 'idea').length
      const questions = sprintItems.filter(i => i.type === 'question').length
      const confirmed = sprintItems.filter(i => i.status === 'confirmed').length
      const total = sprintItems.length

      // Phase = lowest status rank among active items (bottleneck)
      const activeItems = sprintItems.filter(i => !['deferred', 'wont_fix'].includes(i.status))
      let phase = 'in_sprint'
      if (sp.status === 'complete') {
        phase = 'confirmed'
      } else if (activeItems.length > 0) {
        const minRank = Math.min(...activeItems.map(i => STATUS_RANK[i.status] ?? 0))
        if (minRank >= 6) phase = 'confirmed'
        else if (minRank >= 5) phase = 'audited'
        else if (minRank >= 4) phase = 'built'
        else if (minRank >= 3) phase = 'planned'
        else phase = 'in_sprint'
      }

      return { ...sp, items: sprintItems, bugs, enhancements, features, questions, confirmed, total, phase }
    })
  }, [sprints, allItems])

  /* ─── Handlers ─── */
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === pagedItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pagedItems.map(i => i.id)))
    }
  }

  const openEdit = (item: TrackerItem) => {
    setEditItem(item)
    setEditForm({ ...item })
  }

  const closeEdit = () => {
    setEditItem(null)
    setEditForm({})
  }

  const saveEdit = async () => {
    if (!editItem) return
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        closeEdit()
        await loadItems()
      }
    } catch { /* silent */ }
  }

  const confirmItem = async () => {
    if (!editItem) return
    try {
      await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'confirmed' }),
      })
      closeEdit()
      await loadItems()
    } catch { /* silent */ }
  }

  const deleteItem = async () => {
    if (!editItem) return
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}`, { method: 'DELETE' })
      if (res.ok) {
        closeEdit()
        await loadItems()
      }
    } catch { /* silent */ }
  }

  const createSprint = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints`, {
        method: 'POST',
        body: JSON.stringify({
          name: sprintForm.name,
          description: sprintForm.description,
          discovery_url: sprintForm.discovery_url || null,
          item_ids: Array.from(selectedIds),
        }),
      })
      if (res.ok) {
        setShowCreateSprint(false)
        setSprintForm({ name: '', description: '', discovery_url: '' })
        setSelectedIds(new Set())
        await loadItems()
        await loadSprints()
      }
    } catch { /* silent */ }
  }

  const generatePrompt = async (sprintId?: string, phase?: string) => {
    const sid = sprintId || activeSprint?.id
    if (!sid) return
    const phaseParam = phase || 'discovery'
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/${sid}/prompt?phase=${phaseParam}`)
      if (res.ok) {
        const json = await res.json()
        setPromptText(json.data?.prompt || json.prompt || '')
        setPromptSprintId(sid)
        setShowPrompt(true)
        // Move items to 'planned' — the prompt IS the plan
        const sprintItems = items.filter(i => i.sprint_id === sid && i.status === 'in_sprint')
        if (sprintItems.length > 0) {
          await Promise.all(sprintItems.map(i =>
            fetchWithAuth(`${API_BASE}/tracker/${i.id}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: 'planned' }),
            })
          ))
          await loadItems()
        }
      }
    } catch { /* silent */ }
  }

  const bulkUpdateStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          fetchWithAuth(`${API_BASE}/tracker/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: bulkStatus }),
          })
        )
      )
      setSelectedIds(new Set())
      setBulkStatus('')
      await loadItems()
    } catch { /* silent */ }
  }

  const savePromptToSprint = async () => {
    if (!promptSprintId || !promptText) return
    try {
      await fetchWithAuth(`${API_BASE}/sprints/${promptSprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ prompt_text: promptText }),
      })
      await loadSprints()
    } catch { /* silent */ }
  }

  const copyPrompt = async () => {
    navigator.clipboard.writeText(promptText)
    await savePromptToSprint()
  }

  const printPrompt = async () => {
    await savePromptToSprint()
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>FORGE Sprint Prompt</title>
<style>
@page { size: letter; margin: 0.75in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; background: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
h1 { font-size: 20px; margin-bottom: 8px; color: #e07c3e; }
p { font-size: 12px; color: #64748b; margin-bottom: 20px; }
</style></head><body>
<h1>FORGE Sprint Prompt</h1>
<p>Generated ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
<pre>${promptText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>window.print()</script>
</body></html>`)
      win.document.close()
    }
  }

  const handleCardMove = async (cardId: string, _fromCol: string, toCol: string) => {
    try {
      await fetchWithAuth(`${API_BASE}/tracker/${cardId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: toCol }),
      })
      await loadItems()
    } catch { /* silent */ }
  }

  const autoCreateSprint = () => {
    // Find all unassigned items — use allItems (not filtered items)
    const unassigned = allItems.filter(i => !i.sprint_id && ['queue', 'not_touched'].includes(i.status))
    if (unassigned.length === 0) {
      showToast('No unassigned items to sprint — all items are already in sprints', 'warning')
      return
    }

    // Sort: bugs → enhancements → features → questions, clustered by component
    const typePriority: Record<string, number> = { broken: 0, improve: 1, idea: 2, question: 3 }
    const sorted = [...unassigned].sort((a, b) => {
      const pa = typePriority[a.type] ?? 4
      const pb = typePriority[b.type] ?? 4
      if (pa !== pb) return pa - pb
      return (a.component || '').localeCompare(b.component || '')
    })

    // Select all unassigned
    setSelectedIds(new Set(sorted.map(i => i.id)))

    // Smart name generation from content
    const bugs = sorted.filter(i => i.type === 'broken').length
    const enhancements = sorted.filter(i => i.type === 'improve').length
    const features = sorted.filter(i => i.type === 'idea').length
    const questions = sorted.filter(i => i.type === 'question').length

    // Find the highest existing sprint number
    const existingNums = sprints.map(sp => {
      const match = sp.name.match(/Sprint\s+(\d+)/i)
      return match ? parseInt(match[1], 10) : 0
    })
    const nextNum = Math.max(0, ...existingNums) + 1

    // Determine dominant portals
    const portalCounts: Record<string, number> = {}
    sorted.forEach(i => { portalCounts[i.portal] = (portalCounts[i.portal] || 0) + 1 })
    const topPortals = Object.entries(portalCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => p)

    // Determine dominant components
    const compCounts: Record<string, number> = {}
    sorted.forEach(i => { if (i.component) compCounts[i.component] = (compCounts[i.component] || 0) + 1 })
    const topComps = Object.entries(compCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => c)

    // Build smart name
    let smartName = `Sprint ${nextNum}`
    if (bugs > enhancements + features && bugs > sorted.length * 0.6) {
      // Bug-heavy sprint
      smartName += ' — Bug Fixes'
      if (topPortals.length === 1 && topPortals[0] !== 'SHARED') smartName += ` (${topPortals[0]})`
      else if (topComps.length <= 2) smartName += ` (${topComps.join(' + ')})`
    } else if (features > bugs && features > sorted.length * 0.4) {
      // Feature-heavy sprint
      smartName += ' — New Features'
      if (topComps.length <= 2) smartName += ` (${topComps.join(' + ')})`
    } else if (topComps.length === 1) {
      // Single component focus
      smartName += ` — ${topComps[0]}`
    } else if (topPortals.length === 1 && topPortals[0] !== 'SHARED') {
      smartName += ` — ${topPortals[0]}`
    } else {
      // Mixed
      const mixParts: string[] = []
      if (bugs) mixParts.push(`${bugs} fixes`)
      if (enhancements + features) mixParts.push(`${enhancements + features} improvements`)
      smartName += ` — ${mixParts.join(', ')}`
    }

    const descParts: string[] = []
    if (bugs) descParts.push(`${bugs} bugs`)
    if (enhancements) descParts.push(`${enhancements} enhancements`)
    if (features) descParts.push(`${features} features`)
    if (questions) descParts.push(`${questions} questions`)

    setSprintForm({
      name: smartName,
      description: `${sorted.length} items: ${descParts.join(', ')}. Top: ${topComps.slice(0, 3).join(', ') || 'mixed'}`,
      discovery_url: '',
    })
    setShowCreateSprint(true)
  }

  const generateAuditPrompt = async (sprintId: string) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/${sprintId}/audit`)
      if (res.ok) {
        const json = await res.json()
        setPromptText(json.data?.prompt || json.prompt || '')
        setPromptSprintId(sprintId)
        setShowPrompt(true)
      }
    } catch { /* silent */ }
  }

  const confirmAllInSprint = async (sprintId: string) => {
    const sprintItems = items.filter(i => i.sprint_id === sprintId && i.status !== 'confirmed' && i.status !== 'deferred' && i.status !== 'wont_fix')
    if (sprintItems.length === 0) return
    try {
      await Promise.all(sprintItems.map(i =>
        fetchWithAuth(`${API_BASE}/tracker/${i.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'confirmed' }),
        })
      ))
      await loadItems()
    } catch { /* silent */ }
  }

  const closeSprint = async (sprintId: string) => {
    try {
      await fetchWithAuth(`${API_BASE}/sprints/${sprintId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'complete' }),
      })
      await loadSprints()
    } catch { /* silent */ }
  }

  const reopenSprint = async (sprintId: string) => {
    setReopeningSprintId(sprintId)
    try {
      const r = await fetchWithAuth(`${API_BASE}/sprints/${sprintId}/reopen`, { method: 'POST' })
      if (r.ok) {
        showToast('Sprint reopened — items moved back to Audit', 'success')
        await loadItems()
        await loadSprints()
      } else {
        const body = await r.json().catch(() => ({}))
        showToast(`Reopen failed: ${(body as Record<string, string>).error || r.statusText}`, 'error')
      }
    } catch (err) {
      showToast(`Reopen error: ${String(err)}`, 'error')
    } finally {
      setReopeningSprintId(null)
    }
  }

  const unconfirmItem = async () => {
    if (!editItem) return
    try {
      await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'audited' }),
      })
      closeEdit()
      await loadItems()
    } catch { /* silent */ }
  }

  const loadDedup = useCallback(async () => {
    setDedupLoading(true)
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker/dedup`)
      if (res.ok) {
        const json = await res.json()
        setDedupGroups(json.data?.groups || [])
      }
    } catch { /* silent */ }
    setDedupLoading(false)
  }, [])

  const mergeDedup = async (groupIndex: number, winnerId: string, loserIds: string[], allItems: TrackerItem[]) => {
    // Build overrides from selected cells
    const selections = dedupSelections[groupIndex] || {}
    const overrides: Record<string, unknown> = {}
    const mergeableFields = ['title', 'description', 'type', 'portal', 'scope', 'component', 'section', 'notes', 'sprint_id']
    for (const field of mergeableFields) {
      const selectedIdx = selections[field]
      if (selectedIdx !== undefined && selectedIdx > 0 && allItems[selectedIdx]) {
        const val = (allItems[selectedIdx] as unknown as Record<string, unknown>)[field]
        if (val) overrides[field] = val
      }
    }

    try {
      // First merge (combines attachments, notes, deletes losers)
      const res = await fetchWithAuth(`${API_BASE}/tracker/dedup/merge`, {
        method: 'POST',
        body: JSON.stringify({ winner_id: winnerId, loser_ids: loserIds }),
      })
      // Then apply field overrides from selections
      if (res.ok && Object.keys(overrides).length > 0) {
        await fetchWithAuth(`${API_BASE}/tracker/${winnerId}`, {
          method: 'PATCH',
          body: JSON.stringify(overrides),
        })
      }
      if (res.ok) {
        setDedupSelections(prev => { const next = { ...prev }; delete next[groupIndex]; return next })
        await loadDedup()
        await loadItems()
      }
    } catch { /* silent */ }
  }

  const [sprintDragOver, setSprintDragOver] = useState<string | null>(null)

  // Map sprint phase columns to the ticket status that items should be set to
  const PHASE_TO_STATUS: Record<string, string> = {
    in_sprint: 'in_sprint',
    planned: 'planned',
    built: 'built',
    audited: 'audited',
    confirmed: 'confirmed',
  }

  const handleSprintDrop = async (e: React.DragEvent, toPhase: string) => {
    e.preventDefault()
    setSprintDragOver(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'))
      if (!data.sprintId || data.fromPhase === toPhase) return
      const targetStatus = PHASE_TO_STATUS[toPhase]
      if (!targetStatus) return
      // Update all items in this sprint to the target status
      const sprintItems = items.filter(i => i.sprint_id === data.sprintId && !['deferred', 'wont_fix'].includes(i.status))
      await Promise.all(sprintItems.map(i =>
        fetchWithAuth(`${API_BASE}/tracker/${i.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: targetStatus }),
        })
      ))
      await loadItems()
    } catch { /* invalid drag data */ }
  }

  const openRoadmap = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/roadmap`)
      if (res.ok) {
        const html = await res.text()
        const win = window.open('', '_blank')
        if (win) { win.document.write(html); win.document.close() }
        else showToast('Pop-up blocked — allow pop-ups for this site', 'warning')
      } else {
        const body = await res.json().catch(() => ({}))
        showToast(`Roadmap failed: ${(body as Record<string, string>).error || res.statusText}`, 'error')
      }
    } catch (err) {
      showToast(`Roadmap error: ${String(err)}`, 'error')
    }
  }

  /* ─── Discovery Import Handlers ─── */
  const handleDiscoveryDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.md') || file.name.endsWith('.txt'))) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setDiscoveryContent(ev.target?.result as string || '')
      }
      reader.readAsText(file)
    }
  }, [])

  const previewDiscovery = useCallback(async () => {
    if (!discoveryContent.trim()) return
    setDiscoveryPreviewing(true)
    setDiscoveryPreview(null)
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/import-discovery`, {
        method: 'POST',
        body: JSON.stringify({
          content: discoveryContent,
          discovery_url: sprintForm.discovery_url || undefined,
          dry_run: true,
        }),
      })
      const json = await res.json() as { success: boolean; data?: Record<string, unknown>; error?: string }
      if (json.success && json.data) {
        setDiscoveryPreview(json.data)
      }
    } catch { /* silent */ }
    setDiscoveryPreviewing(false)
  }, [discoveryContent, sprintForm.discovery_url])

  const importDiscovery = useCallback(async () => {
    if (!discoveryContent.trim()) return
    setDiscoveryImporting(true)
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/import-discovery`, {
        method: 'POST',
        body: JSON.stringify({
          content: discoveryContent,
          discovery_url: sprintForm.discovery_url || undefined,
        }),
      })
      const json = await res.json() as { success: boolean; data?: Record<string, unknown>; error?: string }
      if (json.success) {
        setShowCreateSprint(false)
        setShowDiscoveryImport(false)
        setDiscoveryContent('')
        setDiscoveryPreview(null)
        loadSprints()
      }
    } catch { /* silent */ }
    setDiscoveryImporting(false)
  }, [discoveryContent, sprintForm.discovery_url, loadSprints])

  /* ─── Attachment Handlers ─── */
  const uploadAttachment = async (file: File) => {
    if (!editItem) return
    if (file.size > 5 * 1024 * 1024) return // 5MB max
    setUploading(true)
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // strip data:... prefix
        }
        reader.readAsDataURL(file)
      })
      const res = await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}/attachments`, {
        method: 'POST',
        body: JSON.stringify({ name: file.name, data: base64, content_type: file.type }),
      })
      if (res.ok) {
        await loadItems()
        // Refresh the edit item with new attachments
        const itemRes = await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}`)
        if (itemRes.ok) {
          const json = await itemRes.json()
          if (json.success) { setEditItem(json.data); setEditForm(json.data) }
        }
      }
    } catch { /* silent */ }
    setUploading(false)
  }

  const deleteAttachment = async (attachName: string) => {
    if (!editItem) return
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}/attachments/${encodeURIComponent(attachName)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        await loadItems()
        const itemRes = await fetchWithAuth(`${API_BASE}/tracker/${editItem.id}`)
        if (itemRes.ok) {
          const json = await itemRes.json()
          if (json.success) { setEditItem(json.data); setEditForm(json.data) }
        }
      }
    } catch { /* silent */ }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(f => uploadAttachment(f))
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (files.length > 0) {
      e.preventDefault()
      files.forEach(f => uploadAttachment(f))
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }

  // Sub-components aliased from top-level (preserves focus on re-render)
  const Select = FSelect
  const FormInput = FInput
  const FormSelect = FFormSelect

  /* ─── Render ─── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: s.text, fontFamily: 'inherit' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Row 1: Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Icon name="search" size={18} color={s.textMuted} />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0) }}
            style={{
              width: '100%', background: s.surface, border: `1px solid ${s.border}`,
              borderRadius: 6, padding: '8px 10px 8px 32px', color: s.text, fontSize: 13,
              outline: 'none', marginLeft: -26, paddingLeft: 32,
            }}
          />
        </div>
        {/* View Toggle */}
        <div style={{ display: 'flex', borderRadius: 6, border: `1px solid ${s.border}`, overflow: 'hidden' }}>
          <button
            onClick={() => setView('grid')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'grid' ? s.surface : 'transparent',
              color: view === 'grid' ? s.text : s.textMuted,
            }}
            title="Grid View"
          >
            <Icon name="view_list" size={18} />
          </button>
          <button
            onClick={() => setView('workflow')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'workflow' ? s.surface : 'transparent',
              color: view === 'workflow' ? s.text : s.textMuted,
            }}
            title="Workflow View"
          >
            <Icon name="view_kanban" size={18} />
          </button>
          <button
            onClick={() => setView('sprints')}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'sprints' ? s.surface : 'transparent',
              color: view === 'sprints' ? s.text : s.textMuted,
            }}
            title="Sprint View"
          >
            <Icon name="bolt" size={18} />
          </button>
          <button
            onClick={() => { setView('dedup'); loadDedup() }}
            style={{
              padding: '6px 10px', border: 'none', cursor: 'pointer',
              background: view === 'dedup' ? s.surface : 'transparent',
              color: view === 'dedup' ? s.text : s.textMuted,
            }}
            title="DeDup"
          >
            <Icon name="compare_arrows" size={18} />
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {selectedIds.size > 0 && (
          <>
            <Select
              value={bulkStatus}
              onChange={setBulkStatus}
              options={STATUSES.map(st => ({ value: st, label: STATUS_CONFIG[st]?.label || st }))}
              placeholder="Bulk status..."
            />
            {bulkStatus && (
              <button
                onClick={bulkUpdateStatus}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'rgb(245,158,11)', color: '#000', fontSize: 13, fontWeight: 600,
                }}
              >
                Apply ({selectedIds.size})
              </button>
            )}
            <button
              onClick={() => setShowCreateSprint(true)}
              style={{
                padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: s.portal, color: '#fff', fontSize: 13, fontWeight: 600,
              }}
            >
              Create Sprint ({selectedIds.size})
            </button>
          </>
        )}
        <button
          onClick={autoCreateSprint}
          style={{
            padding: '8px 14px', borderRadius: 6, border: `1px solid ${s.border}`, cursor: 'pointer',
            background: 'transparent', color: s.textSecondary, fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = s.border; e.currentTarget.style.color = s.textSecondary }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.background = '#e07c3e'; e.currentTarget.style.borderColor = '#e07c3e'; e.currentTarget.style.color = '#fff' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
        >
          <Icon name="auto_fix_high" size={16} /> Auto Sprint
        </button>
        <button
          onClick={openRoadmap}
          style={{
            padding: '8px 14px', borderRadius: 6, border: `1px solid ${s.border}`, cursor: 'pointer',
            background: 'transparent', color: s.textSecondary, fontSize: 13, fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = s.border; e.currentTarget.style.color = s.textSecondary }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; e.currentTarget.style.background = '#e07c3e'; e.currentTarget.style.borderColor = '#e07c3e'; e.currentTarget.style.color = '#fff' }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = s.surface; e.currentTarget.style.borderColor = s.textMuted; e.currentTarget.style.color = s.text }}
        >
          <Icon name="map" size={16} /> Roadmap
        </button>
      </div>

      {/* Back to Sprints breadcrumb when sprint-filtered */}
      {filters.sprint_id && view !== 'sprints' && (
        <button
          onClick={() => { setFilters(f => ({ ...f, sprint_id: '' })); setView('sprints') }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
            background: 'none', border: 'none', cursor: 'pointer', color: s.textSecondary,
            fontSize: 13, padding: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = s.text }}
          onMouseLeave={(e) => { e.currentTarget.style.color = s.textSecondary }}
        >
          <Icon name="arrow_back" size={16} /> Back to Sprints
        </button>
      )}

      {/* Row 2: Filters */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <Select
          value={filters.type}
          onChange={(v) => { setFilters(f => ({ ...f, type: v })); setPage(0) }}
          options={TYPES.map(t => ({ value: t, label: TYPE_CONFIG[t]?.label || t }))}
          placeholder="All Types"
        />
        <Select
          value={filters.status}
          onChange={(v) => { setFilters(f => ({ ...f, status: v })); setPage(0) }}
          options={STATUSES.map(st => ({ value: st, label: STATUS_CONFIG[st]?.label || st }))}
          placeholder="All Statuses"
        />
        <Select
          value={filters.portal}
          onChange={(v) => { setFilters(f => ({ ...f, portal: v })); setPage(0) }}
          options={PORTALS.map(p => ({ value: p, label: p }))}
          placeholder="All Portals"
        />
        <Select
          value={filters.scope}
          onChange={(v) => { setFilters(f => ({ ...f, scope: v })); setPage(0) }}
          options={SCOPES.map(sc => ({ value: sc, label: sc }))}
          placeholder="All Scopes"
        />
        <Select
          value={filters.component}
          onChange={(v) => { setFilters(f => ({ ...f, component: v })); setPage(0) }}
          options={components.map(c => ({ value: c, label: c }))}
          placeholder="All Components"
        />
        <Select
          value={filters.sprint_id}
          onChange={(v) => { setFilters(f => ({ ...f, sprint_id: v })); setPage(0) }}
          options={sprints.map(sp => ({ value: sp.id, label: sp.name }))}
          placeholder="All Sprints"
        />
        {(filters.status || filters.portal || filters.scope || filters.component || filters.sprint_id || filters.type || search) && (
          <button
            onClick={() => { setFilters({ status: '', portal: '', scope: '', component: '', sprint_id: '', type: '' }); setSearch(''); setPage(0) }}
            style={{
              padding: '6px 12px', borderRadius: 6, border: `1px solid ${s.border}`,
              background: 'transparent', color: s.textSecondary, fontSize: 12, cursor: 'pointer',
            }}
          >
            Clear Filters
          </button>
        )}
      </div>


      {/* ─── DeDup View ─── */}
      {view === 'dedup' && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {dedupLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>Scanning for duplicates...</div>
          ) : dedupGroups.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
              <Icon name="check_circle" size={32} color="rgb(34,197,94)" />
              <div style={{ marginTop: 8 }}>No duplicates detected</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, color: s.textSecondary, marginBottom: 4 }}>
                {dedupGroups.length} potential duplicate group{dedupGroups.length !== 1 ? 's' : ''} found
              </div>
              {dedupGroups.map((group, gi) => {
                const reasonLabel = { exact_match: 'Exact Match', substring_match: 'Substring Match', jaccard_similarity: 'Similar Words' }[group.reason] || group.reason
                const reasonColor = { exact_match: 'rgb(239,68,68)', substring_match: 'rgb(245,158,11)', jaccard_similarity: 'rgb(59,130,246)' }[group.reason] || s.textMuted
                return (
                  <div key={gi} style={{ background: s.surface, borderRadius: 10, border: `1px solid ${s.border}`, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${s.border}` }}>
                      <Icon name="compare_arrows" size={16} color={reasonColor} />
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: `${reasonColor}20`, color: reasonColor }}>{reasonLabel}</span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => mergeDedup(gi, group.winner.id, group.duplicates.map(d => d.id), [group.winner, ...group.duplicates])}
                        style={{
                          padding: '4px 14px', borderRadius: 6, border: 'none',
                          background: 'rgb(34,197,94)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4,
                          transition: 'all 0.15s',
                        }}
                        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      >
                        <Icon name="merge" size={14} color="#fff" /> Merge
                      </button>
                    </div>

                    {/* Field-by-field comparison table */}
                    {(() => {
                      const allItems = [group.winner, ...group.duplicates]
                      const fields: { key: string; label: string }[] = [
                        { key: 'item_id', label: 'ID' },
                        { key: 'title', label: 'Title' },
                        { key: 'description', label: 'Description' },
                        { key: 'type', label: 'Type' },
                        { key: 'status', label: 'Status' },
                        { key: 'portal', label: 'Portal' },
                        { key: 'scope', label: 'Scope' },
                        { key: 'component', label: 'Component' },
                        { key: 'section', label: 'Section' },
                        { key: 'sprint_id', label: 'Sprint' },
                        { key: 'notes', label: 'Notes' },
                        { key: 'created_by', label: 'Created By' },
                        { key: 'created_at', label: 'Created' },
                      ]
                      return (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr>
                                <th style={{ padding: '8px 12px', textAlign: 'left', color: s.textMuted, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: `1px solid ${s.border}`, width: 100 }}>Field</th>
                                {allItems.map((item, idx) => (
                                  <th key={idx} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: `1px solid ${s.border}`, minWidth: 180 }}>
                                    <span style={{
                                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 8,
                                      background: idx === 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                      color: idx === 0 ? 'rgb(34,197,94)' : 'rgb(239,68,68)',
                                    }}>{idx === 0 ? 'WINNER' : 'DUPLICATE'}</span>
                                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: s.textMuted, marginLeft: 8 }}>{item.item_id}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map(field => {
                                const values = allItems.map(item => {
                                  const val = (item as unknown as Record<string, unknown>)[field.key]
                                  if (field.key === 'status') return val as string
                                  if (field.key === 'type') {
                                    const tc = TYPE_CONFIG[val as string]
                                    return tc ? tc.label : (val as string) || '—'
                                  }
                                  if (field.key === 'sprint_id') {
                                    const sp = sprints.find(sp2 => sp2.id === val)
                                    return sp ? sp.name : (val ? String(val) : '—')
                                  }
                                  if (field.key === 'created_at') return formatDate(val as string)
                                  return val ? String(val) : '—'
                                })
                                const allSame = values.every(v => v === values[0])
                                return (
                                  <tr key={field.key} style={{ background: allSame ? 'transparent' : 'rgba(245,158,11,0.04)' }}>
                                    <td style={{ padding: '6px 12px', color: s.textMuted, fontSize: 11, fontWeight: 600, borderBottom: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>{field.label}</td>
                                    {values.map((val, idx) => {
                                      const isSelectable = idx > 0 && !allSame && !['item_id', 'created_at', 'created_by'].includes(field.key)
                                      const selectedIdx = (dedupSelections[gi] || {})[field.key]
                                      const isSelected = selectedIdx === idx
                                      const isWinnerDefault = selectedIdx === undefined && idx === 0 && !allSame && !['item_id', 'created_at', 'created_by'].includes(field.key)
                                      return (
                                        <td
                                          key={idx}
                                          onClick={isSelectable ? () => {
                                            setDedupSelections(prev => ({
                                              ...prev,
                                              [gi]: { ...(prev[gi] || {}), [field.key]: idx },
                                            }))
                                          } : idx === 0 && !allSame && !['item_id', 'created_at', 'created_by'].includes(field.key) ? () => {
                                            setDedupSelections(prev => {
                                              const next = { ...prev, [gi]: { ...(prev[gi] || {}) } }
                                              delete next[gi][field.key]
                                              return next
                                            })
                                          } : undefined}
                                          style={{
                                            padding: '6px 12px', borderBottom: `1px solid ${s.border}`,
                                            color: idx === 0 ? s.text : s.textSecondary,
                                            maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis',
                                            cursor: (!allSame && !['item_id', 'created_at', 'created_by'].includes(field.key)) ? 'pointer' : 'default',
                                            background: isSelected ? 'rgba(224,124,62,0.15)' : isWinnerDefault ? 'rgba(34,197,94,0.06)' : 'transparent',
                                            borderLeft: isSelected ? '3px solid #e07c3e' : isWinnerDefault ? '3px solid rgba(34,197,94,0.3)' : '3px solid transparent',
                                            transition: 'all 0.1s',
                                          }}
                                        >
                                          {field.key === 'status' ? <StatusBadge status={val} /> : val}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Sprint Kanban View ─── */}
      {view === 'sprints' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          {sprintCards.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
              <Icon name="bolt" size={32} color={s.textMuted} />
              <div style={{ marginTop: 8 }}>No sprints yet — select items and Create Sprint</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 16, height: '100%', paddingBottom: 8 }}>
              {SPRINT_PHASES.map(phase => {
                const phaseConfig = PHASE_CONFIG[phase]
                const phasesprints = sprintCards.filter(sp => sp.phase === phase)
                return (
                  <div
                    key={phase}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSprintDragOver(phase) }}
                    onDragLeave={() => setSprintDragOver(null)}
                    onDrop={(e) => handleSprintDrop(e, phase)}
                    style={{
                    width: 280, minWidth: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
                    borderRadius: 10, background: 'rgba(255,255,255,0.01)',
                    border: `1px solid ${sprintDragOver === phase ? (phaseConfig.color) : s.border}`,
                    transition: 'border-color 0.15s',
                  }}>
                    {/* Column header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderBottom: `1px solid ${s.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: phaseConfig.color }} />
                        <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: s.textSecondary }}>
                          {phaseConfig.label}
                        </span>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: s.surface, color: s.textMuted, fontWeight: 600 }}>
                        {phasesprints.length}
                      </span>
                    </div>

                    {/* Sprint cards */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {phasesprints.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: s.textMuted }}>No sprints</div>
                      ) : phasesprints.map(sp => {
                        const pct = sp.total > 0 ? Math.round((sp.confirmed / sp.total) * 100) : 0
                        return (
                          <div
                            key={sp.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', JSON.stringify({ sprintId: sp.id, fromPhase: phase }))
                              e.dataTransfer.effectAllowed = 'move'
                            }}
                            style={{
                              background: s.surface, borderRadius: 8, border: `1px solid ${s.border}`,
                              padding: 14, cursor: 'grab',
                            }}
                            onClick={() => { setFilters(f => ({ ...f, sprint_id: sp.id })); setView('grid') }}
                          >
                            {/* Name + action */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <Icon name="bolt" size={16} color="rgb(245,158,11)" />
                              <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{sp.name}</span>
                            </div>

                            {/* Description */}
                            {sp.description && (
                              <div style={{ fontSize: 11, color: s.textMuted, marginBottom: 8, lineHeight: 1.4 }}>{sp.description}</div>
                            )}

                            {/* Discovery URL */}
                            {sp.discovery_url && (
                              <a
                                href={sp.discovery_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 10, color: s.portal, marginBottom: 8, textDecoration: 'none',
                                }}
                                onMouseEnter={(e) => { (e.currentTarget.style.textDecoration = 'underline') }}
                                onMouseLeave={(e) => { (e.currentTarget.style.textDecoration = 'none') }}
                              >
                                <Icon name="link" size={12} color={s.portal} />
                                Discovery
                              </a>
                            )}

                            {/* Progress */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                              <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
                                <div style={{
                                  width: `${pct}%`, height: '100%', borderRadius: 2,
                                  background: pct === 100 ? 'rgb(34,197,94)' : phaseConfig.color,
                                  transition: 'width 0.3s',
                                }} />
                              </div>
                              <span style={{ fontSize: 10, color: s.textMuted }}>{sp.confirmed}/{sp.total}</span>
                            </div>

                            {/* Type pills */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                              {sp.bugs > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)', fontWeight: 600 }}>{sp.bugs} bug{sp.bugs > 1 ? 's' : ''}</span>}
                              {sp.enhancements > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(245,158,11,0.12)', color: 'rgb(245,158,11)', fontWeight: 600 }}>{sp.enhancements} enh</span>}
                              {sp.features > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(168,85,247,0.12)', color: 'rgb(168,85,247)', fontWeight: 600 }}>{sp.features} feat</span>}
                              {sp.questions > 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', color: 'rgb(59,130,246)', fontWeight: 600 }}>{sp.questions} q</span>}
                            </div>

                            {/* Phase action button */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                if (phase === 'in_sprint') generatePrompt(sp.id, 'discovery')
                                else if (phase === 'planned') generatePrompt(sp.id, 'building')
                                else if (phase === 'built') generateAuditPrompt(sp.id)
                                else if (phase === 'audited') {
                                  try {
                                    const r = await fetchWithAuth(`${API_BASE}/sprints/${sp.id}/sendit`, { method: 'POST' })
                                    if (r.ok) { await loadItems(); await loadSprints() }
                                  } catch { /* silent */ }
                                }
                                else if (phase === 'confirmed') reopenSprint(sp.id)
                              }}
                              disabled={phase === 'confirmed' && reopeningSprintId === sp.id}
                              style={{
                                width: '100%', padding: '6px 0', borderRadius: 6,
                                border: phase === 'confirmed' ? '1px solid rgb(245,158,11)' : 'none',
                                background: phase === 'confirmed'
                                  ? (reopeningSprintId === sp.id ? 'rgb(245,158,11)' : 'transparent')
                                  : phaseConfig.color,
                                color: phase === 'confirmed'
                                  ? (reopeningSprintId === sp.id ? '#fff' : 'rgb(245,158,11)')
                                  : '#fff',
                                fontSize: 12, fontWeight: 600,
                                cursor: reopeningSprintId === sp.id ? 'wait' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <Icon name={
                                (phase === 'confirmed' && reopeningSprintId === sp.id) ? 'sync' :
                                phase === 'in_sprint' ? 'terminal' :
                                phase === 'planned' ? 'terminal' :
                                phase === 'built' ? 'fact_check' :
                                phase === 'confirmed' ? 'undo' :
                                'rocket_launch'
                              } size={14} color={phase === 'confirmed' ? (reopeningSprintId === sp.id ? '#fff' : 'rgb(245,158,11)') : '#fff'} />
                              {(phase === 'confirmed' && reopeningSprintId === sp.id) ? 'Reopening...' : phaseConfig.actionLabel}
                            </button>

                            {/* Audit Walkthrough link for sprints ready for/in audit */}
                            {(phase === 'built' || phase === 'audited') && (
                              <a
                                href={`/modules/forge/audit?sprint=${sp.id}`}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: '100%', padding: '5px 0', borderRadius: 6,
                                  border: `1px solid #e07c3e`, marginTop: 4,
                                  background: 'transparent', color: '#e07c3e', fontSize: 11, fontWeight: 600,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                  textDecoration: 'none',
                                }}
                              >
                                <Icon name="fact_check" size={13} color="#e07c3e" />
                                Audit Walkthrough
                              </a>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Workflow (Kanban) View ─── */}
      {view === 'workflow' && (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <KanbanBoard columns={kanbanColumns} emptyMessage="No items match your filters" onCardMove={handleCardMove} />
        </div>
      )}

      {/* ─── Grid View ─── */}
      {view === 'grid' && <>
      <div style={{ flex: 1, overflowY: 'auto', borderRadius: 8, border: `1px solid ${s.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: s.surface, position: 'sticky', top: 0, zIndex: 5 }}>
              <th style={{ padding: '10px 8px', width: 40, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={pagedItems.length > 0 && selectedIds.size === pagedItems.length}
                  onChange={toggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              {[
                { key: 'item_id', label: 'ID' },
                { key: 'type', label: 'Type' },
                { key: 'title', label: 'Title' },
                { key: 'component', label: 'Component' },
                { key: 'section', label: 'Section' },
                { key: 'portal', label: 'Portal' },
                { key: 'status', label: 'Status' },
                { key: 'sprint_id', label: 'Sprint' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => {
                    if (sortField === col.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                    else { setSortField(col.key); setSortDir('asc') }
                    setPage(0)
                  }}
                  style={{
                    padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 11,
                    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                    color: sortField === col.key ? s.text : s.textSecondary,
                    userSelect: 'none',
                  }}
                >
                  {col.label} {sortField === col.key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>Loading...</td></tr>
            ) : pagedItems.length === 0 ? (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: s.textMuted }}>
                <Icon name="inventory_2" size={32} color={s.textMuted} />
                <div style={{ marginTop: 8 }}>No items found</div>
              </td></tr>
            ) : pagedItems.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status]
              const borderColor = statusCfg ? statusCfg.color : s.textMuted
              const selected = selectedIds.has(item.id)
              const sprintName = sprints.find(sp => sp.id === item.sprint_id)?.name || '—'
              return (
                <tr
                  key={item.id}
                  onClick={() => openEdit(item)}
                  style={{
                    cursor: 'pointer',
                    borderLeft: `3px solid ${borderColor}`,
                    background: selected ? 'rgba(74,122,181,0.08)' : 'transparent',
                    borderBottom: `1px solid ${s.border}`,
                  }}
                  onMouseEnter={(e) => { if (!selected) (e.currentTarget.style.background = s.hover) }}
                  onMouseLeave={(e) => { if (!selected) (e.currentTarget.style.background = 'transparent') }}
                >
                  <td style={{ padding: '8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelect(item.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px', color: s.textMuted, fontFamily: 'monospace', fontSize: 11 }}>{item.item_id}</td>
                  <td style={{ padding: '8px 12px' }}>{(() => {
                    const tc = TYPE_CONFIG[item.type]
                    return tc ? <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: tc.bg, color: tc.color, whiteSpace: 'nowrap' }}>{tc.label}</span> : <span style={{ color: s.textMuted, fontSize: 11 }}>—</span>
                  })()}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {item.title}
                      {item.discovery_url && (
                        <a href={item.discovery_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Discovery URL">
                          <Icon name="link" size={14} color={s.portal} />
                        </a>
                      )}
                      {item.plan_link && (
                        <a href={item.plan_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="Plan Link">
                          <Icon name="description" size={14} color="rgb(245,158,11)" />
                        </a>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary }}>{item.component || '—'}</td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary }}>{item.section || '—'}</td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary, fontSize: 11 }}>{item.portal || '—'}</td>
                  <td style={{ padding: '8px 12px' }}><StatusBadge status={item.status} /></td>
                  <td style={{ padding: '8px 12px', color: s.textSecondary, fontSize: 12 }}>{sprintName}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 0', fontSize: 12, color: s.textSecondary,
      }}>
        <span>
          Showing {items.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, items.length)} of {items.length}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '4px 12px', borderRadius: 6, border: `1px solid ${s.border}`,
              background: 'transparent', color: page === 0 ? s.textMuted : s.textSecondary,
              cursor: page === 0 ? 'default' : 'pointer', fontSize: 12,
            }}
          >
            Previous
          </button>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              padding: '4px 12px', borderRadius: 6, border: `1px solid ${s.border}`,
              background: 'transparent', color: page >= totalPages - 1 ? s.textMuted : s.textSecondary,
              cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 12,
            }}
          >
            Next
          </button>
        </div>
      </div>
      </>}

      {/* ─── Edit Slide-Out ─── */}
      {editItem && (
        <>
          <div
            onClick={closeEdit}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40,
            }}
          />
          <div
            onPaste={handlePaste}
            style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 50,
            background: s.bg, borderLeft: `1px solid ${s.border}`,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${s.border}`,
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: s.textMuted }}>{editForm.item_id}</span>
              <button onClick={closeEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.textMuted }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              <FormInput label="Title" value={editForm.title || ''} onChange={(v) => setEditForm(f => ({ ...f, title: v }))} />
              <FormInput label="Description" value={editForm.description || ''} onChange={(v) => setEditForm(f => ({ ...f, description: v }))} textarea />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormSelect label="Portal" value={editForm.portal || ''} onChange={(v) => setEditForm(f => ({ ...f, portal: v }))}
                  options={PORTALS.map(p => ({ value: p, label: p }))} />
                <FormSelect label="Scope" value={editForm.scope || ''} onChange={(v) => setEditForm(f => ({ ...f, scope: v }))}
                  options={SCOPES.map(sc => ({ value: sc, label: sc }))} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormSelect label="Type" value={editForm.type || ''} onChange={(v) => setEditForm(f => ({ ...f, type: v }))}
                  options={TYPES.map(t => ({ value: t, label: TYPE_CONFIG[t]?.label || t }))} />
                <FormSelect label="Status" value={editForm.status || ''} onChange={(v) => setEditForm(f => ({ ...f, status: v }))}
                  options={STATUSES.map(st => ({ value: st, label: STATUS_CONFIG[st]?.label || st }))} />
              </div>
              <FormInput label="Component" value={editForm.component || ''} onChange={(v) => setEditForm(f => ({ ...f, component: v }))} />
              <FormInput label="Section" value={editForm.section || ''} onChange={(v) => setEditForm(f => ({ ...f, section: v }))} />
              <FormSelect label="Sprint" value={editForm.sprint_id || ''} onChange={(v) => setEditForm(f => ({ ...f, sprint_id: v || null }))}
                options={sprints.map(sp => ({ value: sp.id, label: sp.name }))} />
              {/* Discovery URL */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Discovery URL</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span className="material-icons-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted, #64748b)' }}>link</span>
                    <input
                      type="url"
                      placeholder="Where was this found? (URL)"
                      value={editForm.discovery_url || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, discovery_url: e.target.value || null }))}
                      style={{
                        width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
                        borderRadius: 6, padding: '8px 10px 8px 30px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                  {editForm.discovery_url && (
                    <a href={editForm.discovery_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      title="Open Discovery URL"
                    >
                      <Icon name="open_in_new" size={16} color={s.portal} />
                    </a>
                  )}
                </div>
              </div>
              {/* Plan Link */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Plan Link</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <span className="material-icons-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted, #64748b)' }}>description</span>
                    <input
                      type="url"
                      placeholder="Link to plan document (URL)"
                      value={editForm.plan_link || ''}
                      onChange={(e) => setEditForm(f => ({ ...f, plan_link: e.target.value || null }))}
                      style={{
                        width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
                        borderRadius: 6, padding: '8px 10px 8px 30px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                  {editForm.plan_link && (
                    <a href={editForm.plan_link} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                      title="Open Plan Link"
                    >
                      <Icon name="open_in_new" size={16} color={s.portal} />
                    </a>
                  )}
                </div>
              </div>
              <FormInput label="Notes" value={editForm.notes || ''} onChange={(v) => setEditForm(f => ({ ...f, notes: v }))} textarea />

              {/* Attachments */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, color: s.textSecondary, marginBottom: 6 }}>
                  Attachments {uploading && <span style={{ color: 'rgb(245,158,11)' }}> — uploading...</span>}
                </label>

                {/* Existing thumbnails */}
                {(editItem?.attachments || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {(editItem?.attachments || []).map((att) => {
                      const isImage = att.content_type?.startsWith('image/')
                      return (
                        <div key={att.name} style={{
                          position: 'relative', width: 96, borderRadius: 6,
                          border: `1px solid ${s.border}`, overflow: 'hidden', background: s.surface,
                        }}>
                          {isImage ? (
                            <a href={att.url} target="_blank" rel="noopener noreferrer">
                              <img
                                src={att.url}
                                alt={att.original_name}
                                style={{ width: 96, height: 72, objectFit: 'cover', display: 'block' }}
                              />
                            </a>
                          ) : (
                            <a href={att.url} target="_blank" rel="noopener noreferrer" style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 96, height: 72, textDecoration: 'none',
                            }}>
                              <Icon name="attach_file" size={24} color={s.textMuted} />
                            </a>
                          )}
                          <div style={{ padding: '4px 6px', fontSize: 9, color: s.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {att.original_name} ({formatSize(att.size)})
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAttachment(att.name) }}
                            style={{
                              position: 'absolute', top: 2, right: 2, width: 20, height: 20,
                              borderRadius: '50%', border: 'none', cursor: 'pointer',
                              background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = 'image/*,.pdf,.txt,.json'
                    input.multiple = true
                    input.onchange = () => {
                      if (input.files) Array.from(input.files).forEach(f => uploadAttachment(f))
                    }
                    input.click()
                  }}
                  style={{
                    border: `2px dashed ${dragOver ? '#e07c3e' : s.border}`,
                    borderRadius: 8, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
                    background: dragOver ? 'rgba(224,124,62,0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon name="cloud_upload" size={22} color={dragOver ? '#e07c3e' : s.textMuted} />
                  <div style={{ fontSize: 12, color: s.textMuted, marginTop: 4 }}>
                    Drop files, paste screenshots (Cmd+V), or click to browse
                  </div>
                  <div style={{ fontSize: 10, color: s.textMuted, marginTop: 2 }}>Max 5MB per file, 10 per item</div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${s.border}` }}>
                <div style={{ fontSize: 11, color: s.textMuted, marginBottom: 4 }}>Created: {formatDate(editItem.created_at)} by {editItem.created_by || '—'}</div>
                <div style={{ fontSize: 11, color: s.textMuted }}>Updated: {formatDate(editItem.updated_at)}</div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px',
              borderTop: `1px solid ${s.border}`,
            }}>
              <button
                onClick={deleteItem}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: '1px solid rgb(239,68,68)',
                  background: 'transparent', color: 'rgb(239,68,68)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Delete
              </button>
              {editItem?.status !== 'confirmed' ? (
                <button
                  onClick={confirmItem}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: 'rgb(34,197,94)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="check_circle" size={16} color="#fff" /> Confirm
                </button>
              ) : (
                <button
                  onClick={unconfirmItem}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: '1px solid rgb(245,158,11)',
                    background: 'transparent', color: 'rgb(245,158,11)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <Icon name="undo" size={16} color="rgb(245,158,11)" /> Unconfirm
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={closeEdit}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: s.portal, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Create Sprint Modal ─── */}
      {showCreateSprint && (
        <>
          <div
            onClick={() => setShowCreateSprint(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 440, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12,
            padding: 24, zIndex: 60,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Create Sprint</span>
              <button onClick={() => setShowCreateSprint(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>
            <p style={{ fontSize: 12, color: s.textSecondary, marginBottom: 16 }}>
              {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} will be assigned to this sprint.
            </p>
            <FormInput label="Sprint Name" value={sprintForm.name} onChange={(v) => setSprintForm(f => ({ ...f, name: v }))} />
            <FormInput label="Description" value={sprintForm.description} onChange={(v) => setSprintForm(f => ({ ...f, description: v }))} textarea />
            {/* Discovery URL */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary, #94a3b8)', marginBottom: 4 }}>Discovery URL</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span className="material-icons-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-muted, #64748b)' }}>link</span>
                  <input
                    type="url"
                    placeholder="Where was this found? (URL)"
                    value={sprintForm.discovery_url}
                    onChange={(e) => setSprintForm(f => ({ ...f, discovery_url: e.target.value }))}
                    style={{
                      width: '100%', background: 'var(--bg-surface, #1c2333)', border: '1px solid var(--border-color, #2a3347)',
                      borderRadius: 6, padding: '8px 10px 8px 30px', color: 'var(--text-primary, #e2e8f0)', fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
                {sprintForm.discovery_url && (
                  <a href={sprintForm.discovery_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: `1px solid ${s.border}`, background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
                    title="Open Discovery URL"
                  >
                    <Icon name="open_in_new" size={16} color={s.portal} />
                  </a>
                )}
              </div>
            </div>
            {/* ─── Discovery Import Section ─── */}
            <div style={{ marginTop: 16, borderTop: `1px solid ${s.border}`, paddingTop: 16 }}>
              <button
                onClick={() => setShowDiscoveryImport(!showDiscoveryImport)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  color: s.textSecondary, fontSize: 13,
                }}
              >
                <Icon name={showDiscoveryImport ? 'expand_less' : 'expand_more'} size={18} color={s.textSecondary} />
                <Icon name="description" size={16} color={s.portal} />
                Or Import from Discovery Document
              </button>

              {showDiscoveryImport && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    placeholder="Paste discovery markdown here, or drop a .md/.txt file..."
                    value={discoveryContent}
                    onChange={(e) => setDiscoveryContent(e.target.value)}
                    onDrop={handleDiscoveryDrop}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                      width: '100%', minHeight: 120, background: s.surface,
                      border: `1px solid ${s.border}`, borderRadius: 8, padding: 12,
                      color: s.text, fontSize: 12, fontFamily: 'monospace', lineHeight: 1.5,
                      resize: 'vertical', outline: 'none',
                    }}
                  />

                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={previewDiscovery}
                      disabled={!discoveryContent.trim() || discoveryPreviewing}
                      style={{
                        padding: '6px 14px', borderRadius: 6, border: `1px solid ${s.border}`,
                        background: 'transparent', color: !discoveryContent.trim() ? s.textMuted : s.textSecondary,
                        fontSize: 12, cursor: !discoveryContent.trim() ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {discoveryPreviewing ? 'Previewing...' : 'Preview'}
                    </button>
                    {discoveryPreview && (
                      <button
                        onClick={importDiscovery}
                        disabled={discoveryImporting}
                        style={{
                          padding: '6px 14px', borderRadius: 6, border: 'none',
                          background: s.portal, color: '#fff',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {discoveryImporting ? 'Importing...' : `Import ${discoveryPreview.items_created} Items`}
                      </button>
                    )}
                  </div>

                  {discoveryPreview && (
                    <div style={{
                      marginTop: 12, padding: 12, borderRadius: 8,
                      background: s.surface, border: `1px solid ${s.border}`,
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: s.text }}>
                        {String(discoveryPreview.sprint_name || '')}
                      </p>
                      <p style={{ fontSize: 11, color: s.textMuted, marginTop: 4 }}>
                        {String(discoveryPreview.items_created || 0)} items found
                      </p>
                      <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                        {(discoveryPreview.items as Array<Record<string, unknown>> | undefined)?.slice(0, 10).map((item: Record<string, unknown>, i: number) => (
                          <li key={i} style={{ fontSize: 11, color: s.textSecondary, marginTop: 2 }}>
                            {String(item.title || item.item_id || `Item ${i + 1}`)}
                          </li>
                        ))}
                        {((discoveryPreview.items as Array<Record<string, unknown>> | undefined)?.length || 0) > 10 && (
                          <li style={{ fontSize: 11, color: s.textMuted, marginTop: 2 }}>
                            ...and {(discoveryPreview.items as Array<Record<string, unknown>>).length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setShowCreateSprint(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={createSprint}
                disabled={!sprintForm.name.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: !sprintForm.name.trim() ? s.textMuted : s.portal,
                  color: '#fff', fontSize: 13, fontWeight: 600, cursor: !sprintForm.name.trim() ? 'default' : 'pointer',
                }}
              >
                Create Sprint
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─── Prompt Generator Modal ─── */}
      {showPrompt && (
        <>
          <div
            onClick={() => setShowPrompt(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 640, maxHeight: '80vh', background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12, padding: 24, zIndex: 60, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Sprint Prompt</span>
              <button onClick={() => setShowPrompt(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>
            <textarea
              readOnly
              value={promptText}
              style={{
                flex: 1, minHeight: 320, width: '100%', background: s.surface,
                border: `1px solid ${s.border}`, borderRadius: 8, padding: 16,
                color: s.text, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setShowPrompt(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={printPrompt}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon name="print" size={14} color={s.textSecondary} /> Print / PDF
              </button>
              <button
                onClick={copyPrompt}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: '#e07c3e', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon name="content_copy" size={14} color="#fff" /> Copy to Clipboard
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
