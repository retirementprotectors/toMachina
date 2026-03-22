'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/* ─── Types ─── */
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
  plan_link: string | null
  notes: string
  attachments?: { name: string; url: string; content_type: string }[]
  audit_round?: number
  audit_status?: string | null
  audit_notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

type Verdict = 'done' | 'not_done' | null

interface WalkthroughEntry {
  item: TrackerItem
  verdict: Verdict
  whatsWrong: string
  findings: string
  media: MediaCapture[]
}

interface MediaCapture {
  type: 'screenshot' | 'video'
  dataUrl: string
  blob?: Blob
  name: string
}

interface ItemGroup {
  key: string
  label: string
  machine: 'PRO' | 'AIR'
  items: TrackerItem[]
}

/* ─── Constants ─── */
const API_BASE = '/api'

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  broken:      { color: 'rgb(239,68,68)',  bg: 'rgba(239,68,68,0.15)',  label: 'Bug' },
  bug:         { color: 'rgb(239,68,68)',  bg: 'rgba(239,68,68,0.15)',  label: 'Bug' },
  idea:        { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  feat:        { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  feature:     { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  improve:     { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Enhancement' },
  enhancement: { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Enhancement' },
  question:    { color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.15)', label: 'Question' },
  test:        { color: 'rgb(20,184,166)', bg: 'rgba(20,184,166,0.15)', label: 'Test' },
}

/*
 * Machine assignment logic:
 * PRO = PRODASH-specific modules + Data migrations + ATLAS (apps/prodash/, services/api/routes, new ATLAS files)
 * AIR = SHARED UI + INFRA/OS + Feature wiring (packages/ui/shared, _RPI_STANDARDS/, hookify)
 * Goal: minimize file overlap so both machines can commit/PR independently
 */
const PRO_COMPONENTS = new Set([
  'Contacts Grid', 'Contact Detail', 'DeDup', 'Accounts Grid',
  'Quick Intake', 'MyRPI', 'Data Issues', 'Data',
  'Firestore Migration', 'Agent/User Plumbing',
  'ATLAS Frontend', 'ATLAS', 'Introspect', 'Bridge',
])

const AIR_COMPONENTS = new Set([
  'Sidebar', 'Header', 'RPI Connect', 'Communications',
  'Incoming Calls', 'Admin Panel', 'Admin',
  'Report Button', 'FORGE', 'C3 Campaign Engine', 'C3',
  'MyDropZone', 'INFRA', 'OS Audit', 'Operating System',
])

function assignMachine(item: TrackerItem): 'PRO' | 'AIR' {
  const comp = item.component || ''
  const section = item.section || ''
  const combined = `${comp} ${section} ${item.title}`.toLowerCase()

  // Check explicit component matches
  for (const c of PRO_COMPONENTS) {
    if (comp === c || section === c) return 'PRO'
  }
  for (const c of AIR_COMPONENTS) {
    if (comp === c || section === c) return 'AIR'
  }

  // Keyword-based fallback
  if (combined.includes('contact') || combined.includes('dedup') || combined.includes('account') ||
      combined.includes('intake') || combined.includes('myrpi') || combined.includes('atlas') ||
      combined.includes('introspect') || combined.includes('bridge') || combined.includes('migration') ||
      combined.includes('agent_') || combined.includes('assigned_user') || combined.includes('npn') ||
      combined.includes('npi') || combined.includes('producer') || combined.includes('bob') ||
      combined.includes('acf')) {
    return 'PRO'
  }
  if (combined.includes('sidebar') || combined.includes('header') || combined.includes('connect') ||
      combined.includes('comms') || combined.includes('communication') || combined.includes('call') ||
      combined.includes('admin') || combined.includes('forge') || combined.includes('report button') ||
      combined.includes('c3') || combined.includes('campaign') || combined.includes('dropzone') ||
      combined.includes('hookify') || combined.includes('monitoring') || combined.includes('posture') ||
      combined.includes('immune') || combined.includes('standards') || combined.includes('symlink') ||
      combined.includes('launchd') || combined.includes('firestore.rules') || combined.includes('iam') ||
      combined.includes('npm audit') || combined.includes('node.js') || combined.includes('dkim') ||
      combined.includes('clone-all') || combined.includes('machine-check') || combined.includes('mcp server')) {
    return 'AIR'
  }

  // Portal-based fallback
  if (item.portal === 'PRODASHX') return 'PRO'
  if (item.portal === 'SHARED' || item.portal === 'INFRA') return 'AIR'
  if (item.portal === 'DATA') return 'PRO'

  return 'AIR' // default shared/infra work to AIR
}

function groupItems(items: TrackerItem[]): ItemGroup[] {
  const groups = new Map<string, { label: string; machine: 'PRO' | 'AIR'; items: TrackerItem[] }>()

  for (const item of items) {
    // Build a group key from component or fallback to section or portal
    const groupKey = item.component || item.section || item.portal || 'Other'
    const machine = assignMachine(item)

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { label: groupKey, machine, items: [] })
    }
    groups.get(groupKey)!.items.push(item)
  }

  // Sort: PRO groups first, then AIR, alphabetical within
  return Array.from(groups.entries())
    .map(([key, g]) => ({ key, ...g }))
    .sort((a, b) => {
      if (a.machine !== b.machine) return a.machine === 'PRO' ? -1 : 1
      return a.label.localeCompare(b.label)
    })
}

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
  copper: '#e07c3e',
}

const MACHINE_COLORS = {
  PRO: { color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.12)', icon: 'computer' },
  AIR: { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.12)', icon: 'laptop_mac' },
}

/* ─── Helpers ─── */
function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  return <span className="material-icons-outlined" style={{ fontSize: size, color }}>{name}</span>
}

