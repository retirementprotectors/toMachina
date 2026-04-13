'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from '../fetchValidated'
import type { ConnectCalendarMeeting, ConnectMeetResult, ConnectMeetTranscript, ConnectMeetRecording } from '@tomachina/core'

/* ═══════════════════════════════════════════════════════════════════════════
   TKO-UX-004 — ConnectMeetTab
   Instant meet CTA + calendar meeting list + transcript/recording drawer.

   APIs wired:
     POST /api/connect/meet             → Start Instant Meet CTA
     GET  /api/connect/calendar         → Upcoming + today's meetings list
     GET  /api/connect/meet/:id/transcripts  → Transcript drawer (CONN-005 stub → empty)
     GET  /api/connect/meet/:id/recordings   → Recording drawer (CONN-005 stub → empty)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── Loading spinner ─────────────────────────────────────────────────────── */
function Spinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <span
        className="block h-5 w-5 animate-spin rounded-full border-2 border-[var(--border-subtle)] border-t-[var(--portal)]"
        aria-label="Loading"
      />
    </div>
  )
}

/* ─── Section label ───────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
      {children}
    </p>
  )
}

/* ─── Transcript / Recording drawer ──────────────────────────────────────── */

interface DrawerProps {
  meetingTitle: string
  meetSpaceName: string
  onClose: () => void
}

