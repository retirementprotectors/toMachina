'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchValidated } from './fetchValidated'

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
  pipeline?: string
  owner_role?: string
  active?: boolean
}

const PIPELINES = ['REACTIVE', 'PRO', 'NewBiz']
const ROLES = ['COR', 'AST', 'SPC']

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
  const [newRulePipeline, setNewRulePipeline] = useState('')
  const [newRuleOwner, setNewRuleOwner] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [ruleFilter, setRuleFilter] = useState({ subfolder: '', pipeline: '', status: '' })
  const [showAddRule, setShowAddRule] = useState(false)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchValidated<ACFConfigData>('/api/acf/config')
      if (res.success) setConfig(res.data ?? null)
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
      const res = await fetchValidated<ACFConfigData>('/api/acf/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
            if (res.success) {
        setConfig(res.data ?? null)
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
      pipeline: newRulePipeline || 'REACTIVE',
      owner_role: newRuleOwner || 'AST',
      active: true,
    }
    setConfig({ ...config, routing_rules: [...(config.routing_rules || []), rule] })
    setNewRuleType('')
    setNewRuleSubfolder('')
    setNewRulePatterns('')
    setNewRulePipeline('')
    setNewRuleOwner('')
  }

  const removeRoutingRule = (index: number) => {
    if (!config) return
    const rules = [...(config.routing_rules || [])]
    rules.splice(index, 1)
    setConfig({ ...config, routing_rules: rules })
  }

  const updateRoutingRule = (index: number, field: keyof ACFRoutingRule, value: unknown) => {
    if (!config) return
    const rules = [...(config.routing_rules || [])]
    rules[index] = { ...rules[index], [field]: value }
    setConfig({ ...config, routing_rules: rules })
  }

  const startEditing = (index: number) => {
    setEditingIndex(editingIndex === index ? null : index)
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">{(config.routing_rules || []).length} rules</span>
            <button
              onClick={() => setShowAddRule(!showAddRule)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110"
              style={{ background: 'var(--portal)' }}
            >
              <span className="material-icons-outlined" style={{ fontSize: '14px' }}>{showAddRule ? 'close' : 'add'}</span>
              {showAddRule ? 'Cancel' : 'Add Rule'}
            </button>
          </div>
        </div>

        {/* Add new rule — TOP position */}
        {showAddRule && (
          <div className="rounded-lg border-2 border-dashed p-3 space-y-2" style={{ borderColor: 'var(--portal)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Document Type</label>
                <input type="text" value={newRuleType} onChange={(e) => setNewRuleType(e.target.value)} placeholder="e.g., 1035 Exchange, Correspondence..."
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" autoFocus />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Target Subfolder</label>
                <select value={newRuleSubfolder} onChange={(e) => setNewRuleSubfolder(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                  <option value="">Select subfolder...</option>
                  {config.subfolders.map((sf) => <option key={sf} value={sf}>{sf}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">File Patterns (comma-separated)</label>
              <input type="text" value={newRulePatterns} onChange={(e) => setNewRulePatterns(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addRoutingRule()} placeholder="e.g., 1035*, exchange*, transfer*"
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Pipeline</label>
                <select value={newRulePipeline} onChange={(e) => setNewRulePipeline(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                  <option value="">None</option>
                  {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Owner Role</label>
                <select value={newRuleOwner} onChange={(e) => setNewRuleOwner(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                  <option value="">None</option>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-end pb-0.5">
                <button onClick={() => { addRoutingRule(); setShowAddRule(false) }}
                  disabled={!newRuleType.trim() || !newRuleSubfolder || !newRulePatterns.trim()}
                  className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'var(--portal)' }}>
                  Add Rule
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Smart Filters */}
        {(config.routing_rules || []).length > 3 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide font-medium">Filter:</span>
            <select value={ruleFilter.subfolder} onChange={(e) => setRuleFilter(f => ({ ...f, subfolder: e.target.value }))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:border-[var(--portal)] focus:outline-none">
              <option value="">All Subfolders</option>
              {config.subfolders.map(sf => <option key={sf} value={sf}>{sf}</option>)}
            </select>
            <select value={ruleFilter.pipeline} onChange={(e) => setRuleFilter(f => ({ ...f, pipeline: e.target.value }))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:border-[var(--portal)] focus:outline-none">
              <option value="">All Pipelines</option>
              {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={ruleFilter.status} onChange={(e) => setRuleFilter(f => ({ ...f, status: e.target.value }))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:border-[var(--portal)] focus:outline-none">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            {(ruleFilter.subfolder || ruleFilter.pipeline || ruleFilter.status) && (
              <button onClick={() => setRuleFilter({ subfolder: '', pipeline: '', status: '' })} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--portal)] transition-colors">Clear</button>
            )}
          </div>
        )}

        {/* Rules list */}
        {(config.routing_rules || []).length > 0 && (
          <div className="space-y-1.5">
            {(config.routing_rules || []).map((rule, i) => {
              // Apply filters
              if (ruleFilter.subfolder && rule.target_subfolder !== ruleFilter.subfolder) return null
              if (ruleFilter.pipeline && (rule.pipeline || '') !== ruleFilter.pipeline) return null
              if (ruleFilter.status === 'active' && rule.active === false) return null
              if (ruleFilter.status === 'disabled' && rule.active !== false) return null
              return (
              <div
                key={i}
                className={`rounded-lg border bg-[var(--bg-surface)] transition-colors ${
                  editingIndex === i ? 'border-[var(--portal)]' : 'border-[var(--border-subtle)]'
                }`}
              >
                {/* Summary row */}
                <div className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[var(--bg-card)] transition-colors" onClick={() => startEditing(i)}>
                  <span className={`material-icons-outlined ${rule.active === false ? 'text-red-400' : 'text-emerald-500'}`} style={{ fontSize: '14px' }}>
                    {rule.active === false ? 'radio_button_unchecked' : 'check_circle'}
                  </span>
                  <span className="text-sm font-medium text-[var(--text-primary)] min-w-[140px]">{rule.document_type}</span>
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>arrow_forward</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                    rule.target_subfolder === 'Client' ? 'bg-blue-500/10 text-blue-400' :
                    rule.target_subfolder === 'Cases' ? 'bg-purple-500/10 text-purple-400' :
                    rule.target_subfolder === 'NewBiz' ? 'bg-emerald-500/10 text-emerald-400' :
                    rule.target_subfolder === 'Account' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>{rule.target_subfolder}</span>
                  {(rule.patterns || []).length > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)] font-mono hidden md:inline">{(rule.patterns || []).slice(0, 2).join(', ')}{(rule.patterns || []).length > 2 ? ` +${(rule.patterns || []).length - 2}` : ''}</span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    {rule.pipeline && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-muted)]">{rule.pipeline}</span>}
                    {rule.owner_role && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-card)] text-[var(--text-muted)]">{rule.owner_role}</span>}
                  </div>
                  <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '14px' }}>
                    {editingIndex === i ? 'expand_less' : 'expand_more'}
                  </span>
                </div>

                {/* Inline edit panel */}
                {editingIndex === i && (
                  <div className="border-t border-[var(--border-subtle)] px-3 py-3 space-y-2 bg-[var(--bg-base)]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Document Type</label>
                        <input type="text" value={rule.document_type} onChange={(e) => updateRoutingRule(i, 'document_type', e.target.value)}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Target Subfolder</label>
                        <select value={rule.target_subfolder} onChange={(e) => updateRoutingRule(i, 'target_subfolder', e.target.value)}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                          {config.subfolders.map((sf) => <option key={sf} value={sf}>{sf}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">File Patterns (comma-separated)</label>
                      <input type="text" value={(rule.patterns || []).join(', ')} onChange={(e) => updateRoutingRule(i, 'patterns', e.target.value.split(',').map(p => p.trim()).filter(Boolean))}
                        className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Pipeline</label>
                        <select value={rule.pipeline || ''} onChange={(e) => updateRoutingRule(i, 'pipeline', e.target.value)}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                          <option value="">None</option>
                          {PIPELINES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Owner Role</label>
                        <select value={rule.owner_role || ''} onChange={(e) => updateRoutingRule(i, 'owner_role', e.target.value)}
                          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                          <option value="">None</option>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                      <div className="flex items-end gap-2 pb-1">
                        <button onClick={() => updateRoutingRule(i, 'active', rule.active === false ? true : false)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${rule.active === false ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`}>
                          {rule.active === false ? 'Disabled' : 'Active'}
                        </button>
                        <button onClick={() => { removeRoutingRule(i); setEditingIndex(null) }}
                          className="rounded-lg px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}

        {(config.routing_rules || []).length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--text-muted)]">
            <span className="material-icons-outlined block mb-2" style={{ fontSize: '32px' }}>route</span>
            No routing rules configured. Click Add Rule to create your first one.
          </div>
        )}
      </div>

      {/* ── Document Types (TRK-575) ────────────────────────────────── */}
      <DocumentTypesAdmin />
    </div>
  )
}

// ── Document Types CRUD (reads from document_link_config via document-index routes) ──

interface DocTypeConfig {
  id: string
  document_type: string
  display_name: string
  target_ui: string
  file_patterns: string[]
  priority: number
  visible: boolean
  subfolder?: string
  required?: boolean
  product_types?: string[]
}

function DocumentTypesAdmin() {
  const [configs, setConfigs] = useState<DocTypeConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    document_type: '', display_name: '', target_ui: 'client_detail',
    file_patterns: '', priority: 50, subfolder: 'Client', required: false,
  })

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchValidated<DocTypeConfig[]>('/api/document-index/config')
            if (res.success) setConfigs(res.data || [])
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const handleSave = async () => {
    const body = {
      document_type: form.document_type,
      display_name: form.display_name || form.document_type,
      target_ui: form.target_ui,
      file_patterns: form.file_patterns.split(',').map(s => s.trim()).filter(Boolean),
      priority: form.priority,
      subfolder: form.subfolder,
      required: form.required,
      visible: true,
    }
    if (editingId) {
      await fetchValidated(`/api/document-index/config/${editingId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    } else {
      await fetchValidated('/api/document-index/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
    }
    setAdding(false); setEditingId(null)
    setForm({ document_type: '', display_name: '', target_ui: 'client_detail', file_patterns: '', priority: 50, subfolder: 'Client', required: false })
    await loadConfigs()
  }

  const handleArchive = async (id: string) => {
    await fetchValidated(`/api/document-index/config/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: false }),
    })
    await loadConfigs()
  }

  const startEdit = (c: DocTypeConfig) => {
    setEditingId(c.id)
    setAdding(true)
    setForm({
      document_type: c.document_type,
      display_name: c.display_name || '',
      target_ui: c.target_ui || 'client_detail',
      file_patterns: (c.file_patterns || []).join(', '),
      priority: c.priority || 50,
      subfolder: c.subfolder || 'Client',
      required: c.required || false,
    })
  }

  return (
    <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="material-icons-outlined text-[var(--portal)]" style={{ fontSize: '20px' }}>description</span>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Document Types</h3>
          <span className="text-xs text-[var(--text-muted)]">({configs.length})</span>
        </div>
        <button
          onClick={() => { setAdding(!adding); setEditingId(null); setForm({ document_type: '', display_name: '', target_ui: 'client_detail', file_patterns: '', priority: 50, subfolder: 'Client', required: false }) }}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--portal)] px-3 py-1.5 text-xs font-medium text-white hover:brightness-110 transition-colors"
        >
          <span className="material-icons-outlined" style={{ fontSize: '14px' }}>add</span>
          Add Type
        </button>
      </div>

      {/* Add/Edit form */}
      {adding && (
        <div className="mb-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Document Type</label>
              <input value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))}
                disabled={!!editingId}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none disabled:opacity-50"
                placeholder="e.g. drivers_license" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Display Name</label>
              <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
                placeholder="e.g. Driver's License" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">File Patterns (comma-sep)</label>
              <input value={form.file_patterns} onChange={e => setForm(p => ({ ...p, file_patterns: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none"
                placeholder="*driver*, *DL*, *license*" />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Subfolder</label>
              <select value={form.subfolder} onChange={e => setForm(p => ({ ...p, subfolder: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
                {['Client', 'Cases', 'NewBiz', 'Account', 'Reactive'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Priority</label>
              <input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input type="checkbox" checked={form.required} onChange={e => setForm(p => ({ ...p, required: e.target.checked }))} />
              Required document
            </label>
            <select value={form.target_ui} onChange={e => setForm(p => ({ ...p, target_ui: e.target.value }))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:border-[var(--portal)] focus:outline-none">
              <option value="client_detail">Client Detail</option>
              <option value="account_detail">Account Detail</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAdding(false); setEditingId(null) }}
              className="rounded-lg border border-[var(--border-subtle)] px-4 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-base)]">Cancel</button>
            <button onClick={handleSave} disabled={!form.document_type}
              className="rounded-lg bg-[var(--portal)] px-4 py-1.5 text-xs font-medium text-white hover:brightness-110 disabled:opacity-50">{editingId ? 'Update' : 'Create'}</button>
          </div>
        </div>
      )}

      {/* Config list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 rounded bg-[var(--bg-surface)] animate-pulse" />)}
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center py-6 text-sm text-[var(--text-muted)]">
          <span className="material-icons-outlined block mb-2" style={{ fontSize: '28px' }}>description</span>
          No document types configured yet.
        </div>
      ) : (
        <div className="space-y-1">
          {configs.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] px-4 py-2.5 hover:bg-[var(--bg-surface)] transition-colors">
              <span className="material-icons-outlined text-[var(--text-muted)]" style={{ fontSize: '16px' }}>
                {c.required ? 'star' : 'description'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)]">{c.display_name || c.document_type}</span>
                <span className="text-xs text-[var(--text-muted)] ml-2">{c.target_ui} · {(c.file_patterns || []).join(', ')}</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)]">P{c.priority}</span>
              <button onClick={() => startEdit(c)} className="rounded p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--portal)]">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>edit</span>
              </button>
              <button onClick={() => handleArchive(c.id)} className="rounded p-1 hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400">
                <span className="material-icons-outlined" style={{ fontSize: '14px' }}>archive</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
