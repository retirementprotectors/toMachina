'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BookingTypeWindow {
  day: number
  start: string
  end: string
}

export interface BookingTypeConfig {
  name: string
  duration_minutes: number
  buffer_minutes: number
  modes: string[]
  windows: BookingTypeWindow[]
  color?: string
}

export interface BookingAvailabilityConfig {
  timezone: string
  business_hours: Record<number, { start: string; end: string } | null>
  max_advance_days: number
  slot_increment_minutes: number
}

interface BookingConfigProps {
  meetingTypes: BookingTypeConfig[]
  availability: BookingAvailabilityConfig
  bookingSlug?: string
  isOwnProfile: boolean
  onSaveMeetingTypes: (types: BookingTypeConfig[]) => Promise<void>
  onSaveAvailability: (avail: BookingAvailabilityConfig) => Promise<void>
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MODE_CONFIG: Record<string, { icon: string; label: string }> = {
  meet: { icon: 'videocam', label: 'Video' },
  call: { icon: 'phone', label: 'Phone' },
  office: { icon: 'business', label: 'In-Office' },
  home: { icon: 'home', label: 'At Home' },
}
const TYPE_COLORS = ['#4a7ab5', '#10b981', '#f59e0b', '#a78bfa', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120]
const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const h = Math.floor(i / 2) + 7
  const m = (i % 2) * 30
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
})

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BookingConfig({ meetingTypes: initialTypes, availability: initialAvail, bookingSlug, isOwnProfile, onSaveMeetingTypes, onSaveAvailability }: BookingConfigProps) {
  const [types, setTypes] = useState<BookingTypeConfig[]>(initialTypes.map((t, i) => ({ ...t, color: t.color || TYPE_COLORS[i % TYPE_COLORS.length] })))
  const [avail, setAvail] = useState<BookingAvailabilityConfig>(initialAvail)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sync internal state when parent passes new props (Firestore snapshot updates)
  useEffect(() => {
    setTypes(initialTypes.map((t, i) => ({ ...t, color: t.color || TYPE_COLORS[i % TYPE_COLORS.length] })))
  }, [initialTypes])

  useEffect(() => {
    setAvail(initialAvail)
  }, [initialAvail])

  const emptyForm: BookingTypeConfig = { name: '', duration_minutes: 30, buffer_minutes: 15, modes: ['meet', 'call'], windows: [], color: TYPE_COLORS[types.length % TYPE_COLORS.length] }
  const [form, setForm] = useState<BookingTypeConfig>(emptyForm)

  const saveAll = useCallback(async () => {
    setSaving(true)
    try { await onSaveMeetingTypes(types); await onSaveAvailability(avail); setSaved(true); setTimeout(() => setSaved(false), 2000) } catch { /* */ }
    setSaving(false)
  }, [types, avail, onSaveMeetingTypes, onSaveAvailability])

  const startEdit = (idx: number) => { setForm({ ...types[idx] }); setEditingIdx(idx); setAddingNew(false) }
  const startAdd = () => { setForm({ ...emptyForm, color: TYPE_COLORS[types.length % TYPE_COLORS.length] }); setEditingIdx(null); setAddingNew(true) }
  const cancelEdit = () => { setEditingIdx(null); setAddingNew(false) }

  const saveType = async () => {
    if (!form.name.trim()) return
    const updated = editingIdx !== null ? types.map((t, i) => i === editingIdx ? { ...form } : t) : [...types, { ...form }]
    setTypes(updated); setEditingIdx(null); setAddingNew(false)
    setSaving(true); await onSaveMeetingTypes(updated); setSaving(false)
  }

  const removeType = async (idx: number) => {
    const updated = types.filter((_, i) => i !== idx)
    setTypes(updated); setSaving(true); await onSaveMeetingTypes(updated); setSaving(false)
  }

  const addWindow = () => setForm(f => ({ ...f, windows: [...f.windows, { day: 1, start: '09:00', end: '12:00' }] }))
  const updateWindow = (wIdx: number, field: keyof BookingTypeWindow, value: number | string) => setForm(f => ({ ...f, windows: f.windows.map((w, i) => i === wIdx ? { ...w, [field]: value } : w) }))
  const removeWindow = (wIdx: number) => setForm(f => ({ ...f, windows: f.windows.filter((_, i) => i !== wIdx) }))
  const toggleMode = (mode: string) => setForm(f => ({ ...f, modes: f.modes.includes(mode) ? f.modes.filter(m => m !== mode) : [...f.modes, mode] }))

  // Visual schedule data
  const scheduleDays = useMemo(() => [1, 2, 3, 4, 5, 6, 0].filter(d => avail.business_hours[d]), [avail.business_hours])
  const scheduleRange = useMemo(() => {
    let earliest = 540, latest = 1020
    for (const d of scheduleDays) { const h = avail.business_hours[d]; if (h) { earliest = Math.min(earliest, timeToMinutes(h.start)); latest = Math.max(latest, timeToMinutes(h.end)) } }
    return { start: earliest, end: latest, span: Math.max(1, latest - earliest) }
  }, [avail.business_hours, scheduleDays])

  const isEditing = editingIdx !== null || addingNew

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>event_available</span>
          Booking Configuration
        </h3>
        <div className="flex items-center gap-2">
          {bookingSlug && <a href={`/book/${bookingSlug}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--portal)] transition-colors hover:bg-[var(--portal-glow)]"><span className="material-icons-outlined" style={{ fontSize: '14px' }}>open_in_new</span>Preview</a>}
          {isOwnProfile && <button onClick={() => void saveAll()} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-50" style={{ background: 'var(--portal)' }}>{saving ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : saved ? <span className="material-icons-outlined" style={{ fontSize: '13px' }}>check</span> : <span className="material-icons-outlined" style={{ fontSize: '13px' }}>save</span>}{saving ? 'Saving...' : saved ? 'Saved' : 'Save All'}</button>}
        </div>
      </div>

      {/* Visual Weekly Schedule */}
      {types.length > 0 && scheduleDays.length > 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Weekly Schedule</h4>
          <div className="mb-4 flex flex-wrap gap-3">
            {types.map((t, i) => <div key={i} className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm" style={{ background: t.color || TYPE_COLORS[i % TYPE_COLORS.length] }} /><span className="text-xs text-[var(--text-muted)]">{t.name}</span></div>)}
          </div>
          <div className="space-y-1.5">
            {scheduleDays.map(dayNum => {
              const bh = avail.business_hours[dayNum]; if (!bh) return null
              const bhStart = timeToMinutes(bh.start), bhEnd = timeToMinutes(bh.end)
              return (
                <div key={dayNum} className="flex items-center gap-3">
                  <span className="w-8 text-xs font-medium text-[var(--text-muted)]">{DAY_LABELS[dayNum]}</span>
                  <div className="relative flex-1 h-8 rounded-md overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                    <div className="absolute inset-y-0 rounded-md" style={{ left: `${((bhStart - scheduleRange.start) / scheduleRange.span) * 100}%`, width: `${((bhEnd - bhStart) / scheduleRange.span) * 100}%`, background: 'rgba(148,163,184,0.08)', borderLeft: '1px solid rgba(148,163,184,0.15)', borderRight: '1px solid rgba(148,163,184,0.15)' }} />
                    {types.map((t, tIdx) => {
                      // If no explicit windows, fill entire business hours for this day
                      const effectiveWindows = t.windows.length > 0
                        ? t.windows.filter(w => w.day === dayNum)
                        : (bh ? [{ day: dayNum, start: bh.start, end: bh.end }] : [])
                      return effectiveWindows.map((w, wIdx) => {
                        const wS = timeToMinutes(w.start), wE = timeToMinutes(w.end)
                        return <div key={`${tIdx}-${wIdx}`} className="absolute inset-y-1 rounded" style={{ left: `${((wS - scheduleRange.start) / scheduleRange.span) * 100}%`, width: `${((wE - wS) / scheduleRange.span) * 100}%`, background: t.color || TYPE_COLORS[tIdx % TYPE_COLORS.length], opacity: 0.7 }}><span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white truncate px-1">{t.name}</span></div>
                      })
                    })}
                    <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none"><span className="text-[9px] text-[var(--text-muted)]">{formatTime(bh.start)}</span><span className="text-[9px] text-[var(--text-muted)]">{formatTime(bh.end)}</span></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Meeting Types List */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Meeting Types</h4>
          {isOwnProfile && !isEditing && <button onClick={startAdd} className="flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium text-white" style={{ background: 'var(--portal)' }}><span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Type</button>}
        </div>
        {types.length === 0 && !addingNew && <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] py-8"><span className="material-icons-outlined text-2xl text-[var(--text-muted)]">event_busy</span><p className="mt-2 text-sm text-[var(--text-muted)]">No meeting types configured.{isOwnProfile ? ' Add one to get started.' : ''}</p></div>}
        <div className="space-y-2">
          {types.map((t, i) => {
            if (editingIdx === i) return <TypeForm key={i} form={form} setForm={setForm} onSave={() => void saveType()} onCancel={cancelEdit} addWindow={addWindow} updateWindow={updateWindow} removeWindow={removeWindow} toggleMode={toggleMode} isNew={false} />
            return (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--bg-surface)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-1.5 rounded-full" style={{ background: t.color || TYPE_COLORS[i % TYPE_COLORS.length] }} />
                  <div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{t.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-[var(--text-muted)]">{t.duration_minutes} min</span>
                      <span className="text-xs text-[var(--text-muted)]">|</span>
                      <span className="text-xs text-[var(--text-muted)]">{t.buffer_minutes}m buffer</span>
                      <span className="text-xs text-[var(--text-muted)]">|</span>
                      {(t.modes || []).map(mode => <span key={mode} className="material-icons-outlined" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{MODE_CONFIG[mode]?.icon || 'event'}</span>)}
                      {t.windows.length > 0 && <><span className="text-xs text-[var(--text-muted)]">|</span><span className="text-xs text-[var(--text-muted)]">{t.windows.length} window{t.windows.length !== 1 ? 's' : ''}</span></>}
                    </div>
                  </div>
                </div>
                {isOwnProfile && !isEditing && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => startEdit(i)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--portal-glow)] hover:text-[var(--portal)]"><span className="material-icons-outlined" style={{ fontSize: '16px' }}>edit</span></button>
                    <button onClick={() => void removeType(i)} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--error)]"><span className="material-icons-outlined" style={{ fontSize: '16px' }}>close</span></button>
                  </div>
                )}
              </div>
            )
          })}
          {addingNew && <TypeForm form={form} setForm={setForm} onSave={() => void saveType()} onCancel={cancelEdit} addWindow={addWindow} updateWindow={updateWindow} removeWindow={removeWindow} toggleMode={toggleMode} isNew={true} />}
        </div>
      </div>

      {/* Business Hours */}
      {isOwnProfile && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Business Hours</h4>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map(day => {
              const hours = avail.business_hours[day]; const isOn = hours !== null && hours !== undefined
              return (
                <div key={day} className="flex items-center gap-3 rounded-lg bg-[var(--bg-surface)] px-4 py-2.5">
                  <button onClick={() => setAvail(prev => ({ ...prev, business_hours: { ...prev.business_hours, [day]: isOn ? null : { start: '09:00', end: '17:00' } } }))} className={`flex h-5 w-5 items-center justify-center rounded ${isOn ? 'text-white' : 'border border-[var(--border-subtle)]'}`} style={isOn ? { background: 'var(--portal)' } : undefined}>{isOn && <span className="material-icons-outlined" style={{ fontSize: '14px' }}>check</span>}</button>
                  <span className={`w-24 text-sm ${isOn ? 'font-medium text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}`}>{DAY_FULL[day]}</span>
                  {isOn && hours ? (
                    <div className="flex items-center gap-2">
                      <select value={hours.start} onChange={(e) => setAvail(prev => ({ ...prev, business_hours: { ...prev.business_hours, [day]: { ...hours, start: e.target.value } } }))} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none">{TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}</select>
                      <span className="text-xs text-[var(--text-muted)]">to</span>
                      <select value={hours.end} onChange={(e) => setAvail(prev => ({ ...prev, business_hours: { ...prev.business_hours, [day]: { ...hours, end: e.target.value } } }))} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none">{TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}</select>
                    </div>
                  ) : <span className="text-xs text-[var(--text-muted)]">Closed</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Settings */}
      {isOwnProfile && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Settings</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1"><label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Max Advance Booking</label><select value={avail.max_advance_days} onChange={(e) => setAvail(prev => ({ ...prev, max_advance_days: parseInt(e.target.value) }))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none"><option value={14}>2 weeks</option><option value={30}>30 days</option><option value={60}>60 days</option><option value={90}>90 days</option></select></div>
            <div className="flex flex-col gap-1"><label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Slot Increments</label><select value={avail.slot_increment_minutes} onChange={(e) => setAvail(prev => ({ ...prev, slot_increment_minutes: parseInt(e.target.value) }))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none"><option value={15}>Every 15 min</option><option value={30}>Every 30 min</option><option value={60}>Every 60 min</option></select></div>
            <div className="flex flex-col gap-1"><label className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">Timezone</label><select value={avail.timezone} onChange={(e) => setAvail(prev => ({ ...prev, timezone: e.target.value }))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none"><option value="America/Chicago">Central (Chicago)</option><option value="America/New_York">Eastern (New York)</option><option value="America/Denver">Mountain (Denver)</option><option value="America/Los_Angeles">Pacific (Los Angeles)</option></select></div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Type Edit Form ───────────────────────────────────────────────────────────

function TypeForm({ form, setForm, onSave, onCancel, addWindow, updateWindow, removeWindow, toggleMode, isNew }: {
  form: BookingTypeConfig; setForm: (fn: (f: BookingTypeConfig) => BookingTypeConfig) => void
  onSave: () => void; onCancel: () => void; addWindow: () => void
  updateWindow: (idx: number, field: keyof BookingTypeWindow, value: number | string) => void
  removeWindow: (idx: number) => void; toggleMode: (mode: string) => void; isNew: boolean
}) {
  return (
    <div className="rounded-lg border-2 border-[var(--portal)] bg-[var(--bg-surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h5 className="text-sm font-semibold text-[var(--text-primary)]">{isNew ? 'New Meeting Type' : 'Edit Meeting Type'}</h5>
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="rounded-md px-3 py-1 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
          <button onClick={onSave} disabled={!form.name.trim()} className="rounded-md px-3 py-1 text-xs font-medium text-white disabled:opacity-40" style={{ background: 'var(--portal)' }}>{isNew ? 'Add' : 'Save'}</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1"><label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Name</label><input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Discovery Call" className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--portal)]" /></div>
        <div className="flex flex-col gap-1"><label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Duration</label><select value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) }))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none">{DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}</select></div>
        <div className="flex flex-col gap-1"><label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Buffer After</label><select value={form.buffer_minutes} onChange={(e) => setForm(f => ({ ...f, buffer_minutes: parseInt(e.target.value) }))} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] outline-none"><option value={0}>None</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option></select></div>
      </div>

      <div className="mb-4"><label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Meeting Modes</label><div className="flex flex-wrap gap-2">{Object.entries(MODE_CONFIG).map(([id, cfg]) => <button key={id} onClick={() => toggleMode(id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${form.modes.includes(id) ? 'text-white' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]'}`} style={form.modes.includes(id) ? { background: 'var(--portal)' } : undefined}><span className="material-icons-outlined" style={{ fontSize: '14px' }}>{cfg.icon}</span>{cfg.label}</button>)}</div></div>

      <div>
        <div className="mb-2 flex items-center justify-between"><label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Availability Windows</label><button onClick={addWindow} className="flex items-center gap-1 text-xs font-medium text-[var(--portal)] hover:underline"><span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span> Add Window</button></div>
        {form.windows.length === 0 ? <p className="text-xs text-[var(--text-muted)] italic">No specific windows — available during all business hours.</p> : (
          <div className="space-y-2">{form.windows.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md bg-[var(--bg-card)] px-3 py-2">
              <select value={w.day} onChange={(e) => updateWindow(i, 'day', parseInt(e.target.value))} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none">{DAY_FULL.map((d, di) => <option key={di} value={di}>{d}</option>)}</select>
              <select value={w.start} onChange={(e) => updateWindow(i, 'start', e.target.value)} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none">{TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}</select>
              <span className="text-xs text-[var(--text-muted)]">to</span>
              <select value={w.end} onChange={(e) => updateWindow(i, 'end', e.target.value)} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] outline-none">{TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}</select>
              <button onClick={() => removeWindow(i)} className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--error)]"><span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span></button>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  )
}
