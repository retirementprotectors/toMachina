'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@tomachina/auth'
import { fetchWithAuth } from '../modules/fetchWithAuth'

// ---------------------------------------------------------------------------
// URL → Tracker field mapping
// ---------------------------------------------------------------------------

const PORTAL_MAP: Record<string, string> = {
  prodash: 'PRODASHX',
  riimo: 'RIIMO',
  sentinel: 'SENTINEL',
}

const COMPONENT_MAP: Record<string, { component: string; scope: string }> = {
  '/contacts': { component: 'Contacts Grid', scope: 'Module' },
  '/accounts': { component: 'Accounts Grid', scope: 'Module' },
  '/modules/cam': { component: 'CAM', scope: 'App' },
  '/modules/dex': { component: 'DEX', scope: 'App' },
  '/modules/c3': { component: 'C3', scope: 'App' },
  '/modules/atlas': { component: 'ATLAS', scope: 'App' },
  '/modules/forge': { component: 'FORGE', scope: 'App' },
  '/modules/command-center': { component: 'Command Center', scope: 'App' },
  '/modules/pipeline-studio': { component: 'Pipeline Studio', scope: 'App' },
  '/pipelines': { component: 'Pipelines', scope: 'Module' },
  '/service-centers/rmd': { component: 'RMD Center', scope: 'Module' },
  '/service-centers/beni': { component: 'Beni Center', scope: 'Module' },
  '/service-centers/access': { component: 'Access Center', scope: 'Module' },
  '/sales-centers/medicare': { component: 'Medicare', scope: 'Module' },
  '/sales-centers/life': { component: 'Life', scope: 'Module' },
  '/sales-centers/annuity': { component: 'Annuity', scope: 'Module' },
  '/sales-centers/advisory': { component: 'Advisory', scope: 'Module' },
  '/admin': { component: 'Admin Panel', scope: 'Module' },
  '/myrpi': { component: 'MyRPI', scope: 'Module' },
  '/connect': { component: 'RPI Connect', scope: 'Module' },
  '/ddup': { component: 'DeDup', scope: 'Module' },
  '/intake': { component: 'Quick Intake', scope: 'Module' },
  '/dashboard': { component: 'Dashboard', scope: 'Module' },
  '/tasks': { component: 'Tasks', scope: 'Module' },
  '/org-admin': { component: 'Org Admin', scope: 'Module' },
  '/intelligence': { component: 'Intelligence', scope: 'Module' },
  '/deals': { component: 'Deals', scope: 'Module' },
  '/producers': { component: 'Producers', scope: 'Module' },
  '/analysis': { component: 'Analysis', scope: 'Module' },
  '/market-intel': { component: 'Market Intel', scope: 'Module' },
  '/discovery': { component: 'Discovery', scope: 'Module' },
}

