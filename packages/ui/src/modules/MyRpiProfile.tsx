'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { QRCodeSVG as QRCode } from 'qrcode.react'
import { query, where, orderBy, doc, updateDoc, type Query, type DocumentData } from 'firebase/firestore'
import { useAuth, buildEntitlementContext } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { collections, getDb } from '@tomachina/db/src/firestore'
import type { User } from '@tomachina/core'

/* ─── Types ─── */

interface UserRecord extends User {
  _id: string
}

interface MeetRoom {
  meet_link?: string
  room_name?: string
  description?: string
  folder_id?: string
  folder_url?: string
  team?: string
  status?: string
}

interface BookingType {
  name: string
  duration_minutes: number
  category?: string
}

interface CalendarSlotConfig {
  /** Map of day -> array of time slots, each slot has meeting type keys enabled */
  [day: string]: Record<string, string[]>
}

interface EmployeeProfile {
  meet_room?: MeetRoom
  calendar_booking_types?: BookingType[]
  calendar_config?: CalendarSlotConfig
  drive_folder_url?: string
  booking_slug?: string
  profile_photo_url?: string
  roadmap_doc_id?: string
  team_folders?: Array<{ name: string; url: string }>
  drop_zone?: Record<string, unknown>
}

function getAge(dob: unknown): number | null {
  if (!dob) return null
  const d = new Date(String(dob))
  if (isNaN(d.getTime())) return null
  const today = new Date()
  let age = today.getUTCFullYear() - d.getUTCFullYear()
  const monthDiff = today.getUTCMonth() - d.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < d.getUTCDate())) age--
  return age >= 0 ? age : null
}

/** Safely parse aliases that may be a JSON string, array, or other */
function parseAliases(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((a) => typeof a === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter((a: unknown) => typeof a === 'string') : []
    } catch {
      return raw.trim() ? [raw] : []
    }
  }
  return []
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Owner',
  1: 'Executive',
  2: 'Leader',
  3: 'User',
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
const TIME_SLOTS = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM',
  '5:00 PM',
] as const

/* ─── QR Code (real, scannable via qrcode.react) ─── */

function QRCodeSVG({ data, size = 120 }: { data: string; size?: number }) {
  return <QRCode value={data} size={size} level="M" />
}

/* ─── Inline Editable Field ─── */