function MeetDrawer({ meetingTitle, meetSpaceName, onClose }: DrawerProps) {
  const [transcripts, setTranscripts] = useState<ConnectMeetTranscript[] | null>(null)
  const [recordings, setRecordings] = useState<ConnectMeetRecording[] | null>(null)
  const [loading, setLoading] = useState(true)

  /* Fetch both stub routes in parallel on mount */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [tRes, rRes] = await Promise.all([
        fetchValidated<{ transcripts: ConnectMeetTranscript[] }>(
          `/api/connect/meet/${encodeURIComponent(meetSpaceName)}/transcripts`,
        ),
        fetchValidated<{ recordings: ConnectMeetRecording[] }>(
          `/api/connect/meet/${encodeURIComponent(meetSpaceName)}/recordings`,
        ),
      ])
      if (cancelled) return
      setTranscripts(tRes.success && tRes.data ? tRes.data.transcripts : [])
      setRecordings(rRes.success && rRes.data ? rRes.data.recordings : [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetSpaceName])

  const hasContent =
    (transcripts && transcripts.length > 0) ||
    (recordings && recordings.length > 0)

  return (
    /* Inlined drawer — slides in below the meeting row it belongs to */
    <div className="mt-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--text-primary)]">{meetingTitle}</span>
        <button
          type="button"
          aria-label="Close transcript drawer"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          ✕
        </button>
      </div>

      {loading && <Spinner />}

      {!loading && !hasContent && (
        <div className="flex flex-col items-center gap-1 py-3 text-center">
          <span className="text-xl" aria-hidden="true">🎙️</span>
          <p className="text-xs font-medium text-[var(--text-secondary)]">Not available yet</p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Transcripts and recordings will appear here once Meet Activity API
            integration is complete.
          </p>
        </div>
      )}

      {!loading && transcripts && transcripts.length > 0 && (
        <div className="mb-2">
          <SectionLabel>Transcripts</SectionLabel>
          <div className="space-y-1">
            {transcripts.map((t) => (
              <div
                key={t.transcriptId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
              >
                <span className="text-[var(--text-muted)]">📄</span>
                <span className="flex-1 truncate">{t.name || t.transcriptId}</span>
                <span className="flex-shrink-0 text-[var(--text-muted)]">
                  {t.startTime ? new Date(t.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && recordings && recordings.length > 0 && (
        <div>
          <SectionLabel>Recordings</SectionLabel>
          <div className="space-y-1">
            {recordings.map((r) => (
              <div
                key={r.recordingId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-[var(--text-primary)]"
              >
                <span className="text-[var(--text-muted)]">🎬</span>
                <span className="flex-1 truncate">{r.name || r.recordingId}</span>
                {r.driveDestination?.exportUri && (
                  <a
                    href={r.driveDestination.exportUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-[var(--portal)] hover:underline"
                  >
                    Open
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Meeting row ─────────────────────────────────────────────────────────── */

interface MeetingRowProps {
  meeting: ConnectCalendarMeeting
  isToday: boolean
  openDrawerId: string | null
  onToggleDrawer: (key: string | null) => void
  rowKey: string
}

function MeetingRow({ meeting, isToday, openDrawerId, onToggleDrawer, rowKey }: MeetingRowProps) {
  const isOpen = openDrawerId === rowKey
  const isPast = !isToday

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2.5">
        {/* Time */}
        <span className="w-16 flex-shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">
          {meeting.timeLabel}
        </span>

        {/* Title + participants */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--text-primary)]">
            {meeting.title}
          </p>
          {meeting.participants.length > 0 && (
            <p className="truncate text-[10px] text-[var(--text-muted)]">
              {meeting.participants.join(', ')}
            </p>
          )}
        </div>

        {/* Action chip */}
        {isToday && meeting.joinable && meeting.meetLink ? (
          <a
            href={meeting.meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--portal)' }}
          >
            Join
          </a>
        ) : isPast ? (
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={() => onToggleDrawer(isOpen ? null : rowKey)}
            className="flex-shrink-0 rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-[10px] font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
          >
            {isOpen ? 'Hide' : 'View'}
          </button>
        ) : null}
      </div>

      {/* Transcript / recording drawer */}
      {isOpen && (
        <MeetDrawer
          meetingTitle={meeting.title}
          meetSpaceName={meeting.title.replace(/\s+/g, '-').toLowerCase()}
          onClose={() => onToggleDrawer(null)}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main component
   ═══════════════════════════════════════════════════════════════════════════ */

export function ConnectMeetTab() {
  /* State */
  const [meetings, setMeetings] = useState<ConnectCalendarMeeting[]>([])
  const [calError, setCalError] = useState<string | null>(null)
  const [calLoading, setCalLoading] = useState(true)
  const [instantLoading, setInstantLoading] = useState(false)
  const [openDrawerId, setOpenDrawerId] = useState<string | null>(null)

  /* Fetch calendar on mount */
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetchValidated<{ meetings: ConnectCalendarMeeting[]; recordings: unknown[] }>(
        '/api/connect/calendar',
      )
      if (cancelled) return
      if (res.success && res.data) {
        setMeetings(res.data.meetings ?? [])
      } else {
        setCalError(res.error ?? 'Could not load calendar')
      }
      setCalLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  /* Start Instant Meet */
  const handleInstantMeet = useCallback(async () => {
    setInstantLoading(true)
    try {
      const res = await fetchValidated<ConnectMeetResult>('/api/connect/meet', {
        method: 'POST',
        body: JSON.stringify({ title: 'Quick Meeting' }),
      })
      const link = res.success && res.data?.meetLink ? res.data.meetLink : 'https://meet.google.com/new'
      window.open(link, '_blank', 'noopener,noreferrer')
    } catch {
      window.open('https://meet.google.com/new', '_blank', 'noopener,noreferrer')
    } finally {
      setInstantLoading(false)
    }
  }, [])

  /* Split meetings into upcoming (today/future, joinable) and past */
  const upcoming = meetings.filter((m) => m.joinable)
  const past = meetings.filter((m) => !m.joinable)

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="space-y-4 p-3">

        {/* ── Instant Meet CTA ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
          <p className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">
            Need to talk right now?
          </p>
          <button
            type="button"
            onClick={handleInstantMeet}
            disabled={instantLoading}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: 'var(--portal)' }}
          >
            {instantLoading ? (
              <>
                <span
                  className="block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  aria-hidden="true"
                />
                Starting…
              </>
            ) : (
              <>
                <span aria-hidden="true">📹</span>
                Start Instant Meet
              </>
            )}
          </button>
        </div>

        {/* ── Calendar section ─────────────────────────────────────────── */}
        {calLoading && (
          <div>
            <SectionLabel>Today's Meetings</SectionLabel>
            <Spinner />
          </div>
        )}

        {!calLoading && calError && (
          <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-center">
            <p className="text-xs text-[var(--text-muted)]">{calError}</p>
          </div>
        )}

        {/* Upcoming / joinable meetings */}
        {!calLoading && !calError && (
          <div>
            <SectionLabel>Today's Meetings</SectionLabel>
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-5 text-center">
                <span className="text-2xl" aria-hidden="true">📅</span>
                <p className="text-xs font-medium text-[var(--text-secondary)]">No upcoming meetings</p>
                <p className="text-[10px] text-[var(--text-muted)]">Your calendar is clear for now</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {upcoming.map((m, i) => (
                  <MeetingRow
                    key={`upcoming-${i}`}
                    rowKey={`upcoming-${i}`}
                    meeting={m}
                    isToday
                    openDrawerId={openDrawerId}
                    onToggleDrawer={setOpenDrawerId}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past meetings */}
        {!calLoading && !calError && past.length > 0 && (
          <div>
            <SectionLabel>Recent</SectionLabel>
            <div className="space-y-1.5">
              {past.map((m, i) => (
                <MeetingRow
                  key={`past-${i}`}
                  rowKey={`past-${i}`}
                  meeting={m}
                  isToday={false}
                  openDrawerId={openDrawerId}
                  onToggleDrawer={setOpenDrawerId}
                />
              ))}
            </div>
          </div>
        )}

        {/* Transcripts / recordings note — always shown at bottom when no past meetings */}
        {!calLoading && !calError && past.length === 0 && (
          <div>
            <SectionLabel>Recent</SectionLabel>
            <div className="flex flex-col items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-4 text-center">
              <span className="text-xl" aria-hidden="true">🎙️</span>
              <p className="text-xs font-medium text-[var(--text-secondary)]">No recent meetings</p>
              <p className="text-[10px] text-[var(--text-muted)]">
                Past meetings with transcripts and recordings will appear here
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