function parseUrl(): { portal: string; component: string; scope: string; section: string; url: string } {
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  const port = window.location.port

  // Detect portal from hostname or dev port
  let portal = 'SHARED'
  for (const [key, value] of Object.entries(PORTAL_MAP)) {
    if (hostname.includes(key)) { portal = value; break }
  }
  if (port === '3001') portal = 'PRODASHX'
  if (port === '3002') portal = 'RIIMO'
  if (port === '3003') portal = 'SENTINEL'

  // Detect component — longest match first (more specific routes)
  let component = ''
  let scope = 'Platform'
  const sortedPaths = Object.keys(COMPONENT_MAP).sort((a, b) => b.length - a.length)
  for (const path of sortedPaths) {
    if (pathname.startsWith(path)) {
      const match = COMPONENT_MAP[path]
      component = match.component
      scope = match.scope
      break
    }
  }

  // Sub-page detection
  if (pathname.match(/^\/contacts\/[^/]+$/)) {
    component = 'Contact Detail'
    scope = 'Module'
  }

  return { portal, component, scope, section: '', url: window.location.href }
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

    // Let the frame settle after dialog closes
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ReportButtonProps {
  portal: 'prodashx' | 'riimo' | 'sentinel'
}

export function ReportButton({ portal }: ReportButtonProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [autoFields, setAutoFields] = useState({ portal: '', component: '', scope: '', section: '', url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reportType, setReportType] = useState('broken')
  const [dragOver, setDragOver] = useState(false)
  const [fabHover, setFabHover] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingChunks, setRecordingChunks] = useState<Blob[]>([])
  const [submitError, setSubmitError] = useState('')

  const handleScreenshot = useCallback(async () => {
    setFabHover(false)
    const parsed = parseUrl()
    setAutoFields(parsed)

    const dataUrl = await captureScreenshot()
    setScreenshot(dataUrl)
    setOpen(true)
  }, [])

  const handleStartRecording = useCallback(async () => {
    setFabHover(false)
    const parsed = parseUrl()
    setAutoFields(parsed)

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
        setRecording(false)
        setMediaRecorder(null)

        const blob = new Blob(chunks, { type: 'video/webm' })
        const reader = new FileReader()
        reader.onload = () => {
          setScreenshot(null) // recording replaces screenshot
          setRecordingChunks([blob])
          setOpen(true)
        }
        reader.readAsDataURL(blob)
      }

      // Auto-stop if user ends share from browser
      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop()
      }

      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
      setRecordingChunks([])
    } catch {
      // User cancelled — do nothing
    }
  }, [])

  const handleStopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
  }, [mediaRecorder])

  // Legacy — keep for the paste-zone click fallback
  const handleClick = handleScreenshot

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = () => setScreenshot(reader.result as string)
        reader.readAsDataURL(file)
      }
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setScreenshot(reader.result as string)
      reader.readAsDataURL(file)
    }
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetchWithAuth('/api/tracker', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          type: reportType,
          description: description.trim() || `Reported from ${autoFields.url}`,
          portal: autoFields.portal || portal.toUpperCase().replace('X', 'X'),
          scope: autoFields.scope || 'Platform',
          component: autoFields.component || '',
          section: autoFields.section || '',
          status: 'queue',
          notes: `Reported by ${user?.email || 'unknown'}\nURL: ${autoFields.url}`,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        setSubmitError((body as Record<string, string>).error || `Failed (${res.status})`)
        setSubmitting(false)
        return
      }

      const json = await res.json()
      const itemId = json.data?.id || json.data?.item_id
      if (itemId && screenshot) {
        const base64 = screenshot.split(',')[1]
        const attachRes = await fetchWithAuth(`/api/tracker/${itemId}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            name: `screenshot-${Date.now()}.png`,
            data: base64,
            content_type: 'image/png',
          }),
        })
        if (!attachRes.ok) {
          const attachBody = await attachRes.json().catch(() => ({ error: `HTTP ${attachRes.status}` }))
          setSubmitError(`Ticket created (${itemId}) but screenshot failed: ${(attachBody as Record<string, string>).error || attachRes.status}`)
        }
      }
      if (itemId && recordingChunks.length > 0) {
        const blob = recordingChunks[0]
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1])
          reader.readAsDataURL(blob)
        })
        const recRes = await fetchWithAuth(`/api/tracker/${itemId}/attachments`, {
          method: 'POST',
          body: JSON.stringify({
            name: `recording-${Date.now()}.webm`,
            data: base64,
            content_type: 'video/webm',
          }),
        })
        if (!recRes.ok) {
          const recBody = await recRes.json().catch(() => ({ error: `HTTP ${recRes.status}` }))
          setSubmitError(`Ticket created (${itemId}) but recording failed: ${(recBody as Record<string, string>).error || recRes.status}`)
        }
      }

      setSubmitted(true)
      setTimeout(() => {
        setOpen(false)
        setScreenshot(null)
        setTitle('')
        setDescription('')
        setSubmitted(false)
        setSubmitError('')
      }, 1500)
    } catch (err) {
      setSubmitError(`Network error: ${err instanceof Error ? err.message : 'Could not reach server'}`)
    }
    setSubmitting(false)
  }, [title, description, autoFields, portal, user, screenshot, reportType, recordingChunks])

  const handleClose = useCallback(() => {
    setOpen(false)
    setScreenshot(null)
    setTitle('')
    setDescription('')
    setSubmitted(false)
    setSubmitError('')
    setRecordingChunks([])
    setReportType('broken')
  }, [])

  // ProDashX has IntakeFAB at bottom-6 right-6 — shift FORGE left
  const fabRight = portal === 'prodashx' ? 88 : 24

  return (
    <>
      {/* ─── FORGE Report FAB ─── */}
      {recording ? (
        /* Stop Recording button — pulsing red */
        <button
          onClick={handleStopRecording}
          className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:shadow-xl"
          style={{ bottom: 24, right: fabRight, background: '#ef4444', animation: 'forgePulse 1.5s ease-in-out infinite' }}
          title="Stop Recording"
        >
          <span className="material-icons-outlined text-white" style={{ fontSize: 22 }}>stop</span>
        </button>
      ) : (
        /* FORGE icon → hover reveals camera above + main button becomes record */
        <div
          className="fixed z-40 flex flex-col items-center gap-2"
          style={{ bottom: 24, right: fabRight }}
          onMouseEnter={() => setFabHover(true)}
          onMouseLeave={() => setFabHover(false)}
        >
          {/* Screenshot option — slides up on hover */}
          <button
            onClick={handleScreenshot}
            className="flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-110"
            style={{
              background: '#e07c3e',
              opacity: fabHover ? 1 : 0,
              transform: fabHover ? 'translateY(0)' : 'translateY(8px)',
              pointerEvents: fabHover ? 'auto' : 'none',
            }}
            title="Screenshot"
          >
            <span className="material-icons-outlined text-white" style={{ fontSize: 18 }}>photo_camera</span>
          </button>

          {/* Main FORGE button — becomes record on hover, opens form on plain click */}
          <button
            onClick={fabHover ? handleStartRecording : () => {
              const parsed = parseUrl()
              setAutoFields(parsed)
              setOpen(true)
            }}
            className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:shadow-xl"
            style={{ background: '#e07c3e', transform: fabHover ? 'scale(1.05)' : 'scale(1)' }}
            title={fabHover ? 'Record Screen' : 'Report Issue to FORGE'}
          >
            {/* Construction icon — default */}
            <span
              className="material-icons-outlined text-white transition-all duration-200"
              style={{ fontSize: 22, opacity: fabHover ? 0 : 1, position: 'absolute' }}
            >
              construction
            </span>
            {/* Red recording dot — on hover */}
            <span
              className="transition-all duration-200 rounded-full"
              style={{
                width: 16,
                height: 16,
                background: '#ef4444',
                opacity: fabHover ? 1 : 0,
                boxShadow: fabHover ? '0 0 0 3px rgba(239,68,68,0.3)' : 'none',
              }}
            />
          </button>
        </div>
      )}

      {/* Pulse animation — only injected when recording to avoid re-render flicker */}
      {recording && (
        <style>{`
          @keyframes forgePulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); }
            50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
          }
        `}</style>
      )}

      {/* ─── Report Modal ─── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
          <div
            className="relative z-10 mx-4 w-full max-w-lg rounded-xl border shadow-2xl"
            style={{
              background: 'var(--bg-card, #161b26)',
              borderColor: 'var(--border-color, #2a3347)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onPaste={handlePaste}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-5 pb-0">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgba(224,124,62,0.15)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: 22, color: '#e07c3e' }}>construction</span>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary, #e2e8f0)' }}>
                  Report Issue
                </h3>
                <p className="truncate text-xs" style={{ color: 'var(--text-muted, #64748b)' }}>
                  {autoFields.portal}{autoFields.component ? ` › ${autoFields.component}` : ''}
                </p>
              </div>
              <button onClick={handleClose} style={{ color: 'var(--text-muted)' }}>
                <span className="material-icons-outlined" style={{ fontSize: 20 }}>close</span>
              </button>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center justify-center p-12">
                <span className="material-icons-outlined" style={{ fontSize: 48, color: 'rgb(34,197,94)' }}>check_circle</span>
                <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Queued for review
                </p>
              </div>
            ) : (
              <div className="p-5">
                {/* Screenshot zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className="mb-4 overflow-hidden rounded-lg"
                  style={{
                    border: `2px ${screenshot ? 'solid' : 'dashed'} ${dragOver ? '#e07c3e' : 'var(--border-color, #2a3347)'}`,
                    background: dragOver ? 'rgba(224,124,62,0.05)' : 'var(--bg-surface, #1c2333)',
                  }}
                >
                  {screenshot ? (
                    <div className="relative">
                      <img src={screenshot} alt="Screenshot" className="w-full" style={{ maxHeight: 240, objectFit: 'contain' }} />
                      <button
                        onClick={() => setScreenshot(null)}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      >
                        ×
                      </button>
                    </div>
                  ) : recordingChunks.length > 0 ? (
                    <div className="relative">
                      <video
                        controls
                        className="w-full rounded"
                        style={{ maxHeight: 240 }}
                        src={URL.createObjectURL(recordingChunks[0])}
                      />
                      <button
                        onClick={() => setRecordingChunks([])}
                        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-sm"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <span className="material-icons-outlined" style={{ fontSize: 28, color: 'var(--text-muted)' }}>screenshot_monitor</span>
                      <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                        Paste screenshot (⌘V) or drag image here
                      </p>
                    </div>
                  )}
                </div>

                {/* Auto-detected context pills */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: 'rgba(74,122,181,0.15)', color: 'var(--portal, #4a7ab5)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: 12 }}>language</span>
                    {autoFields.portal || portal.toUpperCase()}
                  </span>
                  {autoFields.component && (
                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                      style={{ background: 'rgba(224,124,62,0.15)', color: '#e07c3e' }}>
                      <span className="material-icons-outlined" style={{ fontSize: 12 }}>widgets</span>
                      {autoFields.component}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: 'rgba(156,163,175,0.15)', color: 'var(--text-secondary, #94a3b8)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: 12 }}>person</span>
                    {user?.email?.split('@')[0] || 'unknown'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
                    style={{ background: 'rgba(156,163,175,0.15)', color: 'var(--text-secondary, #94a3b8)' }}>
                    <span className="material-icons-outlined" style={{ fontSize: 12 }}>schedule</span>
                    {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                {/* Type selector — four feelings */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {([
                    { key: 'broken', label: "This doesn't work", color: 'rgb(239,68,68)', icon: 'error' },
                    { key: 'improve', label: 'This could be better', color: 'rgb(245,158,11)', icon: 'tune' },
                    { key: 'idea', label: 'This would be amazing', color: 'rgb(168,85,247)', icon: 'lightbulb' },
                    { key: 'question', label: 'How does this work?', color: 'rgb(59,130,246)', icon: 'help' },
                  ] as const).map(t => (
                    <button
                      key={t.key}
                      onClick={() => setReportType(t.key)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: reportType === t.key ? `${t.color}30` : 'transparent',
                        color: reportType === t.key ? t.color : 'var(--text-muted, #64748b)',
                        border: `1px solid ${reportType === t.key ? t.color : 'var(--border-color, #2a3347)'}`,
                      }}
                    >
                      <span className="material-icons-outlined" style={{ fontSize: 14 }}>{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Title — the ONE thing they type */}
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's wrong?"
                  autoFocus
                  className="w-full rounded-lg border px-4 py-3 outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface, #1c2333)',
                    borderColor: 'var(--border-color, #2a3347)',
                    color: 'var(--text-primary, #e2e8f0)',
                    fontSize: 15,
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) handleSubmit() }}
                />

                {/* Optional description */}
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="More details (optional)"
                  rows={2}
                  className="mt-3 w-full resize-none rounded-lg border px-4 py-2.5 text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--bg-surface, #1c2333)',
                    borderColor: 'var(--border-color, #2a3347)',
                    color: 'var(--text-primary, #e2e8f0)',
                  }}
                />

                {/* Actions */}
                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    onClick={handleClose}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                    style={{ color: 'var(--text-secondary, #94a3b8)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!title.trim() || submitting}
                    className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                    style={{ background: '#e07c3e' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: 16 }}>send</span>
                    {submitting ? 'Sending...' : 'Submit'}
                  </button>
                </div>
                {submitError && (
                  <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', color: 'rgb(239,68,68)', fontSize: 12, fontWeight: 500 }}>
                    {submitError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
