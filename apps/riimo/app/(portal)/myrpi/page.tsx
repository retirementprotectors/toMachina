'use client'

import { useMemo } from 'react'
import { query, where, type Query, type DocumentData } from 'firebase/firestore'
import { useAuth } from '@tomachina/auth'
import { useCollection } from '@tomachina/db'
import { collections } from '@tomachina/db/src/firestore'

interface UserRecord {
  _id: string
  email?: string
  first_name?: string
  last_name?: string
  full_name?: string
  user_level?: number
  unit?: string
  division?: string
  job_title?: string
  phone?: string
  slack_id?: string
  location?: string
  npn?: string
  hire_date?: string
  manager_email?: string
  employee_profile?: Record<string, unknown>
  aliases?: string[]
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Owner',
  1: 'Executive',
  2: 'Leader',
  3: 'User',
}

function ProfileField({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">{label}</span>
      <span className="text-sm text-[var(--text-primary)]">{value || '\u2014'}</span>
    </div>
  )
}

export default function MyRPIPage() {
  const { user } = useAuth()

  const userQuery: Query<DocumentData> | null = useMemo(() => {
    if (!user?.email) return null
    return query(collections.users(), where('email', '==', user.email))
  }, [user?.email])

  const { data: userRecords, loading, error } = useCollection<UserRecord>(userQuery, `myrpi-${user?.email || 'none'}`)
  const profile = userRecords.length > 0 ? userRecords[0] : null

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
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">MyRPI</h1>
      <p className="mt-1 text-sm text-[var(--text-muted)]">Your employee profile</p>

      {/* Profile Card */}
      <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        {/* Header */}
        <div className="flex items-center gap-4 pb-4 border-b border-[var(--border-subtle)]">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="h-16 w-16 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white"
              style={{ background: 'var(--portal)' }}
            >
              {(user?.displayName || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">
              {profile?.full_name || profile?.first_name ? `${profile.first_name} ${profile.last_name}` : user?.displayName || 'Unknown'}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {profile?.job_title || 'Team Member'} {profile?.division ? `\u00B7 ${profile.division}` : ''}
            </p>
            {profile?.user_level !== undefined && (
              <span
                className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ background: 'var(--portal-glow)', color: 'var(--portal-accent)' }}
              >
                {LEVEL_LABELS[profile.user_level] || `Level ${profile.user_level}`}
              </span>
            )}
          </div>
        </div>

        {/* Profile Fields */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField label="Email" value={profile?.email || user?.email} />
          <ProfileField label="Phone" value={profile?.phone} />
          <ProfileField label="Location" value={profile?.location} />
          <ProfileField label="Unit" value={profile?.unit} />
          <ProfileField label="Division" value={profile?.division} />
          <ProfileField label="Manager" value={profile?.manager_email} />
          <ProfileField label="NPN" value={profile?.npn} />
          <ProfileField label="Hire Date" value={profile?.hire_date} />
          <ProfileField label="Slack ID" value={profile?.slack_id} />
        </div>

        {/* Aliases */}
        {profile?.aliases && profile.aliases.length > 0 && (
          <div className="mt-6">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Aliases</span>
            <div className="mt-1 flex flex-wrap gap-1.5">
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
      </div>

      {!profile && (
        <div className="mt-4 rounded-lg border border-[var(--warning)] bg-[rgba(245,158,11,0.05)] p-4 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--warning)]">Profile not found.</span>{' '}
          Your account ({user?.email}) does not have a matching record in the users collection yet.
        </div>
      )}
    </div>
  )
}
