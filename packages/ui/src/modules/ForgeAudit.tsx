'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

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
  plan_link: string | null
  notes: string
  attachments?: Attachment[]
  audit_round?: number
  audit_status?: 'pending' | 'passed' | 'failed' | null
  audit_notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

interface Sprint {
  id: string
  name: string
  description: string
  status: string
  plan_link: string | null
  prompt_text: string
  created_by: string
  created_at: string
  updated_at: string
}

type Verdict = 'pass' | 'fail' | null

interface AuditEntry {
  item: TrackerItem
  verdict: Verdict
  whatsWrong: string
  findings: string
  media: MediaCapture[]
  portalChecks: Record<string, boolean>
}

interface MediaCapture {
  type: 'screenshot' | 'video'
  dataUrl: string  // base64 data URL for screenshots
  blob?: Blob      // blob for video
  name: string
}

interface CreatedIssue {
  title: string
  item_id?: string
}

interface AuditRoundInfo {
  current_round: number
  total_items: number
  pending: TrackerItem[]
  pending_count: number
  passed: TrackerItem[]
  passed_count: number
  failed: TrackerItem[]
  failed_count: number
}

/* ─── Constants ─── */
const API_BASE = '/api'

const TYPE_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  broken:   { color: 'rgb(239,68,68)', bg: 'rgba(239,68,68,0.15)', label: 'Bug' },
  idea:     { color: 'rgb(168,85,247)', bg: 'rgba(168,85,247,0.15)', label: 'Feature' },
  improve:  { color: 'rgb(245,158,11)', bg: 'rgba(245,158,11,0.15)', label: 'Enhancement' },
  question: { color: 'rgb(59,130,246)', bg: 'rgba(59,130,246,0.15)', label: 'Question' },
}

const PORTAL_LIST = ['PRODASHX', 'RIIMO', 'SENTINEL'] as const

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
interface ForgeAuditProps {
  portal: string
}

