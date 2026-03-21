'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchWithAuth } from './fetchWithAuth'

/**
 * ACF Config Admin — Admin tab for managing ACF configuration.
 * Reads/writes Firestore acf_config via API.
 */

interface ACFConfigAdminProps {
  portal: string
}

interface ACFRoutingRule {
  document_type: string
  target_subfolder: string
  patterns?: string[]
  file_label_template?: string
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
  routing_rules?: ACFRoutingRule[]
}

function driveUrl(id: string, type: 'folder' | 'file'): string {
  return type === 'folder'
    ? `https://drive.google.com/drive/folders/${id}`
    : `https://docs.google.com/spreadsheets/d/${id}/edit`
}

export function ACFConfigAdmin({ portal }: ACFConfigAdminProps) {
  const [config, setConfig] = useState<ACFConfigData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newSubfolder, setNewSubfolder] = useState('')
  const [saved, setSaved] = useState(false)
  const [newRuleType, setNewRuleType] = useState('')
  const [newRuleSubfolder, setNewRuleSubfolder] = useState('')
  const [newRulePatterns, setNewRulePatterns] = useState('')

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/acf/config')
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
      const res = await fetchWithAuth('/api/acf/config', {
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

  const addRoutingRule = () => {
    if (!config || !newRuleType.trim() || !newRuleSubfolder || !newRulePatterns.trim()) return
    const rule: ACFRoutingRule = {
      document_type: newRuleType.trim(),
      target_subfolder: newRuleSubfolder,
      patterns: newRulePatterns.split(',').map((p) => p.trim()).filter(Boolean),
    }
    setConfig({ ...config, routing_rules: [...(config.routing_rules || []), rule] })
    setNewRuleType('')
    setNewRuleSubfolder('')
    setNewRulePatterns('')
  }

  const removeRoutingRule = (index: number) => {
    if (!config) return
    const rules = [...(config.routing_rules || [])]
    rules.splice(index, 1)
    setConfig({ ...config, routing_rules: rules })
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

      {/* Template IDs — with hyperlinks */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Template Settings</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-1">
              Template Folder ID
              {config.template_folder_id && (
                <a
                  href={driveUrl(config.template_folder_id, 'folder')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[var(--portal)] hover:brightness-110"
                  title="Open in Google Drive"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                  Open
                </a>
              )}
            </label>
            <input
              type="text"
              value={config.template_folder_id}
              onChange={(e) => setConfig({ ...config, template_folder_id: e.target.value })}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-1">
              Ai3 Template ID
              {config.ai3_template_id && (
                <a
                  href={driveUrl(config.ai3_template_id, 'file')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[var(--portal)] hover:brightness-110"
                  title="Open Ai3 Template"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '12px' }}>open_in_new</span>
                  Open
                </a>
              )}
            </label>
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

      {/* Automation Toggles */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-4">
        <h4 className="text-sm font-medium text-[var(--text-secondary)]">Automation</h4>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm text-[var(--text-primary)]">Auto-create on import</span>
            <p className="text-xs text-[var(--text-muted)]">Automatically create ACF when a new client is imported</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.auto_create_on_import}
            onClick={() => setConfig({ ...config, auto_create_on_import: !config.auto_create_on_import })}
            className="shrink-0 flex items-center rounded-full p-0.5 transition-colors"
            style={{
              width: '44px',
              height: '24px',
              background: config.auto_create_on_import ? 'var(--portal)' : '#4b5563',
            }}
          >
            <span
              className="rounded-full bg-white shadow-sm transition-all duration-200"
              style={{
                width: '20px',
                height: '20px',
                marginLeft: config.auto_create_on_import ? '20px' : '0px',
              }}
            />
          </button>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-sm text-[var(--text-primary)]">Auto-route correspondence</span>
            <p className="text-xs text-[var(--text-muted)]">Automatically route new documents to ACF subfolders based on routing rules below</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.auto_route_correspondence}
            onClick={() => setConfig({ ...config, auto_route_correspondence: !config.auto_route_correspondence })}
            className="shrink-0 flex items-center rounded-full p-0.5 transition-colors"
            style={{
              width: '44px',
              height: '24px',
              background: config.auto_route_correspondence ? 'var(--portal)' : '#4b5563',
            }}
          >
            <span
              className="rounded-full bg-white shadow-sm transition-all duration-200"
              style={{
                width: '20px',
                height: '20px',
                marginLeft: config.auto_route_correspondence ? '20px' : '0px',
              }}
            />
          </button>
        </div>
      </div>

      {/* Routing Rules */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-[var(--text-secondary)]">Document Routing Rules</h4>
            <p className="text-xs text-[var(--text-muted)]">When auto-route is on, incoming documents matching these patterns get filed automatically</p>
          </div>
          <span className="text-xs text-[var(--text-muted)]">{(config.routing_rules || []).length} rules</span>
        </div>

        {(config.routing_rules || []).length > 0 && (
          <div className="space-y-1.5">
            {(config.routing_rules || []).map((rule, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2"
              >
                <span className="material-icons-outlined text-[var(--text-muted)] mt-0.5" style={{ fontSize: '16px' }}>route</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">{rule.document_type}</span>
                    <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>arrow_forward</span>
                    <span className="text-sm text-[var(--portal)]">{rule.target_subfolder}</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                    {(rule.patterns || []).join(', ') || rule.file_label_template || '—'}
                  </p>
                </div>
                <button
                  onClick={() => removeRoutingRule(i)}
                  className="shrink-0 text-red-400 hover:text-red-300 mt-0.5"
                >
                  <span className="material-icons-outlined" style={{ fontSize: '14px' }}>close</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new rule */}
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] p-3 space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">Add Routing Rule</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={newRuleType}
              onChange={(e) => setNewRuleType(e.target.value)}
              placeholder="Document type..."
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
            <select
              value={newRuleSubfolder}
              onChange={(e) => setNewRuleSubfolder(e.target.value)}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            >
              <option value="">Target subfolder...</option>
              {config.subfolders.map((sf) => (
                <option key={sf} value={sf}>{sf}</option>
              ))}
            </select>
            <input
              type="text"
              value={newRulePatterns}
              onChange={(e) => setNewRulePatterns(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRoutingRule()}
              placeholder="Patterns (comma-separated)..."
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
            />
          </div>
          <button
            onClick={addRoutingRule}
            disabled={!newRuleType.trim() || !newRuleSubfolder || !newRulePatterns.trim()}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
            style={{ background: 'var(--portal)' }}
          >
            Add Rule
          </button>
        </div>
      </div>
    </div>
  )
}
