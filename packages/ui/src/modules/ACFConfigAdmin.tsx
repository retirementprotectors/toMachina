'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * ACF Config Admin — Admin tab for managing ACF configuration.
 * Reads/writes Firestore acf_config via API.
 */

interface ACFConfigAdminProps {
  portal: string
}

interface ACFConfigData {
  template_folder_id: string
  ai3_template_id: string
  subfolders: string[]
  share_domain: string
  naming_pattern: string
  auto_create_on_import: boolean
  auto_route_correspondence: boolean
  default_subfolder: string
}

export function ACFConfigAdmin({ portal }: ACFConfigAdminProps) {
  const [config, setConfig] = useState<ACFConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSubfolder, setNewSubfolder] = useState('')
  const [saved, setSaved] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/acf/config')
      const json = await res.json()
      if (json.success) setConfig(json.data)
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/acf/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (json.success) {
        setConfig(json.data)
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false)
    }
  }

  const addSubfolder = () => {
    if (!config || !newSubfolder.trim()) return
    if (config.subfolders.includes(newSubfolder.trim())) return
    setConfig({ ...config, subfolders: [...config.subfolders, newSubfolder.trim()] })
    setNewSubfolder('')
  }

  const removeSubfolder = (name: string) => {
    if (!config) return
    setConfig({ ...config, subfolders: config.subfolders.filter((s) => s !== name) })
  }

  const moveSubfolder = (index: number, direction: 'up' | 'down') => {
    if (!config) return
    const arr = [...config.subfolders]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= arr.length) return
    ;[arr[index], arr[newIndex]] = [arr[newIndex], arr[index]]
    setConfig({ ...config, subfolders: arr })
  }

  // Naming pattern preview
  const patternPreview = config
    ? config.naming_pattern
        .replace('{first_name}', 'John')
        .replace('{last_name}', 'Smith')
    : ''

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-[var(--bg-surface)]" />
        ))}
      </div>
    )
  }

  if (!config) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
        <span className="material-icons-outlined text-4xl text-[var(--text-muted)]">settings</span>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          ACF config not found. Run the populate-acf-config script first.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--text-primary)]">ACF Configuration</h3>
          <p className="text-xs text-[var(--text-muted)]">Manage Active Client File template settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
          style={{ background: 'var(--portal)' }}
        >
          <span className="material-icons-outlined" style={{ fontSize: '16px' }}>
            {saved ? 'check' : 'save'}
          </span>
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Config'}
        </button>
      </div>

      {/* Template IDs */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Template Settings</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Template Folder ID</label>
            <input
              type="text"
              value={config.template_folder_id}
              onChange={(e) => setConfig({ ...config, template_folder_id: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Ai3 Template ID</label>
            <input
              type="text"
              value={config.ai3_template_id}
              onChange={(e) => setConfig({ ...config, ai3_template_id: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Share Domain</label>
            <input
              type="text"
              value={config.share_domain}
              onChange={(e) => setConfig({ ...config, share_domain: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Naming Pattern
              {patternPreview && (
                <span className="ml-2 font-normal text-[var(--text-muted)]">Preview: {patternPreview}</span>
              )}
            </label>
            <input
              type="text"
              value={config.naming_pattern}
              onChange={(e) => setConfig({ ...config, naming_pattern: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
              placeholder="ACF - {first_name} {last_name}"
            />
          </div>
        </div>
      </div>

      {/* Subfolder List */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-[var(--text-secondary)]">Subfolders</h4>
          <span className="text-xs text-[var(--text-muted)]">{config.subfolders.length} configured</span>
        </div>
        <div className="space-y-1.5">
          {config.subfolders.map((sf, i) => (
            <div
              key={sf}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2"
            >
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>folder</span>
              <span className="flex-1 text-sm text-[var(--text-primary)]">{sf}</span>
              {config.default_subfolder === sf && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: 'var(--portal)' }}>
                  default
                </span>
              )}
              <button
                onClick={() => moveSubfolder(i, 'up')}
                disabled={i === 0}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_upward</span>
              </button>
              <button
                onClick={() => moveSubfolder(i, 'down')}
                disabled={i === config.subfolders.length - 1}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>arrow_downward</span>
              </button>
              <button
                onClick={() => removeSubfolder(sf)}
                className="text-red-400 hover:text-red-300"
              >
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newSubfolder}
            onChange={(e) => setNewSubfolder(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSubfolder()}
            placeholder="New subfolder name..."
            className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
          />
          <button
            onClick={addSubfolder}
            disabled={!newSubfolder.trim()}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
            style={{ background: 'var(--portal)' }}
          >
            Add
          </button>
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Default Subfolder</label>
          <select
            value={config.default_subfolder}
            onChange={(e) => setConfig({ ...config, default_subfolder: e.target.value })}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
          >
            {config.subfolders.map((sf) => (
              <option key={sf} value={sf}>{sf}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Automation</h4>
        <div className="space-y-3">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-[var(--text-primary)]">Auto-create on import</span>
              <p className="text-xs text-[var(--text-muted)]">Automatically create ACF when a new client is imported</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, auto_create_on_import: !config.auto_create_on_import })}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                config.auto_create_on_import ? '' : 'bg-[var(--bg-surface)]'
              }`}
              style={config.auto_create_on_import ? { background: 'var(--portal)' } : undefined}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  config.auto_create_on_import ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="text-sm text-[var(--text-primary)]">Auto-route correspondence</span>
              <p className="text-xs text-[var(--text-muted)]">Automatically route new documents to existing ACF subfolders</p>
            </div>
            <button
              onClick={() => setConfig({ ...config, auto_route_correspondence: !config.auto_route_correspondence })}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                config.auto_route_correspondence ? '' : 'bg-[var(--bg-surface)]'
              }`}
              style={config.auto_route_correspondence ? { background: 'var(--portal)' } : undefined}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  config.auto_route_correspondence ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>
      </div>
    </div>
  )
}