export function ForgeAudit({ portal }: ForgeAuditProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [allItems, setAllItems] = useState<TrackerItem[]>([])
  const [selectedSprintId, setSelectedSprintId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [auditEntries, setAuditEntries] = useState<Record<string, AuditEntry>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitResults, setSubmitResults] = useState<{ confirmed: number; issues: CreatedIssue[] } | null>(null)
  const [showPromptModal, setShowPromptModal] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  // Track active video recordings per item
  const [activeRecordings, setActiveRecordings] = useState<Record<string, MediaRecorder>>({})
  // Audit round state
  const [roundInfo, setRoundInfo] = useState<AuditRoundInfo | null>(null)
  const [creatingRound, setCreatingRound] = useState(false)

  /* ─── Data Loading ─── */
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sprintRes, itemRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/sprints`),
        fetchWithAuth(`${API_BASE}/tracker?limit=500`),
      ])
      if (sprintRes.ok) {
        const json = await sprintRes.json()
        if (json.success) setSprints(json.data || [])
      }
      if (itemRes.ok) {
        const json = await itemRes.json()
        if (json.success) setAllItems(json.data || [])
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-select sprint from URL param
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sprintParam = params.get('sprint')
    if (sprintParam) setSelectedSprintId(sprintParam)
  }, [])

  // Load audit round info when sprint is selected
  const loadRoundInfo = useCallback(async (sprintId: string) => {
    if (!sprintId) { setRoundInfo(null); return }
    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/${sprintId}/audit-round`)
      if (res.ok) {
        const json = await res.json()
        if (json.success) setRoundInfo(json.data)
      }
    } catch { /* silent */ }
  }, [])

  useEffect(() => {
    if (selectedSprintId) loadRoundInfo(selectedSprintId)
  }, [selectedSprintId, loadRoundInfo])

  /* ─── Derived ─── */
  // Sprints in audited/confirm phase (items status >= audited)
  const STATUS_RANK: Record<string, number> = { queue: 0, not_touched: 1, in_sprint: 2, planned: 3, built: 4, audited: 5, confirmed: 6 }

  const auditableSprints = useMemo(() => {
    return sprints.filter(sp => {
      const sprintItems = allItems.filter(i => i.sprint_id === sp.id)
      if (sprintItems.length === 0) return false
      const activeItems = sprintItems.filter(i => !['deferred', 'wont_fix'].includes(i.status))
      if (activeItems.length === 0) return false
      const minRank = Math.min(...activeItems.map(i => STATUS_RANK[i.status] ?? 0))
      // Show sprints where bottleneck is at built (4) or audited (5) — ready for audit
      return minRank >= 4
    })
  }, [sprints, allItems])

  const sprintItems = useMemo(() => {
    if (!selectedSprintId) return []
    return allItems.filter(i => i.sprint_id === selectedSprintId && !['deferred', 'wont_fix'].includes(i.status))
  }, [allItems, selectedSprintId])

  const selectedSprint = useMemo(() => {
    return sprints.find(sp => sp.id === selectedSprintId) || null
  }, [sprints, selectedSprintId])

  // Current round number
  const currentRound = roundInfo?.current_round || 1

  // Items to audit in the current round (pending items in the current round)
  const auditableItems = useMemo(() => {
    if (!roundInfo) return sprintItems
    // Show only items that are pending in the current round
    const pendingIds = new Set(roundInfo.pending.map(i => i.id))
    return sprintItems.filter(i => pendingIds.has(i.id))
  }, [sprintItems, roundInfo])

  // Items that already passed in previous rounds (greyed out)
  const previouslyPassedItems = useMemo(() => {
    if (!roundInfo) return []
    const passedIds = new Set(roundInfo.passed.map(i => i.id))
    return sprintItems.filter(i => passedIds.has(i.id))
  }, [sprintItems, roundInfo])

  // Summary counts — only for auditable items in this round
  const summary = useMemo(() => {
    const passed = auditableItems.filter(i => auditEntries[i.id]?.verdict === 'pass').length
    const failed = auditableItems.filter(i => auditEntries[i.id]?.verdict === 'fail').length
    const unreviewed = auditableItems.length - passed - failed
    return { passed, failed, unreviewed, total: auditableItems.length }
  }, [auditableItems, auditEntries])

  /* ─── Handlers ─── */
  const initEntry = (item: TrackerItem): AuditEntry => {
    const existing = auditEntries[item.id]
    if (existing) return existing
    const portalChecks: Record<string, boolean> = {}
    if (item.portal === 'SHARED') {
      PORTAL_LIST.forEach(p => { portalChecks[p] = false })
    } else {
      portalChecks[item.portal] = false
    }
    return { item, verdict: null, whatsWrong: '', findings: '', media: [], portalChecks }
  }

  const updateEntry = (itemId: string, updates: Partial<AuditEntry>) => {
    setAuditEntries(prev => {
      const item = sprintItems.find(i => i.id === itemId)
      if (!item) return prev
      const existing = prev[itemId] || initEntry(item)
      return { ...prev, [itemId]: { ...existing, ...updates } }
    })
  }

  const handleScreenshot = async (itemId: string) => {
    const dataUrl = await captureScreenshot()
    if (!dataUrl) return
    const entry = auditEntries[itemId] || initEntry(sprintItems.find(i => i.id === itemId)!)
    const media: MediaCapture = {
      type: 'screenshot',
      dataUrl,
      name: `audit-screenshot-${Date.now()}.png`,
    }
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

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        setActiveRecordings(prev => { const next = { ...prev }; delete next[itemId]; return next })
        const blob = new Blob(chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const entry = auditEntries[itemId] || initEntry(sprintItems.find(i => i.id === itemId)!)
        const media: MediaCapture = {
          type: 'video',
          dataUrl: url,
          blob,
          name: `audit-recording-${Date.now()}.webm`,
        }
        updateEntry(itemId, { media: [...entry.media, media] })
      }

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop()
      }

      recorder.start()
      setActiveRecordings(prev => ({ ...prev, [itemId]: recorder }))
    } catch { /* user cancelled */ }
  }

  const handleStopRecording = (itemId: string) => {
    const recorder = activeRecordings[itemId]
    if (recorder && recorder.state === 'recording') recorder.stop()
  }

  const removeMedia = (itemId: string, mediaIndex: number) => {
    const entry = auditEntries[itemId]
    if (!entry) return
    const next = entry.media.filter((_, i) => i !== mediaIndex)
    updateEntry(itemId, { media: next })
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
          const entry = auditEntries[itemId] || initEntry(sprintItems.find(i => i.id === itemId)!)
          const media: MediaCapture = {
            type: 'screenshot',
            dataUrl: reader.result as string,
            name: `audit-paste-${Date.now()}.png`,
          }
          updateEntry(itemId, { media: [...entry.media, media] })
        }
        reader.readAsDataURL(file)
      }
    }
  }

  /* ─── Submit Audit ─── */
  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)

    let confirmedCount = 0
    const createdIssues: CreatedIssue[] = []

    try {
      // 1. PASS items → audit_status='passed', status='confirmed'
      const passItems = auditableItems.filter(i => auditEntries[i.id]?.verdict === 'pass')
      await Promise.all(passItems.map(async (item) => {
        const entry = auditEntries[item.id]
        const res = await fetchWithAuth(`${API_BASE}/tracker/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'confirmed',
            audit_status: 'passed',
            audit_round: currentRound,
            audit_notes: entry?.findings || '',
          }),
        })
        if (res.ok) confirmedCount++
      }))

      // 2. FAIL items → audit_status='failed', keep current status, store notes
      const failItems = auditableItems.filter(i => auditEntries[i.id]?.verdict === 'fail')
      await Promise.all(failItems.map(async (item) => {
        const entry = auditEntries[item.id]
        if (!entry) return

        const auditNotes = [
          entry.whatsWrong || '',
          entry.findings || '',
        ].filter(Boolean).join(' | ')

        // Mark the item as failed in the current round
        await fetchWithAuth(`${API_BASE}/tracker/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            audit_status: 'failed',
            audit_round: currentRound,
            audit_notes: auditNotes,
          }),
        })

        createdIssues.push({
          title: `${item.title}${entry.whatsWrong ? ` — ${entry.whatsWrong}` : ''}`,
          item_id: item.item_id,
        })

        // Upload captured media as attachments to the original item
        if (entry.media.length > 0) {
          for (const m of entry.media) {
            let base64: string
            let contentType: string
            let fileName: string

            if (m.type === 'screenshot') {
              base64 = m.dataUrl.split(',')[1]
              contentType = 'image/png'
              fileName = m.name
            } else if (m.blob) {
              base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve((reader.result as string).split(',')[1])
                reader.readAsDataURL(m.blob!)
              })
              contentType = 'video/webm'
              fileName = m.name
            } else {
              continue
            }

            await fetchWithAuth(`${API_BASE}/tracker/${item.id}/attachments`, {
              method: 'POST',
              body: JSON.stringify({
                name: fileName,
                data: base64,
                content_type: contentType,
              }),
            })
          }
        }
      }))

      // 3. Generate #LetsPolishIt prompt
      if (createdIssues.length > 0) {
        const promptLines = [
          `# #LetsPolishIt — ${selectedSprint?.name || 'Sprint Audit'} (Round ${currentRound})`,
          '',
          `Audit Round ${currentRound} completed: ${confirmedCount} confirmed, ${createdIssues.length} issues found.`,
          '',
          '## Issues to Fix',
          '',
          ...createdIssues.map((issue, i) => `${i + 1}. **${issue.title}**${issue.item_id ? ` (${issue.item_id})` : ''}`),
          '',
          '---',
          '',
          `Fix all issues above, then create a Re-Audit Round in FORGE to verify fixes.`,
        ]
        setGeneratedPrompt(promptLines.join('\n'))
      }

      setSubmitResults({ confirmed: confirmedCount, issues: createdIssues })
      setSubmitted(true)
      await loadData()
      await loadRoundInfo(selectedSprintId)
    } catch { /* silent */ }

    setSubmitting(false)
  }

  /* ─── Create Re-Audit Round ─── */
  const handleCreateReAuditRound = async () => {
    if (creatingRound || !selectedSprintId) return
    setCreatingRound(true)

    try {
      const res = await fetchWithAuth(`${API_BASE}/sprints/${selectedSprintId}/audit-rounds`, {
        method: 'POST',
      })
      if (res.ok) {
        // Reload data and round info, then reset to audit view
        await loadData()
        await loadRoundInfo(selectedSprintId)
        setAuditEntries({})
        setSubmitted(false)
        setSubmitResults(null)
        setGeneratedPrompt('')
      }
    } catch { /* silent */ }

    setCreatingRound(false)
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt)
  }

  const printPrompt = () => {
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<!DOCTYPE html><html><head><title>FORGE Audit — #LetsPolishIt</title>
<style>
@page { size: letter; margin: 0.75in; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; padding: 40px; line-height: 1.6; }
pre { white-space: pre-wrap; word-wrap: break-word; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; background: #f1f5f9; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
h1 { font-size: 20px; margin-bottom: 8px; color: #e07c3e; }
p { font-size: 12px; color: #64748b; margin-bottom: 20px; }
</style></head><body>
<h1>#LetsPolishIt — ${selectedSprint?.name || 'Sprint Audit'} (Round ${currentRound})</h1>
<p>Generated ${new Date().toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
<pre>${generatedPrompt.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
<script>window.print()<\/script>
</body></html>`)
      win.document.close()
    }
  }

  /* ─── Render ─── */
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: s.textMuted }}>
        Loading audit data...
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
            <Icon name="fact_check" size={20} color={s.copper} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>Audit Walkthrough</h1>
              {selectedSprintId && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 10px', borderRadius: 12,
                  fontSize: 11, fontWeight: 700,
                  background: currentRound > 1 ? 'rgba(245,158,11,0.15)' : 'rgba(74,122,181,0.15)',
                  color: currentRound > 1 ? 'rgb(245,158,11)' : s.portal,
                }}>
                  Round {currentRound}
                </span>
              )}
            </div>
            <p style={{ fontSize: 12, color: s.textMuted, margin: 0 }}>
              {currentRound > 1
                ? `Re-auditing ${auditableItems.length} item${auditableItems.length !== 1 ? 's' : ''} from Round ${currentRound - 1}`
                : 'Walk through sprint items, pass or fail each one'
              }
            </p>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Sprint selector */}
        <select
          value={selectedSprintId}
          onChange={(e) => {
            setSelectedSprintId(e.target.value)
            setAuditEntries({})
            setSubmitted(false)
            setSubmitResults(null)
            setRoundInfo(null)
          }}
          style={{
            background: s.surface, border: `1px solid ${s.border}`,
            borderRadius: 8, padding: '8px 14px', color: s.text,
            fontSize: 14, outline: 'none', minWidth: 240,
          }}
        >
          <option value="">Select a sprint to audit...</option>
          {auditableSprints.map(sp => (
            <option key={sp.id} value={sp.id}>{sp.name}</option>
          ))}
        </select>

        {/* Back to Forge */}
        <a
          href={`/modules/forge`}
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

      {/* ─── No sprint selected ─── */}
      {!selectedSprintId && (
        <div style={{ padding: 60, textAlign: 'center', color: s.textMuted }}>
          <Icon name="fact_check" size={48} color={s.textMuted} />
          <div style={{ marginTop: 12, fontSize: 14 }}>
            Select a sprint above to begin the audit walkthrough
          </div>
          {auditableSprints.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(245,158,11)' }}>
              No sprints are ready for audit (items must be in built or audited status)
            </div>
          )}
        </div>
      )}

      {/* ─── Sprint Selected — Show Items ─── */}
      {selectedSprintId && !submitted && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>

          {/* Sprint info bar */}
          {selectedSprint && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              background: s.surface, borderRadius: 8, marginBottom: 16,
              border: `1px solid ${s.border}`,
            }}>
              <Icon name="bolt" size={18} color="rgb(245,158,11)" />
              <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedSprint.name}</span>
              {selectedSprint.description && (
                <span style={{ fontSize: 12, color: s.textMuted }}>— {selectedSprint.description}</span>
              )}
              <div style={{ flex: 1 }} />
              {currentRound > 1 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
                  background: 'rgba(245,158,11,0.15)', color: 'rgb(245,158,11)',
                }}>
                  Round {currentRound}: {auditableItems.length} item{auditableItems.length !== 1 ? 's' : ''} to re-audit
                </span>
              )}
              <span style={{ fontSize: 12, color: s.textSecondary }}>
                {sprintItems.length} total item{sprintItems.length !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Previously passed items (greyed out, read-only) */}
          {previouslyPassedItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', marginBottom: 8,
              }}>
                <Icon name="check_circle" size={16} color="rgb(34,197,94)" />
                <span style={{ fontSize: 12, fontWeight: 600, color: 'rgb(34,197,94)' }}>
                  Previously Passed ({previouslyPassedItems.length})
                </span>
                <span style={{ fontSize: 11, color: s.textMuted }}>
                  — These items passed in earlier rounds
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {previouslyPassedItems.map(item => {
                  const typeCfg = TYPE_CONFIG[item.type]
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: s.surface,
                        borderRadius: 8,
                        border: `1px solid ${s.border}`,
                        borderLeft: '4px solid rgb(34,197,94)',
                        padding: '10px 16px',
                        opacity: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: s.textMuted, minWidth: 70 }}>
                        {item.item_id}
                      </span>
                      {typeCfg && (
                        <span style={{
                          display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                          fontSize: 10, fontWeight: 600, background: typeCfg.bg, color: typeCfg.color,
                          whiteSpace: 'nowrap',
                        }}>
                          {typeCfg.label}
                        </span>
                      )}
                      <span style={{ flex: 1, fontSize: 13, color: s.textSecondary }}>
                        {item.title}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                        background: 'rgba(34,197,94,0.15)', color: 'rgb(34,197,94)',
                      }}>
                        Passed Round {(item.audit_round || 1)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Current round items heading (only show if round > 1) */}
          {currentRound > 1 && auditableItems.length > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', marginBottom: 8,
            }}>
              <Icon name="replay" size={16} color="rgb(245,158,11)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'rgb(245,158,11)' }}>
                Round {currentRound} — Re-Audit ({auditableItems.length} item{auditableItems.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}

          {/* Audit cards — only auditable items for the current round */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {auditableItems.map(item => {
              const entry = auditEntries[item.id] || initEntry(item)
              const typeCfg = TYPE_CONFIG[item.type]
              const isFail = entry.verdict === 'fail'
              const isPass = entry.verdict === 'pass'
              const isRecording = !!activeRecordings[item.id]

              return (
                <div
                  key={item.id}
                  style={{
                    background: s.surface,
                    borderRadius: 10,
                    border: `1px solid ${isPass ? 'rgb(34,197,94)' : isFail ? 'rgb(239,68,68)' : s.border}`,
                    borderLeft: `4px solid ${isPass ? 'rgb(34,197,94)' : isFail ? 'rgb(239,68,68)' : s.border}`,
                    transition: 'border-color 0.2s',
                    overflow: 'hidden',
                  }}
                  onPaste={(e) => isFail ? handlePaste(e, item.id) : undefined}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                    {/* Item ID */}
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: s.textMuted, minWidth: 70 }}>
                      {item.item_id}
                    </span>

                    {/* Type badge */}
                    {typeCfg && (
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 12,
                        fontSize: 10, fontWeight: 600, background: typeCfg.bg, color: typeCfg.color,
                        whiteSpace: 'nowrap',
                      }}>
                        {typeCfg.label}
                      </span>
                    )}

                    {/* Previous failure note */}
                    {currentRound > 1 && item.audit_notes && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 12,
                        background: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)',
                        whiteSpace: 'nowrap',
                      }}>
                        Previously failed
                      </span>
                    )}

                    {/* Title + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: 12, color: s.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.description}
                        </div>
                      )}
                      {/* Show previous audit notes if re-auditing */}
                      {currentRound > 1 && item.audit_notes && (
                        <div style={{ fontSize: 11, color: 'rgb(239,68,68)', marginTop: 2, fontStyle: 'italic' }}>
                          Previous: {item.audit_notes}
                        </div>
                      )}
                    </div>

                    {/* Portal badges */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      {item.portal === 'SHARED' ? (
                        PORTAL_LIST.map(p => (
                          <label
                            key={p}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              fontSize: 10, color: s.textSecondary, cursor: 'pointer',
                              padding: '2px 6px', borderRadius: 6,
                              background: entry.portalChecks[p] ? 'rgba(34,197,94,0.12)' : 'transparent',
                              border: `1px solid ${entry.portalChecks[p] ? 'rgb(34,197,94)' : s.border}`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={entry.portalChecks[p] || false}
                              onChange={(e) => {
                                updateEntry(item.id, {
                                  portalChecks: { ...entry.portalChecks, [p]: e.target.checked },
                                })
                              }}
                              style={{ width: 12, height: 12, cursor: 'pointer' }}
                            />
                            {p}
                          </label>
                        ))
                      ) : (
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 6,
                          background: 'rgba(74,122,181,0.12)', color: s.portal,
                          fontWeight: 600,
                        }}>
                          {item.portal}
                        </span>
                      )}
                    </div>

                    {/* Component/Section info */}
                    {(item.component || item.section) && (
                      <span style={{ fontSize: 10, color: s.textMuted, flexShrink: 0 }}>
                        {[item.component, item.section].filter(Boolean).join(' / ')}
                      </span>
                    )}

                    {/* Pass/Fail toggle */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => updateEntry(item.id, { verdict: isPass ? null : 'pass' })}
                        style={{
                          width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isPass ? 'rgb(34,197,94)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          outline: isPass ? 'none' : `1px solid ${s.border}`,
                          transition: 'all 0.15s',
                        }}
                        title="Pass"
                      >
                        <Icon name="check" size={20} color={isPass ? '#fff' : s.textMuted} />
                      </button>
                      <button
                        onClick={() => updateEntry(item.id, { verdict: isFail ? null : 'fail' })}
                        style={{
                          width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer',
                          background: isFail ? 'rgb(239,68,68)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          outline: isFail ? 'none' : `1px solid ${s.border}`,
                          transition: 'all 0.15s',
                        }}
                        title="Fail"
                      >
                        <Icon name="close" size={20} color={isFail ? '#fff' : s.textMuted} />
                      </button>
                    </div>
                  </div>

                  {/* ─── Fail Expansion ─── */}
                  {isFail && (
                    <div style={{
                      padding: '0 16px 16px', borderTop: `1px solid ${s.border}`,
                      paddingTop: 14, background: 'rgba(239,68,68,0.02)',
                    }}>
                      {/* What's wrong input */}
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
                            borderRadius: 6, padding: '8px 10px', color: s.text, fontSize: 13,
                            outline: 'none',
                          }}
                        />
                      </div>

                      {/* Capture buttons row */}
                      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                        <button
                          onClick={() => handleScreenshot(item.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px', borderRadius: 6, border: 'none',
                            background: s.copper, color: '#fff', fontSize: 12,
                            fontWeight: 600, cursor: 'pointer',
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
                              animation: 'forgeAuditPulse 1.5s ease-in-out infinite',
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
                            <span style={{
                              width: 10, height: 10, borderRadius: '50%', background: 'rgb(239,68,68)',
                              display: 'inline-block',
                            }} />
                            Record Video
                          </button>
                        )}

                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: 11, color: s.textMuted }}>
                            Paste screenshots with Cmd+V
                          </span>
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
                                <img
                                  src={m.dataUrl}
                                  alt={m.name}
                                  style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }}
                                />
                              ) : (
                                <video
                                  src={m.dataUrl}
                                  style={{ width: 120, height: 80, objectFit: 'cover', display: 'block' }}
                                />
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
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Findings textarea */}
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
        </div>
      )}

      {/* ─── Submit Results ─── */}
      {submitted && submitResults && (
        <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 40 }}>
          <div style={{
            maxWidth: 600, margin: '40px auto', textAlign: 'center',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: submitResults.issues.length > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon
                name={submitResults.issues.length > 0 ? 'assignment_late' : 'check_circle'}
                size={36}
                color={submitResults.issues.length > 0 ? 'rgb(245,158,11)' : 'rgb(34,197,94)'}
              />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              Audit Round {currentRound} Complete
            </h2>
            <p style={{ fontSize: 14, color: s.textSecondary, marginBottom: 24 }}>
              {submitResults.confirmed} item{submitResults.confirmed !== 1 ? 's' : ''} confirmed,{' '}
              {submitResults.issues.length} issue{submitResults.issues.length !== 1 ? 's' : ''} failed
            </p>

            {/* Confirmed items */}
            {submitResults.confirmed > 0 && (
              <div style={{
                background: 'rgba(34,197,94,0.08)', borderRadius: 8, padding: '12px 16px',
                marginBottom: 16, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(34,197,94)', marginBottom: 4 }}>
                  Confirmed ({submitResults.confirmed})
                </div>
                <div style={{ fontSize: 12, color: s.textSecondary }}>
                  These items have been moved to confirmed status.
                </div>
              </div>
            )}

            {/* Failed items */}
            {submitResults.issues.length > 0 && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '12px 16px',
                marginBottom: 24, textAlign: 'left',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(239,68,68)', marginBottom: 8 }}>
                  Failed ({submitResults.issues.length})
                </div>
                {submitResults.issues.map((issue, i) => (
                  <div key={i} style={{
                    fontSize: 12, color: s.textSecondary, padding: '4px 0',
                    borderBottom: i < submitResults.issues.length - 1 ? `1px solid ${s.border}` : 'none',
                  }}>
                    {issue.item_id && <span style={{ fontFamily: 'monospace', fontSize: 10, color: s.textMuted, marginRight: 8 }}>{issue.item_id}</span>}
                    {issue.title}
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {/* Create Re-Audit Round button — only if there are failures */}
              {submitResults.issues.length > 0 && (
                <button
                  onClick={handleCreateReAuditRound}
                  disabled={creatingRound}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: creatingRound ? s.textMuted : 'rgb(245,158,11)',
                    color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: creatingRound ? 'default' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Icon name="replay" size={16} color="#fff" />
                  {creatingRound ? 'Creating...' : `Create Re-Audit Round ${currentRound + 1}`}
                </button>
              )}
              {generatedPrompt && (
                <button
                  onClick={() => setShowPromptModal(true)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, border: 'none',
                    background: s.copper, color: '#fff', fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}
                >
                  <Icon name="content_copy" size={16} color="#fff" /> #LetsPolishIt Prompt
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

      {/* ─── Bottom Summary Bar (when auditing) ─── */}
      {selectedSprintId && !submitted && (
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: s.bg, borderTop: `1px solid ${s.border}`,
          padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
          zIndex: 20,
        }}>
          {/* Round indicator */}
          {currentRound > 1 && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
              background: 'rgba(245,158,11,0.15)', color: 'rgb(245,158,11)',
            }}>
              R{currentRound}
            </span>
          )}

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            <span style={{ fontSize: 13, color: 'rgb(34,197,94)', fontWeight: 600 }}>
              {summary.passed} passed
            </span>
            <span style={{ fontSize: 13, color: 'rgb(239,68,68)', fontWeight: 600 }}>
              {summary.failed} failed
            </span>
            <span style={{ fontSize: 13, color: s.textMuted }}>
              {summary.unreviewed} unreviewed
            </span>
            {previouslyPassedItems.length > 0 && (
              <span style={{ fontSize: 12, color: s.textMuted, fontStyle: 'italic' }}>
                + {previouslyPassedItems.length} previously passed
              </span>
            )}
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || (summary.passed === 0 && summary.failed === 0)}
            style={{
              padding: '10px 28px', borderRadius: 8, border: 'none',
              background: (submitting || (summary.passed === 0 && summary.failed === 0)) ? s.textMuted : s.copper,
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: submitting ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'all 0.15s',
            }}
          >
            <Icon name="gavel" size={18} color="#fff" />
            {submitting ? 'Submitting...' : `Submit Round ${currentRound} Audit`}
          </button>
        </div>
      )}

      {/* ─── #LetsPolishIt Prompt Modal ─── */}
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
              <span style={{ fontSize: 16, fontWeight: 600 }}>#LetsPolishIt Prompt</span>
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

      {/* Recording pulse animation */}
      <style>{`
        @keyframes forgeAuditPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
        }
        @media print {
          * { background: #fff !important; color: #000 !important; border-color: #ccc !important; }
        }
      `}</style>
    </div>
  )
}
