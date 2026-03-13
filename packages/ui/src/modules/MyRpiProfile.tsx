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
  aliases: string[] | string | undefined
  isOwnProfile: boolean
  profileId: string | undefined
}) {
  const aliases = Array.isArray(rawAliases) ? rawAliases : rawAliases ? [rawAliases] : []
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

  // Meeting types for calendar grid
  const meetingTypes = empProfile?.calendar_booking_types || []

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
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My RPI</h1>
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--portal)] border-t-transparent" />
        </div>
      </div>
    )
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My RPI</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load profile: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">My RPI</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Your employee profile</p>
      </div>

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
              .filter((m) => m.email !== user?.email)
              .map((m) => (
                <option key={m._id} value={m.email}>
                  {m.last_name}, {m.first_name} ({m.email})
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
            {profile?.aliases && profile.aliases.length > 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                Goes by: {profile.aliases[0]}
              </p>
            )}
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
        </div>

        {/* Empty state if no drop zone links */}
        {!empProfile?.meet_room?.meet_link && !empProfile?.meet_room?.folder_url && !bookingSlug && (
          <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-8">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">cloud_off</span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No Drop Zone links configured yet. Contact your admin to set up your Meet room and booking pages.
            </p>
          </div>
        )}
      </div>

      {/* ─── Section 5: Meeting Config ─── */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>event_available</span>
          Meeting Configuration
        </h3>

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
                <span className="rounded-full bg-[var(--portal-glow)] px-2.5 py-0.5 text-xs font-medium text-[var(--portal-accent)]">
                  {mt.duration_minutes} min
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-8">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">event_busy</span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No meeting types configured. Meeting types are defined at the RIIMO admin level.
            </p>
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