function InlineEditField({
  label,
  value,
  onSave,
  disabled,
  type = 'text',
}: {
  label: string
  value: string | undefined | null
  onSave: (val: string) => Promise<void>
  disabled?: boolean
  type?: 'text' | 'email' | 'tel'
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  const handleSave = async () => {
    if (editValue === (value || '')) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(editValue)
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Stay in edit mode on error
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      void handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(value || '')
      setEditing(false)
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => void handleSave()}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="flex-1 rounded-md border border-[var(--portal)] bg-[var(--bg-surface)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none"
          />
          {saving && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          )}
        </div>
      ) : (
        <div className="group flex items-center gap-1.5">
          <span className={`text-sm ${saved ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'}`}>
            {value || '\u2014'}
          </span>
          {saved && (
            <span className="material-icons-outlined text-[var(--success)]" style={{ fontSize: '14px' }}>
              check_circle
            </span>
          )}
          {!disabled && !saved && (
            <button
              onClick={() => {
                setEditValue(value || '')
                setEditing(true)
              }}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              title={`Edit ${label.toLowerCase()}`}
            >
              <span className="material-icons-outlined text-[var(--text-muted)] hover:text-[var(--portal)]" style={{ fontSize: '14px' }}>
                edit
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Alias Editor ─── */

function AliasEditor({
  aliases: rawAliases,
  isOwnProfile,
  profileId,
}: {
  aliases: unknown
  isOwnProfile: boolean
  profileId: string | undefined
}) {
  const aliases = parseAliases(rawAliases)
  const [adding, setAdding] = useState(false)
  const [newAlias, setNewAlias] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  const persist = useCallback(async (updated: string[]) => {
    if (!profileId) return
    setSaving(true)
    try {
      const ref = doc(getDb(), 'users', profileId)
      await updateDoc(ref, { aliases: updated, updated_at: new Date().toISOString() })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }, [profileId])

  const handleAdd = useCallback(async () => {
    const trimmed = newAlias.trim()
    if (!trimmed) { setAdding(false); return }
    await persist([...aliases, trimmed])
    setNewAlias('')
    setAdding(false)
  }, [newAlias, aliases, persist])

  const handleRemove = useCallback(async (idx: number) => {
    await persist(aliases.filter((_, i) => i !== idx))
  }, [aliases, persist])

  if (!isOwnProfile && aliases.length === 0) return null

  return (
    <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Aliases
        </span>
        {saved && (
          <span className="material-icons-outlined text-[var(--success)]" style={{ fontSize: '14px' }}>
            check_circle
          </span>
        )}
        {saving && (
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {aliases.map((alias, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]"
          >
            {alias}
            {isOwnProfile && (
              <button
                onClick={() => void handleRemove(i)}
                className="ml-0.5 text-[var(--text-muted)] transition-colors hover:text-[var(--error)]"
                title={`Remove "${alias}"`}
              >
                <span className="material-icons-outlined" style={{ fontSize: '12px' }}>close</span>
              </button>
            )}
          </span>
        ))}
        {isOwnProfile && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-[var(--border-subtle)] px-2.5 py-0.5 text-xs text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '12px' }}>add</span>
            Add alias
          </button>
        )}
        {isOwnProfile && adding && (
          <input
            ref={inputRef}
            value={newAlias}
            onChange={(e) => setNewAlias(e.target.value)}
            onBlur={() => void handleAdd()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd()
              if (e.key === 'Escape') { setNewAlias(''); setAdding(false) }
            }}
            placeholder="Type alias..."
            className="rounded-full border border-[var(--portal)] bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs text-[var(--text-primary)] outline-none"
            style={{ width: '120px' }}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Drop Zone Link Row ─── */

function DropZoneLink({
  label,
  url,
  icon,
}: {
  label: string
  url: string | undefined
  icon: string
}) {
  const [showQR, setShowQR] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard not available
    }
  }, [url])

  if (!url) return null

  const displayUrl = url.length > 40 ? url.slice(0, 37) + '...' : url

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
        <span
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--portal-glow)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>
            {icon}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
          <p className="truncate text-sm text-[var(--text-secondary)]" title={url}>
            {displayUrl}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void handleCopy()}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Copy URL"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
              {copied ? 'check' : 'content_copy'}
            </span>
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            title="Open in new tab"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>open_in_new</span>
          </a>
          <button
            onClick={() => setShowQR((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--bg-hover)] ${
              showQR ? 'text-[var(--portal)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
            title="Show QR code"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>qr_code</span>
          </button>
        </div>
      </div>
      {showQR && (
        <div className="flex justify-center rounded-lg border border-[var(--border-subtle)] bg-white p-3">
          <QRCodeSVG data={url} size={140} />
        </div>
      )}
    </div>
  )
}

/* ─── Drop Zone: Audio Recorder ─── */

type RecordingState = 'idle' | 'recording' | 'recorded'

function AudioRecorder() {
  const [state, setState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(url)
        setState('recorded')
        cleanup()
      }

      recorder.start()
      setDuration(0)
      setState('recording')
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    } catch {
      // Microphone access denied or unavailable
    }
  }, [audioUrl, cleanup])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const discardRecording = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl(null)
    setState('idle')
    setDuration(0)
    setSubmitted(false)
  }, [audioUrl])

  const handleSubmit = useCallback(() => {
    setSubmitted(true)
  }, [])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
          mic
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">Audio Recorder</span>
      </div>

      {state === 'idle' && (
        <button
          onClick={() => void startRecording()}
          className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--portal)]">
            <span className="material-icons-outlined text-white" style={{ fontSize: '16px' }}>mic</span>
          </span>
          Start Recording
        </button>
      )}

      {state === 'recording' && (
        <div className="flex items-center gap-4 rounded-lg border border-[var(--error)] bg-[rgba(239,68,68,0.04)] px-4 py-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--error)] opacity-20" />
            <span className="relative flex h-3 w-3 rounded-full bg-[var(--error)]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[var(--error)]">Recording...</p>
            <p className="font-mono text-xs text-[var(--text-muted)]">{formatTime(duration)}</p>
          </div>
          <button
            onClick={stopRecording}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--error)] px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>stop</span>
            Stop
          </button>
        </div>
      )}

      {state === 'recorded' && audioUrl && (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
              audio_file
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)]">Recording captured</p>
              <p className="text-xs text-[var(--text-muted)]">{formatTime(duration)} duration</p>
            </div>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={audioUrl} controls className="w-full" style={{ height: '32px' }} />
          {submitted ? (
            <div className="flex items-center gap-2 rounded-md bg-[rgba(16,185,129,0.08)] px-3 py-2">
              <span className="material-icons-outlined text-[var(--success)]" style={{ fontSize: '16px' }}>
                schedule
              </span>
              <span className="text-xs text-[var(--success)]">
                Queued for processing — Vision intelligence available in Sprint 11
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--portal)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>cloud_upload</span>
                Submit Recording
              </button>
              <button
                onClick={discardRecording}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--error)] hover:text-[var(--error)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>delete</span>
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Drop Zone: Document Camera ─── */

type CameraState = 'idle' | 'previewing' | 'captured'

function DocumentCamera() {
  const [state, setState] = useState<CameraState>('idle')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopStream()
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      setState('previewing')
      // Assign stream after state update so videoRef is mounted
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
    } catch {
      // Camera access denied or unavailable
    }
  }, [])

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) return
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      const url = URL.createObjectURL(blob)
      setImageUrl(url)
      setState('captured')
      stopStream()
    }, 'image/jpeg', 0.92)
  }, [imageUrl, stopStream])

  const retake = useCallback(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setImageUrl(null)
    setUploaded(false)
    setState('idle')
  }, [imageUrl])

  const closeCamera = useCallback(() => {
    stopStream()
    setState('idle')
  }, [stopStream])

  const handleUpload = useCallback(() => {
    setUploaded(true)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
          photo_camera
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">Document Camera</span>
      </div>

      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {state === 'idle' && (
        <button
          onClick={() => void openCamera()}
          className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-4 py-3 text-sm text-[var(--text-secondary)] transition-colors hover:border-[var(--portal)] hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--portal)]">
            <span className="material-icons-outlined text-white" style={{ fontSize: '16px' }}>photo_camera</span>
          </span>
          Open Camera
        </button>
      )}

      {state === 'previewing' && (
        <div className="space-y-2">
          <div className="relative overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={{ maxHeight: '280px', objectFit: 'cover' }}
            />
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-3 bg-gradient-to-t from-black/60 to-transparent p-3">
              <button
                onClick={closeCamera}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                title="Close camera"
              >
                <span className="material-icons-outlined" style={{ fontSize: '20px' }}>close</span>
              </button>
              <button
                onClick={capturePhoto}
                className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white/30 backdrop-blur-sm transition-colors hover:bg-white/50"
                title="Capture photo"
              >
                <span className="material-icons-outlined text-white" style={{ fontSize: '24px' }}>camera</span>
              </button>
              <div className="h-10 w-10" /> {/* Spacer for centering */}
            </div>
          </div>
          <p className="text-center text-xs text-[var(--text-muted)]">
            Position document within frame, then tap the capture button
          </p>
        </div>
      )}

      {state === 'captured' && imageUrl && (
        <div className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <div className="overflow-hidden rounded-md border border-[var(--border-subtle)]">
            <img
              src={imageUrl}
              alt="Captured document"
              className="w-full"
              style={{ maxHeight: '200px', objectFit: 'contain', background: '#f5f5f5' }}
            />
          </div>
          {uploaded ? (
            <div className="flex items-center gap-2 rounded-md bg-[rgba(16,185,129,0.08)] px-3 py-2">
              <span className="material-icons-outlined text-[var(--success)]" style={{ fontSize: '16px' }}>
                schedule
              </span>
              <span className="text-xs text-[var(--success)]">
                Queued for processing — Vision intelligence available in Sprint 11
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpload}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--portal)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>cloud_upload</span>
                Upload to Drive
              </button>
              <button
                onClick={retake}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>replay</span>
                Retake
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Drop Zone: Processing Status ─── */

interface DropZoneSubmission {
  id: string
  type: 'audio' | 'document' | 'file'
  name: string
  submitted_at: string
  status: 'processing' | 'approved' | 'pending_review' | 'rejected'
  extracted_type?: string
}

const MOCK_SUBMISSIONS: DropZoneSubmission[] = [
  {
    id: 'dz-001',
    type: 'audio',
    name: 'Client meeting — Johnson review',
    submitted_at: '2026-03-15T09:14:00Z',
    status: 'processing',
    extracted_type: 'Meeting notes',
  },
  {
    id: 'dz-002',
    type: 'document',
    name: 'Annuity application — page 1',
    submitted_at: '2026-03-15T08:45:00Z',
    status: 'approved',
    extracted_type: '1035 Exchange',
  },
  {
    id: 'dz-003',
    type: 'document',
    name: 'Driver license — front',
    submitted_at: '2026-03-14T16:30:00Z',
    status: 'pending_review',
    extracted_type: 'ID Verification',
  },
  {
    id: 'dz-004',
    type: 'audio',
    name: 'Voicemail — carrier callback',
    submitted_at: '2026-03-14T14:22:00Z',
    status: 'processing',
    extracted_type: 'Voicemail transcription',
  },
  {
    id: 'dz-005',
    type: 'file',
    name: 'Statement — Schwab Q1',
    submitted_at: '2026-03-14T11:05:00Z',
    status: 'approved',
    extracted_type: 'Account statement',
  },
  {
    id: 'dz-006',
    type: 'document',
    name: 'Medicare card — Smith',
    submitted_at: '2026-03-14T10:18:00Z',
    status: 'processing',
    extracted_type: 'Medicare ID',
  },
]

const STATUS_CONFIG: Record<DropZoneSubmission['status'], { label: string; color: string; bg: string; icon: string }> = {
  processing: { label: 'Processing', color: 'var(--portal)', bg: 'var(--portal-glow)', icon: 'autorenew' },
  approved: { label: 'Approved', color: 'var(--success)', bg: 'rgba(16,185,129,0.1)', icon: 'check_circle' },
  pending_review: { label: 'Pending Review', color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)', icon: 'pending' },
  rejected: { label: 'Rejected', color: 'var(--error)', bg: 'rgba(239,68,68,0.1)', icon: 'cancel' },
}

const TYPE_ICONS: Record<DropZoneSubmission['type'], string> = {
  audio: 'audio_file',
  document: 'image',
  file: 'description',
}

function ProcessingStatus() {
  const submissions = MOCK_SUBMISSIONS

  const counts = useMemo(() => {
    const c = { processing: 0, approved: 0, pending_review: 0, rejected: 0 }
    for (const s of submissions) c[s.status]++
    return c
  }, [submissions])

  const formatRelative = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
          fact_check
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">Processing Status</span>
      </div>

      {/* Summary bar */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(counts) as [DropZoneSubmission['status'], number][])
          .filter(([, v]) => v > 0)
          .map(([status, count]) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '13px' }}>{cfg.icon}</span>
                {count} {cfg.label}
              </span>
            )
          })}
      </div>

      {/* Submission cards */}
      <div className="space-y-1.5">
        {submissions.map((s) => {
          const cfg = STATUS_CONFIG[s.status]
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5"
            >
              <span
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                style={{ background: cfg.bg }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px', color: cfg.color }}>
                  {TYPE_ICONS[s.type]}
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-[var(--text-primary)]">{s.name}</p>
                <div className="flex items-center gap-2">
                  {s.extracted_type && (
                    <span className="text-xs text-[var(--text-muted)]">{s.extracted_type}</span>
                  )}
                  <span className="text-xs text-[var(--text-muted)]">{formatRelative(s.submitted_at)}</span>
                </div>
              </div>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                <span
                  className={`material-icons-outlined ${s.status === 'processing' ? 'animate-spin' : ''}`}
                  style={{ fontSize: '11px' }}
                >
                  {cfg.icon}
                </span>
                {cfg.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Drop Zone: Agent Status ─── */

function AgentStatus() {
  const agents: { name: string; status: 'active' | 'idle' | 'offline'; task?: string; icon: string }[] = [
    { name: 'Vision Processor', status: 'active', task: 'Analyzing annuity application...', icon: 'visibility' },
    { name: 'Transcription Engine', status: 'active', task: 'Transcribing client meeting...', icon: 'hearing' },
    { name: 'Data Router', status: 'idle', icon: 'alt_route' },
    { name: 'Approval Gateway', status: 'active', task: '1 item awaiting review', icon: 'verified_user' },
  ]

  const statusColors: Record<string, { dot: string; text: string }> = {
    active: { dot: 'var(--success)', text: 'var(--success)' },
    idle: { dot: 'var(--text-muted)', text: 'var(--text-muted)' },
    offline: { dot: 'var(--error)', text: 'var(--error)' },
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
          smart_toy
        </span>
        <span className="text-sm font-medium text-[var(--text-primary)]">Agent Status</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {agents.map((a) => {
          const sc = statusColors[a.status]
          return (
            <div
              key={a.name}
              className="flex items-start gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5"
            >
              <span className="material-icons-outlined mt-0.5" style={{ fontSize: '16px', color: 'var(--portal)' }}>
                {a.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: sc.dot }}
                  />
                  <span className="text-xs font-medium text-[var(--text-primary)]">{a.name}</span>
                </div>
                <p className="mt-0.5 truncate text-[11px]" style={{ color: sc.text }}>
                  {a.task || (a.status === 'idle' ? 'Waiting for work...' : 'Offline')}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Main Component ─── */

interface MyRpiProfileProps {
  portal: string
}

export function MyRpiProfile({ portal }: MyRpiProfileProps) {
  const { user } = useAuth()
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [calendarSaved, setCalendarSaved] = useState(false)
  const [calendarConfig, setCalendarConfig] = useState<CalendarSlotConfig>({})

  // Drop Zone link editing
  const [editingDropLinks, setEditingDropLinks] = useState(false)
  const [dropLinkMeet, setDropLinkMeet] = useState('')
  const [dropLinkFolder, setDropLinkFolder] = useState('')
  const [dropLinkSlug, setDropLinkSlug] = useState('')
  const [dropLinkSaving, setDropLinkSaving] = useState(false)
  const [dropLinkSaved, setDropLinkSaved] = useState(false)

  // Document type preferences
  const [docTypePrefs, setDocTypePrefs] = useState<Record<string, boolean>>({
    applications: true,
    tax_docs: true,
    id_documents: true,
    medical_records: true,
  })
  const [docPrefSaving, setDocPrefSaving] = useState(false)
  const [docPrefSaved, setDocPrefSaved] = useState(false)

  // Meeting type CRUD
  const [localMeetingTypes, setLocalMeetingTypes] = useState<BookingType[]>([])
  const [newMtName, setNewMtName] = useState('')
  const [newMtDuration, setNewMtDuration] = useState(30)
  const [newMtCategory, setNewMtCategory] = useState('')
  const [mtSaving, setMtSaving] = useState(false)
  const [mtSaved, setMtSaved] = useState(false)

  // Build entitlement context for LEADER+ check
  const entitlementCtx = useMemo(() => buildEntitlementContext(user), [user])
  const isLeaderPlus = entitlementCtx.userLevel === 'OWNER' ||
    entitlementCtx.userLevel === 'EXECUTIVE' ||
    entitlementCtx.userLevel === 'LEADER'

  // Current profile email
  const profileEmail = selectedEmail || user?.email || ''
  const isOwnProfile = !selectedEmail || selectedEmail === user?.email

  // Query current user's profile
  const userQuery: Query<DocumentData> | null = useMemo(() => {
    if (!profileEmail) return null
    return query(collections.users(), where('email', '==', profileEmail))
  }, [profileEmail])

  const { data: userRecords, loading, error } = useCollection<UserRecord>(
    userQuery,
    `myrpi-profile-${profileEmail}`
  )
  const profile = userRecords.length > 0 ? userRecords[0] : null

  // Query team members for LEADER+ profile switcher
  const teamQuery: Query<DocumentData> | null = useMemo(() => {
    if (!isLeaderPlus || !user?.email) return null
    return query(collections.users(), orderBy('last_name'))
  }, [isLeaderPlus, user?.email])

  const { data: teamMembers } = useCollection<UserRecord>(
    teamQuery,
    `myrpi-team-${user?.email || 'none'}`
  )

  // Query direct reports
  const reportsQuery: Query<DocumentData> | null = useMemo(() => {
    if (!isLeaderPlus || !profileEmail) return null
    return query(collections.users(), where('manager_email', '==', profileEmail))
  }, [isLeaderPlus, profileEmail])

  const { data: directReports } = useCollection<UserRecord>(
    reportsQuery,
    `myrpi-reports-${profileEmail}`
  )

  // Parse employee profile
  const empProfile = useMemo<EmployeeProfile | null>(() => {
    if (!profile?.employee_profile) return null
    return profile.employee_profile as EmployeeProfile
  }, [profile?.employee_profile])

  // Initialize calendar config from Firestore
  useEffect(() => {
    if (empProfile?.calendar_config) {
      setCalendarConfig(empProfile.calendar_config)
    }
  }, [empProfile?.calendar_config])

  // Initialize drop zone link fields when profile loads
  useEffect(() => {
    setDropLinkMeet(empProfile?.meet_room?.meet_link || '')
    setDropLinkFolder(empProfile?.meet_room?.folder_url || '')
    setDropLinkSlug(empProfile?.booking_slug || '')
  }, [empProfile?.meet_room?.meet_link, empProfile?.meet_room?.folder_url, empProfile?.booking_slug])

  // Initialize doc type preferences when profile loads
  useEffect(() => {
    if (empProfile?.drop_zone?.doc_type_preferences) {
      setDocTypePrefs(empProfile.drop_zone.doc_type_preferences as Record<string, boolean>)
    }
  }, [empProfile?.drop_zone])

  // Initialize local meeting types when profile loads
  useEffect(() => {
    setLocalMeetingTypes(empProfile?.calendar_booking_types || [])
  }, [empProfile?.calendar_booking_types])

  // Meeting types for calendar grid
  const meetingTypes = localMeetingTypes

  // Field save handler
  const saveField = useCallback(
    async (field: string, value: string) => {
      if (!profile?._id) return
      const ref = doc(getDb(), 'users', profile._id)
      const update: Record<string, unknown> = {
        [field]: value,
        updated_at: new Date().toISOString(),
      }
      await updateDoc(ref, update)
    },
    [profile]
  )

  // Calendar config toggle
  const toggleCalendarSlot = useCallback(
    (day: string, timeSlot: string, meetingTypeName: string) => {
      setCalendarConfig((prev) => {
        const dayConfig = prev[day] ? { ...prev[day] } : {} as Record<string, string[]>
        const slotTypes = [...(dayConfig[timeSlot] || [])]
        const idx = slotTypes.indexOf(meetingTypeName)
        if (idx >= 0) {
          slotTypes.splice(idx, 1)
        } else {
          slotTypes.push(meetingTypeName)
        }
        dayConfig[timeSlot] = slotTypes
        return { ...prev, [day]: dayConfig }
      })
    },
    []
  )

  // Save calendar config
  const saveCalendarConfig = useCallback(async () => {
    if (!profile?._id) return
    setCalendarSaving(true)
    try {
      const ref = doc(getDb(), 'users', profile._id)
      await updateDoc(ref, {
        'employee_profile.calendar_config': calendarConfig,
        updated_at: new Date().toISOString(),
      })
      setCalendarSaved(true)
      setTimeout(() => setCalendarSaved(false), 2000)
    } catch {
      // Error handling
    } finally {
      setCalendarSaving(false)
    }
  }, [profile, calendarConfig])

  // Save drop zone links
  const saveDropLinks = useCallback(async () => {
    if (!profile?._id) return
    setDropLinkSaving(true)
    try {
      const ref = doc(getDb(), 'users', profile._id)
      await updateDoc(ref, {
        'employee_profile.meet_room.meet_link': dropLinkMeet,
        'employee_profile.meet_room.folder_url': dropLinkFolder,
        'employee_profile.booking_slug': dropLinkSlug,
        updated_at: new Date().toISOString(),
      })
      setDropLinkSaved(true)
      setEditingDropLinks(false)
      setTimeout(() => setDropLinkSaved(false), 2000)
    } catch {
      // Error — stay in edit mode
    } finally {
      setDropLinkSaving(false)
    }
  }, [profile, dropLinkMeet, dropLinkFolder, dropLinkSlug])

  // Save document type preferences
  const saveDocTypePrefs = useCallback(async (prefs: Record<string, boolean>) => {
    if (!profile?._id) return
    setDocPrefSaving(true)
    try {
      const ref = doc(getDb(), 'users', profile._id)
      await updateDoc(ref, {
        'employee_profile.drop_zone.doc_type_preferences': prefs,
        updated_at: new Date().toISOString(),
      })
      setDocPrefSaved(true)
      setTimeout(() => setDocPrefSaved(false), 2000)
    } catch {
      // Error
    } finally {
      setDocPrefSaving(false)
    }
  }, [profile])

  // Toggle a document type preference
  const toggleDocTypePref = useCallback((key: string) => {
    setDocTypePrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] }
      void saveDocTypePrefs(updated)
      return updated
    })
  }, [saveDocTypePrefs])

  // Save meeting types to Firestore
  const persistMeetingTypes = useCallback(async (types: BookingType[]) => {
    if (!profile?._id) return
    setMtSaving(true)
    try {
      const ref = doc(getDb(), 'users', profile._id)
      await updateDoc(ref, {
        'employee_profile.calendar_booking_types': types,
        updated_at: new Date().toISOString(),
      })
      setMtSaved(true)
      setTimeout(() => setMtSaved(false), 2000)
    } catch {
      // Error
    } finally {
      setMtSaving(false)
    }
  }, [profile])

  // Add meeting type
  const addMeetingType = useCallback(async () => {
    const name = newMtName.trim()
    if (!name) return
    const newType: BookingType = {
      name,
      duration_minutes: newMtDuration,
      ...(newMtCategory.trim() ? { category: newMtCategory.trim() } : {}),
    }
    const updated = [...localMeetingTypes, newType]
    setLocalMeetingTypes(updated)
    setNewMtName('')
    setNewMtDuration(30)
    setNewMtCategory('')
    await persistMeetingTypes(updated)
  }, [newMtName, newMtDuration, newMtCategory, localMeetingTypes, persistMeetingTypes])

  // Remove meeting type
  const removeMeetingType = useCallback(async (idx: number) => {
    const updated = localMeetingTypes.filter((_, i) => i !== idx)
    setLocalMeetingTypes(updated)
    await persistMeetingTypes(updated)
  }, [localMeetingTypes, persistMeetingTypes])

  // Booking URLs
  const bookingSlug = empProfile?.booking_slug
  const externalBookingUrl = bookingSlug
    ? `https://calendar.google.com/calendar/appointments/schedules/${bookingSlug}`
    : undefined
  const internalBookingUrl = bookingSlug
    ? `https://calendar.google.com/calendar/appointments/schedules/${bookingSlug}?internal=true`
    : undefined

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load profile: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Profile Switcher (LEADER+ only) */}
      {isLeaderPlus && teamMembers.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '18px' }}>
            swap_horiz
          </span>
          <select
            value={selectedEmail || ''}
            onChange={(e) => setSelectedEmail(e.target.value || null)}
            className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
          >
            <option value="">My Profile</option>
            {teamMembers
              .filter((m, i, arr) => m.email !== user?.email && arr.findIndex((x) => x.email === m.email || (`${x.first_name} ${x.last_name}` === `${m.first_name} ${m.last_name}`)) === i)
              .map((m) => (
                <option key={m._id} value={m.email}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
          </select>
          {selectedEmail && (
            <span className="text-xs text-[var(--text-muted)]">Viewing as read-only</span>
          )}
        </div>
      )}

      {/* ─── Section 1: Profile Header ─── */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {(user?.photoURL && isOwnProfile) || (profile?.employee_profile as EmployeeProfile | undefined)?.profile_photo_url ? (
            <img
              src={isOwnProfile ? (user?.photoURL || '') : ((profile?.employee_profile as EmployeeProfile | undefined)?.profile_photo_url || '')}
              alt=""
              className="h-20 w-20 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ background: 'var(--portal)' }}
            >
              {(profile?.first_name || user?.displayName || '?')[0].toUpperCase()}
            </div>
          )}

          {/* Name + Info */}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {profile?.first_name
                ? `${profile.first_name} ${profile.last_name}`
                : user?.displayName || 'Unknown'}
            </h2>
            {(() => {
              const aliases = parseAliases(profile?.aliases)
              return aliases.length > 0 ? (
                <p className="text-sm text-[var(--text-muted)]">
                  Goes by: {aliases.join(', ')}
                </p>
              ) : null
            })()}
            <div className="mt-1 flex items-center gap-2">
              {profile?.status && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{
                    background: profile.status.toLowerCase() === 'active'
                      ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: profile.status.toLowerCase() === 'active'
                      ? 'var(--success)' : 'var(--error)',
                  }}
                >
                  {profile.status}
                </span>
              )}
              {profile?.level !== undefined && (
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ background: 'var(--portal-glow)', color: 'var(--portal-accent)' }}
                >
                  {LEVEL_LABELS[profile.level] || `Level ${profile.level}`}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--text-secondary)]">
              {profile?.job_title && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>work</span>
                  {profile.job_title}
                </span>
              )}
              {profile?.division && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>account_tree</span>
                  {profile.division}
                </span>
              )}
              {profile?.location && (
                <span className="flex items-center gap-1">
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>location_on</span>
                  {profile.location}
                </span>
              )}
              {(() => {
                const age = getAge(profile?.dob)
                return age !== null ? (
                  <span className="flex items-center gap-1">
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>cake</span>
                    Age {age}
                  </span>
                ) : null
              })()}
            </div>
          </div>
        </div>

        {/* Direct Reports (LEADER+ viewing) */}
        {isLeaderPlus && directReports.length > 0 && (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
              Direct Reports ({directReports.length})
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {directReports.map((r) => (
                <button
                  key={r._id}
                  onClick={() => setSelectedEmail(r.email)}
                  className="flex items-center gap-1.5 rounded-full bg-[var(--bg-surface)] px-3 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>person</span>
                  {r.first_name} {r.last_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 2: Communication Preferences ─── */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>contact_phone</span>
          Communication Preferences
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InlineEditField
            label="Phone"
            value={profile?.phone}
            onSave={(val) => saveField('phone', val)}
            disabled={!isOwnProfile}
            type="tel"
          />
          <InlineEditField
            label="Email"
            value={profile?.email || user?.email}
            onSave={(val) => saveField('email', val)}
            disabled={true}
            type="email"
          />
          <InlineEditField
            label="Personal Email"
            value={profile?.personal_email}
            onSave={(val) => saveField('personal_email', val)}
            disabled={!isOwnProfile}
            type="email"
          />
          <InlineEditField
            label="First Name"
            value={profile?.first_name}
            onSave={(val) => saveField('first_name', val)}
            disabled={!isOwnProfile}
          />
          <InlineEditField
            label="Last Name"
            value={profile?.last_name}
            onSave={(val) => saveField('last_name', val)}
            disabled={!isOwnProfile}
          />
          <InlineEditField
            label="Location"
            value={profile?.location}
            onSave={(val) => saveField('location', val)}
            disabled={!isOwnProfile}
          />
        </div>

        {/* Aliases */}
        <AliasEditor
          aliases={profile?.aliases || []}
          isOwnProfile={isOwnProfile}
          profileId={profile?._id}
        />
      </div>

      {/* ─── Section 3: Quick Links ─── */}
      {empProfile && (empProfile.drive_folder_url || (empProfile.team_folders && empProfile.team_folders.length > 0) || empProfile.roadmap_doc_id) && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>link</span>
            Quick Links
          </h3>
          <div className="flex flex-wrap gap-2">
            {empProfile.drive_folder_url && (
              <a
                href={empProfile.drive_folder_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>folder</span>
                HR Folder
              </a>
            )}
            {empProfile.roadmap_doc_id && (
              <a
                href={`https://docs.google.com/document/d/${empProfile.roadmap_doc_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>description</span>
                Roadmap
              </a>
            )}
            {empProfile.team_folders?.map((f, i) => (
              <a
                key={i}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
              >
                <span className="material-icons-outlined" style={{ fontSize: '16px' }}>folder_shared</span>
                {f.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ─── Section 4: My Drop Zone ─── */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '24px' }}>
            cloud_upload
          </span>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">My Drop Zone</h3>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Your single entry point into MACHINA. Share your links, record meetings, snap documents.
        </p>

        {/* Quick Links */}
        {!editingDropLinks ? (
          <div className="mt-4 space-y-3">
            <DropZoneLink
              label="Meet Link"
              url={empProfile?.meet_room?.meet_link}
              icon="videocam"
            />
            <DropZoneLink
              label="Intake Folder"
              url={empProfile?.meet_room?.folder_url}
              icon="drive_folder_upload"
            />
            <DropZoneLink
              label="Booking Page (External)"
              url={externalBookingUrl}
              icon="calendar_month"
            />
            <DropZoneLink
              label="Booking Page (Internal)"
              url={internalBookingUrl}
              icon="event"
            />

            {/* Empty state if no drop zone links */}
            {!empProfile?.meet_room?.meet_link && !empProfile?.meet_room?.folder_url && !bookingSlug && (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-8">
                <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">cloud_off</span>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  No Drop Zone links configured yet.
                </p>
              </div>
            )}

            {isOwnProfile && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingDropLinks(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:border-[var(--portal)] hover:text-[var(--portal)]"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>
                  Edit Links
                </button>
                {dropLinkSaved && (
                  <span className="flex items-center gap-1 text-xs text-[var(--success)]">
                    <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check_circle</span>
                    Saved
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-[var(--portal)] bg-[var(--bg-surface)] p-4 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Meet Link URL
                </label>
                <input
                  type="url"
                  value={dropLinkMeet}
                  onChange={(e) => setDropLinkMeet(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Intake Folder URL
                </label>
                <input
                  type="url"
                  value={dropLinkFolder}
                  onChange={(e) => setDropLinkFolder(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Booking Slug
                </label>
                <input
                  type="text"
                  value={dropLinkSlug}
                  onChange={(e) => setDropLinkSlug(e.target.value)}
                  placeholder="AcsSYZ..."
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
                <p className="text-[11px] text-[var(--text-muted)]">
                  The ID from your Google Calendar appointment schedule URL
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => void saveDropLinks()}
                  disabled={dropLinkSaving}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
                  style={{ background: 'var(--portal)' }}
                >
                  {dropLinkSaving ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-icons-outlined" style={{ fontSize: '14px' }}>save</span>
                      Save Links
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setDropLinkMeet(empProfile?.meet_room?.meet_link || '')
                    setDropLinkFolder(empProfile?.meet_room?.folder_url || '')
                    setDropLinkSlug(empProfile?.booking_slug || '')
                    setEditingDropLinks(false)
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-muted)] transition-colors hover:border-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Document Preferences */}
        {isOwnProfile && (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center gap-2">
              <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '18px' }}>
                tune
              </span>
              <span className="text-sm font-medium text-[var(--text-primary)]">Document Preferences</span>
              {docPrefSaving && (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
              )}
              {docPrefSaved && (
                <span className="material-icons-outlined text-[var(--success)]" style={{ fontSize: '14px' }}>
                  check_circle
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Choose which document types appear in your Drop Zone.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                { key: 'applications', label: 'Applications', icon: 'description' },
                { key: 'tax_docs', label: 'Tax Docs', icon: 'receipt_long' },
                { key: 'id_documents', label: 'ID Documents', icon: 'badge' },
                { key: 'medical_records', label: 'Medical Records', icon: 'medical_information' },
              ] as const).map((dt) => (
                <button
                  key={dt.key}
                  onClick={() => toggleDocTypePref(dt.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                    docTypePrefs[dt.key]
                      ? 'border-[var(--portal)] text-[var(--text-primary)]'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                  }`}
                  style={docTypePrefs[dt.key] ? { background: 'var(--portal-glow)' } : undefined}
                >
                  <span
                    className="material-icons-outlined"
                    style={{ fontSize: '16px', color: docTypePrefs[dt.key] ? 'var(--portal)' : 'var(--text-muted)' }}
                  >
                    {dt.icon}
                  </span>
                  {dt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Capture Tools */}
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
          <h4 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '14px' }}>build</span>
            Capture Tools
          </h4>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AudioRecorder />
            <DocumentCamera />
          </div>
        </div>

        {/* Processing Status */}
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
          <ProcessingStatus />
        </div>

        {/* Agent Status */}
        <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
          <AgentStatus />
        </div>
      </div>

      {/* ─── Section 5: Meeting Config ─── */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-4 flex items-center gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>event_available</span>
            Meeting Configuration
          </h3>
          {mtSaving && (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
          )}
          {mtSaved && (
            <span className="flex items-center gap-1 text-xs text-[var(--success)]">
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check_circle</span>
              Saved
            </span>
          )}
        </div>

        {meetingTypes.length > 0 ? (
          <div className="space-y-2">
            {meetingTypes.map((mt, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: 'var(--portal-glow)' }}
                  >
                    <span className="material-icons-outlined" style={{ fontSize: '16px', color: 'var(--portal)' }}>
                      schedule
                    </span>
                  </span>
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{mt.name}</span>
                    {mt.category && (
                      <p className="text-xs text-[var(--text-muted)]">{mt.category}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[var(--portal-glow)] px-2.5 py-0.5 text-xs font-medium text-[var(--portal-accent)]">
                    {mt.duration_minutes} min
                  </span>
                  {isOwnProfile && (
                    <button
                      onClick={() => void removeMeetingType(i)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--error)]"
                      title={`Remove "${mt.name}"`}
                    >
                      <span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-8">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">event_busy</span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No meeting types configured yet.{isOwnProfile ? ' Add one below.' : ''}
            </p>
          </div>
        )}

        {/* Add meeting type form */}
        {isOwnProfile && (
          <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Name
                </label>
                <input
                  type="text"
                  value={newMtName}
                  onChange={(e) => setNewMtName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addMeetingType() }}
                  placeholder="e.g. Initial Consult"
                  className="w-40 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Duration
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={newMtDuration}
                    onChange={(e) => setNewMtDuration(Math.max(5, parseInt(e.target.value) || 5))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void addMeetingType() }}
                    min={5}
                    step={5}
                    className="w-16 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                  />
                  <span className="text-xs text-[var(--text-muted)]">min</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Category
                </label>
                <input
                  type="text"
                  value={newMtCategory}
                  onChange={(e) => setNewMtCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void addMeetingType() }}
                  placeholder="Optional"
                  className="w-28 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
                />
              </div>
              <button
                onClick={() => void addMeetingType()}
                disabled={!newMtName.trim() || mtSaving}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-40"
                style={{ background: 'var(--portal)' }}
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Section 6: Calendar Config ─── */}
      {meetingTypes.length > 0 && isOwnProfile && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              <span className="material-icons-outlined" style={{ fontSize: '16px' }}>date_range</span>
              Weekly Availability
            </h3>
            <button
              onClick={() => void saveCalendarConfig()}
              disabled={calendarSaving}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ background: 'var(--portal)' }}
            >
              {calendarSaving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : calendarSaved ? (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check</span>
                  Saved
                </>
              ) : (
                <>
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>save</span>
                  Save
                </>
              )}
            </button>
          </div>

          <p className="mb-4 text-xs text-[var(--text-muted)]">
            Select which meeting types you accept for each time slot. Your Google Calendar availability is also checked when booking.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-[var(--bg-card)] pb-2 pr-3 text-left font-medium text-[var(--text-muted)]">
                    Time
                  </th>
                  {DAYS.map((day) => (
                    <th key={day} className="pb-2 text-center font-medium text-[var(--text-muted)]" style={{ minWidth: '100px' }}>
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot} className="border-t border-[var(--border-subtle)]">
                    <td className="sticky left-0 z-10 bg-[var(--bg-card)] py-1.5 pr-3 text-[var(--text-muted)]">
                      {slot}
                    </td>
                    {DAYS.map((day) => {
                      const dayConfig = calendarConfig[day] || {}
                      const slotTypes = dayConfig[slot] || []
                      return (
                        <td key={day} className="py-1.5 text-center">
                          <div className="flex flex-wrap justify-center gap-0.5">
                            {meetingTypes.map((mt) => {
                              const isActive = slotTypes.includes(mt.name)
                              return (
                                <button
                                  key={mt.name}
                                  onClick={() => toggleCalendarSlot(day, slot, mt.name)}
                                  className={`rounded px-1 py-0.5 text-[9px] font-medium transition-colors ${
                                    isActive
                                      ? 'text-white'
                                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
                                  }`}
                                  style={isActive ? { background: 'var(--portal)' } : undefined}
                                  title={mt.name}
                                >
                                  {mt.name.slice(0, 4)}
                                </button>
                              )
                            })}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profile not found warning */}
      {!profile && (
        <div className="rounded-lg border border-[var(--warning)] bg-[rgba(245,158,11,0.05)] p-4 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--warning)]">Profile not found.</span>{' '}
          Your account ({user?.email}) does not have a matching record in the users collection yet.
        </div>
      )}
    </div>
  )
}
