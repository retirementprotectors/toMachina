'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

/* ─── Types ─── */

interface RecordingPlayerProps {
  recordingUrl: string
  /** Duration in seconds (from Twilio recording metadata) */
  duration?: number
}

/* ─── Helpers ─── */

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* ─── Component (CP09: loading state + error handling) ─── */

export function RecordingPlayer({ recordingUrl, duration }: RecordingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(duration ?? 0)
  const [error, setError] = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const onMetadata = () => {
      if (isFinite(el.duration)) setTotalDuration(el.duration)
      setLoading(false)
    }
    const onCanPlay = () => setLoading(false)
    const onTimeUpdate = () => setCurrentTime(el.currentTime)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    const onError = () => { setError(true); setPlaying(false); setLoading(false) }

    el.addEventListener('loadedmetadata', onMetadata)
    el.addEventListener('canplay', onCanPlay)
    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('ended', onEnded)
    el.addEventListener('error', onError)
    return () => {
      el.removeEventListener('loadedmetadata', onMetadata)
      el.removeEventListener('canplay', onCanPlay)
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('ended', onEnded)
      el.removeEventListener('error', onError)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setError(true))
    }
  }, [playing])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current
    if (!el) return
    const t = Number(e.target.value)
    el.currentTime = t
    setCurrentTime(t)
  }, [])

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0

  if (error) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>error_outline</span>
        Recording unavailable
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-[var(--bg-surface)] px-3 py-2">
      {/* Hidden native audio element */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={recordingUrl} preload="metadata" />

      {/* Play/Pause button (or loading spinner) */}
      {loading ? (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center">
          <span className="material-icons-outlined animate-spin text-[var(--text-muted)]" style={{ fontSize: '14px' }}>sync</span>
        </div>
      ) : (
        <button
          onClick={togglePlay}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:scale-105"
          style={{ background: 'var(--portal)' }}
          title={playing ? 'Pause' : 'Play recording'}
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
            {playing ? 'pause' : 'play_arrow'}
          </span>
        </button>
      )}

      {/* Progress bar */}
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={totalDuration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          disabled={loading}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border-subtle)] accent-[var(--portal)]"
          style={{
            background: `linear-gradient(to right, var(--portal) ${progress}%, var(--border-subtle) ${progress}%)`,
          }}
        />
      </div>

      {/* Time display */}
      <span className="shrink-0 font-mono text-[10px] text-[var(--text-muted)]">
        {formatDuration(currentTime)}{totalDuration > 0 ? ` / ${formatDuration(totalDuration)}` : ''}
      </span>
    </div>
  )
}
