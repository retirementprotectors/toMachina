'use client'

import { useState, useMemo, useCallback } from 'react'
import { query, where, orderBy, doc, updateDoc, type Query, type DocumentData } from 'firebase/firestore'
import { useAuth, buildEntitlementContext, canAccessModule } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { collections, getDb } from '@tomachina/db/src/firestore'
import type { User } from '@tomachina/core'

/* ─── Types ─── */

interface UserRecord extends User {
  _id: string
}

interface EmployeeProfile {
  meet_room?: {
    meet_link?: string
    room_name?: string
    description?: string
    folder_id?: string
    folder_url?: string
    team?: string
    status?: string
  }
  calendar_booking_types?: Array<{
    name: string
    duration_minutes: number
    category?: string
  }>
  drive_folder_url?: string
  booking_slug?: string
  profile_photo_url?: string
  roadmap_doc_id?: string
  team_folders?: Array<{ name: string; url: string }>
  drop_zone?: Record<string, unknown>
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Owner',
  1: 'Executive',
  2: 'Leader',
  3: 'User',
}

/* ─── Sub-components ─── */

function ProfileField({
  label,
  value,
  href,
}: {
  label: string
  value: string | undefined | null
  href?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </span>
      {href && value ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--portal)] underline"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm text-[var(--text-primary)]">{value || '\u2014'}</span>
      )}
    </div>
  )
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]"
      />
    </div>
  )
}

/* ─── Main Component ─── */

interface MyRpiProfileProps {
  portal: string
}