async function captureScreenshot(): Promise<string | null> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' } as MediaTrackConstraintSet,
      audio: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      preferCurrentTab: true,
    } as any)
    const video = document.createElement('video')
    video.srcObject = stream
    video.playsInline = true
    await video.play()
    await new Promise(r => setTimeout(r, 150))
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.drawImage(video, 0, 0)
    stream.getTracks().forEach(t => t.stop())
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/* ─── Main Component ─── */
interface ForgeConfirmWalkthroughProps {
  portal: string
}

export function ForgeConfirmWalkthrough({ portal }: ForgeConfirmWalkthroughProps) {
  const [allItems, setAllItems] = useState<TrackerItem[]>([])
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<Record<string, WalkthroughEntry>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitResults, setSubmitResults] = useState<{ done: number; notDone: number; found: number } | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [activeRecordings, setActiveRecordings] = useState<Record<string, MediaRecorder>>({})
  const [machineFilter, setMachineFilter] = useState<'ALL' | 'PRO' | 'AIR'>('ALL')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  // Found Something modal
  const [foundOpen, setFoundOpen] = useState(false)
  const [foundTitle, setFoundTitle] = useState('')
  const [foundDescription, setFoundDescription] = useState('')
  const [foundScreenshot, setFoundScreenshot] = useState<string | null>(null)
  const [foundDragOver, setFoundDragOver] = useState(false)
  const [foundSubmitting, setFoundSubmitting] = useState(false)
  const [foundSubmitted, setFoundSubmitted] = useState(false)
  const [foundCount, setFoundCount] = useState(0)

  /* ─── Data Loading ─── */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker?status=audited&limit=1000`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) setAllItems(json.data || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ─── Derived ─── */
  const groups = useMemo(() => groupItems(allItems), [allItems])

  const filteredGroups = useMemo(() => {
    if (machineFilter === 'ALL') return groups
    return groups.filter(g => g.machine === machineFilter)
  }, [groups, machineFilter])

  const machineCounts = useMemo(() => {
    let pro = 0, air = 0
    for (const g of groups) {
      if (g.machine === 'PRO') pro += g.items.length
      else air += g.items.length
    }
    return { PRO: pro, AIR: air, ALL: pro + air }
  }, [groups])

  const summary = useMemo(() => {
    const visibleItems = filteredGroups.flatMap(g => g.items)
    const done = visibleItems.filter(i => entries[i.id]?.verdict === 'done').length
    const notDone = visibleItems.filter(i => entries[i.id]?.verdict === 'not_done').length
    const unreviewed = visibleItems.length - done - notDone
    return { done, notDone, unreviewed, total: visibleItems.length }
  }, [filteredGroups, entries])

  /* ─── Entry Helpers ─── */
  const initEntry = (item: TrackerItem): WalkthroughEntry => {
    return entries[item.id] || { item, verdict: null, whatsWrong: '', findings: '', media: [] }
  }

  const updateEntry = (itemId: string, updates: Partial<WalkthroughEntry>) => {
    setEntries(prev => {
      const item = allItems.find(i => i.id === itemId)
      if (!item) return prev
      const existing = prev[itemId] || initEntry(item)
      return { ...prev, [itemId]: { ...existing, ...updates } }
    })
  }

  /* ─── Media Handlers ─── */
  const handleScreenshot = async (itemId: string) => {
    const dataUrl = await captureScreenshot()
    if (!dataUrl) return
    const entry = entries[itemId] || initEntry(allItems.find(i => i.id === itemId)!)
    const media: MediaCapture = { type: 'screenshot', dataUrl, name: `confirm-screenshot-${Date.now()}.png` }
    updateEntry(itemId, { media: [...entry.media, media] })
  }

  const handleStartRecording = async (itemId: string) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' } as MediaTrackConstraintSet,
        audio: false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preferCurrentTab: true,
      } as any)
      const chunks: Blob[] = []
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        setActiveRecordings(prev => { const next = { ...prev }; delete next[itemId]; return next })
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const entry = entries[itemId] || initEntry(allItems.find(i => i.id === itemId)!)
        const media: MediaCapture = { type: 'video', dataUrl: url, blob, name: `confirm-recording-${Date.now()}.webm` }
        updateEntry(itemId, { media: [...entry.media, media] })
      }
      stream.getVideoTracks()[0].onended = () => { if (recorder.state === 'recording') recorder.stop() }
      recorder.start()
      setActiveRecordings(prev => ({ ...prev, [itemId]: recorder }))
    } catch { /* user cancelled */ }
  }

  const handleStopRecording = (itemId: string) => {
    const recorder = activeRecordings[itemId]
    if (recorder && recorder.state === 'recording') recorder.stop()
  }

  const removeMedia = (itemId: string, mediaIndex: number) => {
    const entry = entries[itemId]
    if (!entry) return
    updateEntry(itemId, { media: entry.media.filter((_, i) => i !== mediaIndex) })
  }

  const handlePaste = (e: React.ClipboardEvent, itemId: string) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = () => {
          const entry = entries[itemId] || initEntry(allItems.find(i => i.id === itemId)!)
          const media: MediaCapture = { type: 'screenshot', dataUrl: reader.result as string, name: `confirm-paste-${Date.now()}.png` }
          updateEntry(itemId, { media: [...entry.media, media] })
        }
        reader.readAsDataURL(file)
      }
    }
  }

  /* ─── Group Collapse ─── */
  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  /* ─── Found Something ─── */
  const handleFoundOpen = useCallback(() => {
    setFoundTitle('')
    setFoundDescription('')
    setFoundScreenshot(null)
    setFoundSubmitted(false)
    setFoundOpen(true)
  }, [])

  const handleFoundClose = useCallback(() => {
    setFoundOpen(false)
    setFoundTitle('')
    setFoundDescription('')
    setFoundScreenshot(null)
    setFoundSubmitted(false)
    setFoundDragOver(false)
  }, [])

  const handleFoundPaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = () => setFoundScreenshot(reader.result as string)
        reader.readAsDataURL(file)
      }
    }
  }, [])

  const handleFoundDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setFoundDragOver(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setFoundScreenshot(reader.result as string)
      reader.readAsDataURL(file)
    }
  }, [])

  const handleFoundScreenshot = useCallback(async () => {
    const dataUrl = await captureScreenshot()
    if (dataUrl) setFoundScreenshot(dataUrl)
  }, [])

  const handleFoundSubmit = useCallback(async () => {
    if (!foundTitle.trim() || foundSubmitting) return
    setFoundSubmitting(true)
    try {
      const res = await fetchWithAuth(`${API_BASE}/tracker`, {
        method: 'POST',
        body: JSON.stringify({
          title: foundTitle.trim(),
          description: foundDescription.trim() || '',
          status: 'queue',
          type: 'broken',
          portal: portal.toUpperCase().replace('PRODASH', 'PRODASHX'),
          scope: 'Module',
          component: '',
          section: '',
          notes: 'Discovered during Confirm Walkthrough',
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const newItem = json.data
        const itemId = newItem?.id || newItem?.item_id

        if (itemId && foundScreenshot) {
          const base64 = foundScreenshot.split(',')[1]
          await fetchWithAuth(`${API_BASE}/tracker/${itemId}/attachments`, {
            method: 'POST',
            body: JSON.stringify({
              name: `found-screenshot-${Date.now()}.png`,
              data: base64,
              content_type: 'image/png',
            }),
          })
        }
        setFoundCount(prev => prev + 1)
        setFoundSubmitted(true)
        setTimeout(handleFoundClose, 1200)
      }
    } catch { /* silent */ }
    setFoundSubmitting(false)
  }, [foundTitle, foundDescription, foundScreenshot, portal, foundSubmitting, handleFoundClose])

  /* ─── Submit Walkthrough ─── */
  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)

    let doneCount = 0
    let notDoneCount = 0
    const failedItems: { item: TrackerItem; entry: WalkthroughEntry }[] = []

    try {
      const visibleItems = filteredGroups.flatMap(g => g.items)

      // 1. DONE items — move audited → confirmed
      const doneItems = visibleItems.filter(i => entries[i.id]?.verdict === 'done')
      await Promise.all(doneItems.map(async (item) => {
        const res = await fetchWithAuth(`${API_BASE}/tracker/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'confirmed',
            audit_status: 'ceo_confirmed',
            audit_notes: entries[item.id]?.findings || 'CEO visual confirmation passed',
          }),
        })
        if (res.ok) doneCount++
      }))

      // 2. NOT DONE items — move back to 'built', set audit_status='ceo_rejected'
      const notDoneItems = visibleItems.filter(i => entries[i.id]?.verdict === 'not_done')
      await Promise.all(notDoneItems.map(async (item) => {
        const entry = entries[item.id]
        if (!entry) return

        const auditNotes = [entry.whatsWrong, entry.findings].filter(Boolean).join(' | ')

        await fetchWithAuth(`${API_BASE}/tracker/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'built',
            audit_status: 'ceo_rejected',
            audit_notes: auditNotes || 'CEO visual confirmation failed',
          }),
        })

        notDoneCount++
        failedItems.push({ item, entry })

        // Upload media
        if (entry.media.length > 0) {
          for (const m of entry.media) {
            let base64: string
            let contentType: string
            if (m.type === 'screenshot') {
              base64 = m.dataUrl.split(',')[1]
              contentType = 'image/png'
            } else if (m.blob) {
              base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve((reader.result as string).split(',')[1])
                reader.readAsDataURL(m.blob!)
              })
              contentType = 'video/webm'
            } else {
              continue
            }
            await fetchWithAuth(`${API_BASE}/tracker/${item.id}/attachments`, {
              method: 'POST',
              body: JSON.stringify({ name: m.name, data: base64, content_type: contentType }),
            })
          }
        }
      }))

      // 3. Generate #NightShift prompt split by machine
      if (failedItems.length > 0 || foundCount > 0) {
        const proFails = failedItems.filter(f => assignMachine(f.item) === 'PRO')
        const airFails = failedItems.filter(f => assignMachine(f.item) === 'AIR')

        const lines = [
          `# #NightShift — Confirm Walkthrough Results`,
          '',
          `CEO Visual Confirmation: ${doneCount} passed, ${notDoneCount} rejected${foundCount > 0 ? `, ${foundCount} new items found` : ''}`,
          '',
        ]

        if (proFails.length > 0) {
          lines.push('## PRO Machine (PRODASH + Data + ATLAS)')
          lines.push('')
          proFails.forEach((f, i) => {
            lines.push(`${i + 1}. **${f.item.title}** (${f.item.item_id})`)
            if (f.entry.whatsWrong) lines.push(`   Issue: ${f.entry.whatsWrong}`)
            if (f.entry.findings) lines.push(`   Notes: ${f.entry.findings}`)
          })
          lines.push('')
        }

        if (airFails.length > 0) {
          lines.push('## AIR Machine (SHARED + INFRA/OS)')
          lines.push('')
          airFails.forEach((f, i) => {
            lines.push(`${i + 1}. **${f.item.title}** (${f.item.item_id})`)
            if (f.entry.whatsWrong) lines.push(`   Issue: ${f.entry.whatsWrong}`)
            if (f.entry.findings) lines.push(`   Notes: ${f.entry.findings}`)
          })
          lines.push('')
        }

        if (foundCount > 0) {
          lines.push(`## New Discoveries`)
          lines.push(`${foundCount} new item${foundCount !== 1 ? 's' : ''} added to FORGE queue during walkthrough.`)
          lines.push('')
        }

        lines.push('---')
        lines.push('Fix all items on each machine, then re-run Confirm Walkthrough.')
        setGeneratedPrompt(lines.join('\n'))
      }

      setSubmitResults({ done: doneCount, notDone: notDoneCount, found: foundCount })
      setSubmitted(true)
    } catch { /* silent */ }

    setSubmitting(false)
  }

  const copyPrompt = () => navigator.clipboard.writeText(generatedPrompt)

  /* ─── Render ─── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: s.textMuted }}>
        Loading confirmed items...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: s.text, fontFamily: 'inherit' }}>

      {/* ─── Header ─── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'rgba(224,124,62,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="verified" size={20} color={s.copper} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Confirm Walkthrough</h1>
            <p style={{ fontSize: 12, color: s.textMuted, margin: 0 }}>
              CEO visual confirmation — {allItems.length} audited items across {groups.length} groups
            </p>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Machine filter tabs */}
        <div style={{ display: 'flex', gap: 4, background: s.surface, borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => setMachineFilter('ALL')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: machineFilter === 'ALL' ? s.copper : 'transparent',
              color: machineFilter === 'ALL' ? '#fff' : s.textMuted,
              fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            All ({machineCounts.ALL})
          </button>
          {(['PRO', 'AIR'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMachineFilter(m)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 6, border: 'none',
                background: machineFilter === m ? MACHINE_COLORS[m].bg : 'transparent',
                color: machineFilter === m ? MACHINE_COLORS[m].color : s.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <Icon name={MACHINE_COLORS[m].icon} size={14} color={machineFilter === m ? MACHINE_COLORS[m].color : s.textMuted} />
              {m} ({machineCounts[m]})
            </button>
          ))}
        </div>

        {/* Found Something */}
        {!submitted && (
          <button
            onClick={handleFoundOpen}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: 'rgba(168,85,247,0.15)', color: 'rgb(168,85,247)', fontSize: 13,
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Icon name="add_circle" size={16} color="rgb(168,85,247)" />
            Found Something{foundCount > 0 ? ` (${foundCount})` : ''}
          </button>
        )}

        {/* Back to FORGE */}
        <a
          href="/modules/forge"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 6, border: `1px solid ${s.border}`,
            background: 'transparent', color: s.textSecondary, fontSize: 13,
            textDecoration: 'none',
          }}
        >
          <Icon name="arrow_back" size={14} color={s.textSecondary} /> Back to FORGE
        </a>
      </div>

      {/* ─── Empty State ─── */}
      {allItems.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', color: s.textMuted }}>
          <Icon name="verified" size={48} color={s.textMuted} />
          <div style={{ marginTop: 12, fontSize: 14 }}>No confirmed items to walk through</div>
        </div>
      )}

      {/* ─── Groups ─── */}
      {!submitted && filteredGroups.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
          {filteredGroups.map(group => {
            const isCollapsed = collapsedGroups.has(group.key)
            const mc = MACHINE_COLORS[group.machine]
            const groupDone = group.items.filter(i => entries[i.id]?.verdict === 'done').length
            const groupNotDone = group.items.filter(i => entries[i.id]?.verdict === 'not_done').length
            const groupTotal = group.items.length
            const groupProgress = groupTotal > 0 ? ((groupDone + groupNotDone) / groupTotal) * 100 : 0

            return (
              <div key={group.key} style={{ marginBottom: 16 }}>
                {/* Group header */}
                <div
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', cursor: 'pointer',
                    background: s.surface, borderRadius: isCollapsed ? 8 : '8px 8px 0 0',
                    border: `1px solid ${s.border}`,
                    borderBottom: isCollapsed ? `1px solid ${s.border}` : 'none',
                    userSelect: 'none',
                  }}
                >
                  <Icon name={isCollapsed ? 'expand_more' : 'expand_less'} size={18} color={s.textMuted} />

                  {/* Machine badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                    background: mc.bg, color: mc.color,
                  }}>
                    <Icon name={mc.icon} size={12} color={mc.color} />
                    {group.machine}
                  </span>

                  <span style={{ fontSize: 14, fontWeight: 600 }}>{group.label}</span>
                  <span style={{ fontSize: 12, color: s.textMuted }}>({groupTotal} item{groupTotal !== 1 ? 's' : ''})</span>

                  <div style={{ flex: 1 }} />

                  {/* Mini progress */}
                  {groupProgress > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {groupDone > 0 && (
                        <span style={{ fontSize: 11, color: 'rgb(34,197,94)', fontWeight: 600 }}>{groupDone} done</span>
                      )}
                      {groupNotDone > 0 && (
                        <span style={{ fontSize: 11, color: 'rgb(239,68,68)', fontWeight: 600 }}>{groupNotDone} not done</span>
                      )}
                      <div style={{
                        width: 60, height: 4, borderRadius: 2, background: s.border, overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${groupProgress}%`, height: '100%', borderRadius: 2,
                          background: groupNotDone > 0 ? 'rgb(245,158,11)' : 'rgb(34,197,94)',
                          transition: 'width 0.3s',
                        }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Group items */}
                {!isCollapsed && (
                  <div style={{
                    border: `1px solid ${s.border}`, borderTop: 'none',
                    borderRadius: '0 0 8px 8px', overflow: 'hidden',
                  }}>
                    {group.items.map((item, idx) => {
                      const entry = entries[item.id] || initEntry(item)
                      const isDone = entry.verdict === 'done'
                      const isNotDone = entry.verdict === 'not_done'
                      const typeCfg = TYPE_CONFIG[item.type]
                      const isRecording = !!activeRecordings[item.id]

                      return (
                        <div
                          key={item.id}
                          style={{
                            borderBottom: idx < group.items.length - 1 ? `1px solid ${s.border}` : 'none',
                            background: isDone ? 'rgba(34,197,94,0.03)' : isNotDone ? 'rgba(239,68,68,0.03)' : 'transparent',
                            transition: 'background 0.2s',
                          }}
                          onPaste={(e) => isNotDone ? handlePaste(e, item.id) : undefined}
                        >
                          {/* Item row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: 10, color: s.textMuted, minWidth: 64 }}>
                              {item.item_id}
                            </span>

                            {typeCfg && (
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 12,
                                fontSize: 9, fontWeight: 600, background: typeCfg.bg, color: typeCfg.color,
                                whiteSpace: 'nowrap',
                              }}>
                                {typeCfg.label}
                              </span>
                            )}

                            {item.portal !== 'SHARED' && item.portal !== group.label && (
                              <span style={{
                                fontSize: 9, padding: '2px 6px', borderRadius: 6,
                                background: 'rgba(74,122,181,0.12)', color: s.portal, fontWeight: 600,
                              }}>
                                {item.portal}
                              </span>
                            )}

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontSize: 13, fontWeight: 500,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                textDecoration: isDone ? 'line-through' : 'none',
                                opacity: isDone ? 0.6 : 1,
                              }}>
                                {item.title}
                              </div>
                              {item.description && (
                                <div style={{ fontSize: 11, color: s.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {item.description}
                                </div>
                              )}
                            </div>

                            {/* Done / Not Done toggle */}
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button
                                onClick={() => updateEntry(item.id, { verdict: isDone ? null : 'done' })}
                                style={{
                                  width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                                  background: isDone ? 'rgb(34,197,94)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  outline: isDone ? 'none' : `1px solid ${s.border}`,
                                  transition: 'all 0.15s',
                                }}
                                title="Done — Visually Confirmed"
                              >
                                <Icon name="check" size={18} color={isDone ? '#fff' : s.textMuted} />
                              </button>
                              <button
                                onClick={() => updateEntry(item.id, { verdict: isNotDone ? null : 'not_done' })}
                                style={{
                                  width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                                  background: isNotDone ? 'rgb(239,68,68)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  outline: isNotDone ? 'none' : `1px solid ${s.border}`,
                                  transition: 'all 0.15s',
                                }}
                                title="Not Done — Needs Work"
                              >
                                <Icon name="close" size={18} color={isNotDone ? '#fff' : s.textMuted} />
                              </button>
                            </div>
                          </div>

                          {/* ─── Not Done Expansion ─── */}
                          {isNotDone && (
                            <div style={{
                              padding: '0 14px 14px', borderTop: `1px solid ${s.border}`,
                              paddingTop: 12, background: 'rgba(239,68,68,0.02)',
                            }}>
                              <div style={{ marginBottom: 10 }}>
                                <label style={{ display: 'block', fontSize: 11, color: s.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                                  What&apos;s wrong?
                                </label>
                                <input
                                  type="text"
                                  value={entry.whatsWrong}
                                  onChange={(e) => updateEntry(item.id, { whatsWrong: e.target.value })}
                                  placeholder="Brief description of the issue..."
                                  style={{
                                    width: '100%', background: s.bg, border: `1px solid ${s.border}`,
                                    borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13, outline: 'none',
                                  }}
                                />
                              </div>

                              {/* Capture buttons */}
                              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                                <button
                                  onClick={() => handleScreenshot(item.id)}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '6px 14px', borderRadius: 6, border: 'none',
                                    background: s.copper, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                  }}
                                >
                                  <Icon name="photo_camera" size={14} color="#fff" /> Screenshot
                                </button>
                                {isRecording ? (
                                  <button
                                    onClick={() => handleStopRecording(item.id)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6,
                                      padding: '6px 14px', borderRadius: 6, border: 'none',
                                      background: 'rgb(239,68,68)', color: '#fff', fontSize: 12,
                                      fontWeight: 600, cursor: 'pointer',
                                      animation: 'confirmPulse 1.5s ease-in-out infinite',
                                    }}
                                  >
                                    <Icon name="stop" size={14} color="#fff" /> Stop Recording
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleStartRecording(item.id)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 6,
                                      padding: '6px 14px', borderRadius: 6, border: `1px solid ${s.copper}`,
                                      background: 'transparent', color: s.copper, fontSize: 12,
                                      fontWeight: 600, cursor: 'pointer',
                                    }}
                                  >
                                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgb(239,68,68)', display: 'inline-block' }} />
                                    Record Video
                                  </button>
                                )}
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <span style={{ fontSize: 11, color: s.textMuted }}>Paste screenshots with Cmd+V</span>
                                </div>
                              </div>

                              {/* Media thumbnails */}
                              {entry.media.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                                  {entry.media.map((m, mi) => (
                                    <div key={mi} style={{
                                      position: 'relative', width: 120, borderRadius: 6,
                                      border: `1px solid ${s.border}`, overflow: 'hidden', background: s.bg,
                                    }}>
                                      {m.type === 'screenshot' ? (
                                        <img src={m.dataUrl} alt={m.name} style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }} />
                                      ) : (
                                        <video src={m.dataUrl} style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }} />
                                      )}
                                      <div style={{ padding: '3px 6px', fontSize: 9, color: s.textMuted }}>
                                        {m.type === 'screenshot' ? 'Screenshot' : 'Video'}
                                      </div>
                                      <button
                                        onClick={() => removeMedia(item.id, mi)}
                                        style={{
                                          position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                                          borderRadius: '50%', border: 'none', cursor: 'pointer',
                                          background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}
                                      >
                                        x
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div>
                                <label style={{ display: 'block', fontSize: 11, color: s.textSecondary, marginBottom: 4, fontWeight: 600 }}>
                                  Additional Findings (optional)
                                </label>
                                <textarea
                                  value={entry.findings}
                                  onChange={(e) => updateEntry(item.id, { findings: e.target.value })}
                                  placeholder="Any extra context, steps to reproduce, etc."
                                  rows={2}
                                  style={{
                                    width: '100%', background: s.bg, border: `1px solid ${s.border}`,
                                    borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13,
                                    outline: 'none', resize: 'vertical',
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ─── Submit Results ─── */}
      {submitted && submitResults && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
          <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: submitResults.notDone > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon
                name={submitResults.notDone > 0 ? 'assignment_late' : 'verified'}
                size={36}
                color={submitResults.notDone > 0 ? 'rgb(245,158,11)' : 'rgb(34,197,94)'}
              />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Confirm Walkthrough Complete
            </h2>
            <p style={{ fontSize: 14, color: s.textSecondary, marginBottom: 24 }}>
              {submitResults.done} confirmed, {submitResults.notDone} rejected{submitResults.found > 0 ? `, ${submitResults.found} new items found` : ''}
            </p>

            {submitResults.done > 0 && (
              <div style={{
                background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '12px 16px',
                marginBottom: 16, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(34,197,94)', marginBottom: 4 }}>
                  CEO Confirmed ({submitResults.done})
                </div>
                <div style={{ fontSize: 12, color: s.textSecondary }}>
                  These items are verified complete.
                </div>
              </div>
            )}

            {submitResults.notDone > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '12px 16px',
                marginBottom: 24, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(239,68,68)', marginBottom: 4 }}>
                  Rejected ({submitResults.notDone})
                </div>
                <div style={{ fontSize: 12, color: s.textSecondary }}>
                  These items have been moved back to &quot;built&quot; for rework.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {generatedPrompt && (
                <button
                  onClick={() => setShowPromptModal(true)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: s.copper, color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Icon name="content_copy" size={16} color="#fff" /> #NightShift Prompt
                </button>
              )}
              <a
                href="/modules/forge"
                style={{
                  padding: '10px 20px', borderRadius: 8, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 14,
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Icon name="arrow_back" size={16} color={s.textSecondary} /> Back to FORGE
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bottom Summary Bar ─── */}
      {!submitted && allItems.length > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: s.bg, borderTop: `1px solid ${s.border}`,
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
          zIndex: 20,
        }}>
          {/* Machine indicator */}
          {machineFilter !== 'ALL' && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              background: MACHINE_COLORS[machineFilter].bg, color: MACHINE_COLORS[machineFilter].color,
            }}>
              <Icon name={MACHINE_COLORS[machineFilter].icon} size={12} color={MACHINE_COLORS[machineFilter].color} />
              {machineFilter}
            </span>
          )}

          {/* Progress bar */}
          <div style={{ width: 120, height: 6, borderRadius: 3, background: s.border, overflow: 'hidden' }}>
            <div style={{
              width: `${summary.total > 0 ? ((summary.done + summary.notDone) / summary.total) * 100 : 0}%`,
              height: '100%', borderRadius: 3,
              background: summary.notDone > 0 ? 'rgb(245,158,11)' : 'rgb(34,197,94)',
              transition: 'width 0.3s',
            }} />
          </div>

          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            <span style={{ fontSize: 13, color: 'rgb(34,197,94)', fontWeight: 600 }}>
              {summary.done} done
            </span>
            <span style={{ fontSize: 13, color: 'rgb(239,68,68)', fontWeight: 600 }}>
              {summary.notDone} not done
            </span>
            <span style={{ fontSize: 13, color: s.textMuted }}>
              {summary.unreviewed} unreviewed
            </span>
            {foundCount > 0 && (
              <span style={{ fontSize: 12, color: 'rgb(168,85,247)', fontWeight: 600 }}>
                + {foundCount} found
              </span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || (summary.done === 0 && summary.notDone === 0)}
            style={{
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: (submitting || (summary.done === 0 && summary.notDone === 0)) ? s.textMuted : s.copper,
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            <Icon name="verified" size={18} color="#fff" />
            {submitting ? 'Submitting...' : 'Submit Walkthrough'}
          </button>
        </div>
      )}

      {/* ─── Found Something Modal ─── */}
      {foundOpen && (
        <>
          <div
            onClick={handleFoundClose}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 55 }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: 480, maxHeight: '85vh', overflowY: 'auto',
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 12, zIndex: 60,
            }}
            onPaste={handleFoundPaste}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 20px 0' }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(168,85,247,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="add_circle" size={20} color="rgb(168,85,247)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: s.text }}>Found Something</h3>
                <p style={{ fontSize: 11, color: s.textMuted, margin: 0 }}>
                  Capture a new item discovered during walkthrough
                </p>
              </div>
              <button
                onClick={handleFoundClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
              >
                <Icon name="close" size={18} color={s.textMuted} />
              </button>
            </div>

            {foundSubmitted ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px' }}>
                <Icon name="check_circle" size={48} color="rgb(34,197,94)" />
                <p style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: s.text }}>
                  Added to FORGE queue
                </p>
              </div>
            ) : (
              <div style={{ padding: 20 }}>
                {/* Screenshot drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setFoundDragOver(true) }}
                  onDragLeave={() => setFoundDragOver(false)}
                  onDrop={handleFoundDrop}
                  style={{
                    marginBottom: 14, borderRadius: 8, overflow: 'hidden',
                    border: `2px ${foundScreenshot ? 'solid' : 'dashed'} ${foundDragOver ? 'rgb(168,85,247)' : s.border}`,
                    background: foundDragOver ? 'rgba(168,85,247,0.05)' : s.surface,
                  }}
                >
                  {foundScreenshot ? (
                    <div style={{ position: 'relative' }}>
                      <img src={foundScreenshot} alt="Capture" style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block' }} />
                      <button
                        onClick={() => setFoundScreenshot(null)}
                        style={{
                          position: 'absolute', top: 6, right: 6, width: 22, height: 22,
                          borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 13,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        x
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', padding: '20px 12px', cursor: 'pointer',
                      }}
                      onClick={handleFoundScreenshot}
                    >
                      <Icon name="screenshot_monitor" size={24} color={s.textMuted} />
                      <p style={{ marginTop: 6, fontSize: 11, color: s.textMuted, textAlign: 'center' }}>
                        Click to capture screen, paste (Cmd+V), or drag image
                      </p>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  value={foundTitle}
                  onChange={(e) => setFoundTitle(e.target.value)}
                  placeholder="What did you find?"
                  autoFocus
                  style={{
                    width: '100%', background: s.surface, border: `1px solid ${s.border}`,
                    borderRadius: 8, padding: '10px 12px', color: s.text, fontSize: 14, outline: 'none',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && foundTitle.trim()) handleFoundSubmit() }}
                />

                <textarea
                  value={foundDescription}
                  onChange={(e) => setFoundDescription(e.target.value)}
                  placeholder="More details (optional)"
                  rows={3}
                  style={{
                    width: '100%', marginTop: 10, background: s.surface,
                    border: `1px solid ${s.border}`, borderRadius: 8,
                    padding: '10px 12px', color: s.text, fontSize: 13,
                    outline: 'none', resize: 'vertical',
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                  <button
                    onClick={handleFoundClose}
                    style={{
                      padding: '8px 16px', borderRadius: 6, border: 'none',
                      background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleFoundSubmit}
                    disabled={!foundTitle.trim() || foundSubmitting}
                    style={{
                      padding: '8px 20px', borderRadius: 6, border: 'none',
                      background: (!foundTitle.trim() || foundSubmitting) ? s.textMuted : 'rgb(168,85,247)',
                      color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: (!foundTitle.trim() || foundSubmitting) ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Icon name="add_circle" size={14} color="#fff" />
                    {foundSubmitting ? 'Adding...' : 'Add to FORGE Queue'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── #NightShift Prompt Modal ─── */}
      {showPromptModal && (
        <>
          <div
            onClick={() => setShowPromptModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 640, maxHeight: '80vh', background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12, padding: 24, zIndex: 60, display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>#NightShift Prompt</span>
              <button onClick={() => setShowPromptModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <Icon name="close" size={20} color={s.textMuted} />
              </button>
            </div>
            <textarea
              readOnly
              value={generatedPrompt}
              style={{
                flex: 1, minHeight: 280, width: '100%', background: s.surface,
                border: `1px solid ${s.border}`, borderRadius: 8, padding: 16,
                color: s.text, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6,
                resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setShowPromptModal(false)}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: `1px solid ${s.border}`,
                  background: 'transparent', color: s.textSecondary, fontSize: 13, cursor: 'pointer',
                }}
              >
                Close
              </button>
              <button
                onClick={copyPrompt}
                style={{
                  padding: '8px 20px', borderRadius: 6, border: 'none',
                  background: s.copper, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon name="content_copy" size={14} color="#fff" /> Copy to Clipboard
              </button>
            </div>
          </div>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes confirmPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
      `}</style>
    </div>
  )
}