export function MyRpiProfile({ portal }: MyRpiProfileProps) {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [editFields, setEditFields] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    location: '',
    aliases: '',
  })
  const [saving, setSaving] = useState(false)

  // Build entitlement context for LEADER+ check
  const entitlementCtx = useMemo(() => buildEntitlementContext(user), [user])
  const isLeaderPlus = entitlementCtx.userLevel === 'OWNER' ||
    entitlementCtx.userLevel === 'EXECUTIVE' ||
    entitlementCtx.userLevel === 'LEADER'

  // Current profile email — either selected team member or self
  const profileEmail = selectedEmail || user?.email || ''

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

  // Edit handlers
  const startEdit = useCallback(() => {
    if (!profile) return
    setEditFields({
      first_name: profile.first_name || '',
      last_name: profile.last_name || '',
      phone: profile.phone || '',
      location: profile.location || '',
      aliases: (profile.aliases || []).join(', '),
    })
    setEditing(true)
  }, [profile])

  const cancelEdit = useCallback(() => {
    setEditing(false)
  }, [])

  const saveEdit = useCallback(async () => {
    if (!profile?._id) return
    setSaving(true)
    try {
      const ref = doc(getDb(), 'users', profile._id)
      const aliasArray = editFields.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean)
      await updateDoc(ref, {
        first_name: editFields.first_name,
        last_name: editFields.last_name,
        phone: editFields.phone,
        location: editFields.location,
        aliases: aliasArray,
        updated_at: new Date().toISOString(),
      })
      setEditing(false)
    } catch {
      // Toast would go here — for now the error state will show
    } finally {
      setSaving(false)
    }
  }, [profile, editFields])

  const isOwnProfile = !selectedEmail || selectedEmail === user?.email

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">MyRPI</h1>
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
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">MyRPI</h1>
        <div className="mt-6 rounded-xl border border-[var(--error)] bg-[rgba(239,68,68,0.05)] p-6 text-sm text-[var(--text-secondary)]">
          Failed to load profile: {error.message}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">MyRPI</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Your employee profile</p>
        </div>
        {isOwnProfile && !editing && profile && (
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span>
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Switcher (LEADER+ only) */}
      {isLeaderPlus && teamMembers.length > 0 && (
        <div className="mt-4">
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
        </div>
      )}

      {/* Profile Card */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        {/* Header Row */}
        <div className="flex items-center gap-4 border-b border-[var(--border-subtle)] pb-4">
          {user?.photoURL && isOwnProfile ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-16 w-16 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: 'var(--portal)' }}
            >
              {(profile?.first_name || user?.displayName || '?')[0].toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {profile?.first_name
                ? `${profile.first_name} ${profile.last_name}`
                : user?.displayName || 'Unknown'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {profile?.job_title || 'Team Member'}
              {profile?.division ? ` \u00B7 ${profile.division}` : ''}
            </p>
            {profile?.level !== undefined && (
              <span
                className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: 'var(--portal-glow)', color: 'var(--portal-accent)' }}
              >
                {LEVEL_LABELS[profile.level] || `Level ${profile.level}`}
              </span>
            )}
          </div>
        </div>

        {/* Edit Mode */}
        {editing ? (
          <div className="mt-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <EditableField
                label="First Name"
                value={editFields.first_name}
                onChange={(v) => setEditFields((p) => ({ ...p, first_name: v }))}
              />
              <EditableField
                label="Last Name"
                value={editFields.last_name}
                onChange={(v) => setEditFields((p) => ({ ...p, last_name: v }))}
              />
              <EditableField
                label="Phone"
                value={editFields.phone}
                onChange={(v) => setEditFields((p) => ({ ...p, phone: v }))}
              />
              <EditableField
                label="Location"
                value={editFields.location}
                onChange={(v) => setEditFields((p) => ({ ...p, location: v }))}
              />
              <div className="sm:col-span-2">
                <EditableField
                  label="Aliases (comma separated)"
                  value={editFields.aliases}
                  onChange={(v) => setEditFields((p) => ({ ...p, aliases: v }))}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
                style={{ background: 'var(--portal)' }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={cancelEdit}
                className="rounded-lg border border-[var(--border-subtle)] px-4 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Contact Details */}
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ProfileField label="Email" value={profile?.email || user?.email} />
              <ProfileField label="Phone" value={profile?.phone} />
              <ProfileField label="Personal Email" value={profile?.personal_email} />
              <ProfileField label="Location" value={profile?.location} />
              <ProfileField label="NPN" value={profile?.npn} />
              <ProfileField label="Hire Date" value={profile?.hire_date} />
            </div>

            {/* Team Info */}
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Team
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ProfileField label="Division" value={profile?.division} />
                <ProfileField label="Unit" value={profile?.unit} />
                <ProfileField label="Manager" value={profile?.manager_email} />
              </div>

              {/* Direct Reports (LEADER+ viewing) */}
              {isLeaderPlus && directReports.length > 0 && (
                <div className="mt-4">
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
                        <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                          person
                        </span>
                        {r.first_name} {r.last_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Aliases */}
            {profile?.aliases && profile.aliases.length > 0 && (
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Aliases
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {profile.aliases.map((alias, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[var(--bg-surface)] px-2.5 py-0.5 text-xs text-[var(--text-secondary)]"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Employee Profile (parsed JSON) */}
            {empProfile && (
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Workspace
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {empProfile.roadmap_doc_id && (
                    <ProfileField
                      label="Roadmap"
                      value="Open Roadmap"
                      href={`https://docs.google.com/document/d/${empProfile.roadmap_doc_id}`}
                    />
                  )}
                  {empProfile.drive_folder_url && (
                    <ProfileField
                      label="Drive Folder"
                      value="Open Folder"
                      href={empProfile.drive_folder_url}
                    />
                  )}
                  {empProfile.meet_room?.meet_link && (
                    <ProfileField
                      label="Meet Room"
                      value={empProfile.meet_room.room_name || 'Join Meeting'}
                      href={empProfile.meet_room.meet_link}
                    />
                  )}
                </div>

                {/* Team Folders */}
                {empProfile.team_folders && empProfile.team_folders.length > 0 && (
                  <div className="mt-4">
                    <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
                      Team Folders
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {empProfile.team_folders.map((f, i) => (
                        <a
                          key={i}
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--portal)]"
                        >
                          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>
                            folder
                          </span>
                          {f.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* MyDropZone Card */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '24px' }}>
            cloud_upload
          </span>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">MyDropZone</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Your single entry point into MACHINA. Record meetings, snap documents, and let the system
          handle the rest.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Record a Meeting */}
          <button
            className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-left transition-colors hover:bg-[var(--bg-hover)]"
            disabled
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: 'var(--portal-glow)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
                mic
              </span>
            </span>
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Record a Meeting</span>
              <p className="text-xs text-[var(--text-muted)]">Coming soon</p>
            </div>
          </button>

          {/* Upload Documents */}
          <button
            className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-left transition-colors hover:bg-[var(--bg-hover)]"
            disabled
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ background: 'var(--portal-glow)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '20px', color: 'var(--portal)' }}>
                upload_file
              </span>
            </span>
            <div>
              <span className="text-sm font-medium text-[var(--text-primary)]">Upload Documents</span>
              <p className="text-xs text-[var(--text-muted)]">Coming soon</p>
            </div>
          </button>
        </div>

        {/* Recent Captures (empty state) */}
        <div className="mt-4">
          <h4 className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Recent Captures
          </h4>
          <div className="mt-2 flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-8">
            <span className="material-icons-outlined text-3xl text-[var(--text-muted)]">
              inbox
            </span>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              No captures yet. Recordings and uploads will appear here.
            </p>
          </div>
        </div>
      </div>

      {/* Profile not found warning */}
      {!profile && (
        <div className="mt-4 rounded-lg border border-[var(--warning)] bg-[rgba(245,158,11,0.05)] p-4 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--warning)]">Profile not found.</span>{' '}
          Your account ({user?.email}) does not have a matching record in the users collection yet.
        </div>
      )}
    </div>
  )
}
