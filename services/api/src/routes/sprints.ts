import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import {
  successResponse,
  errorResponse,
  validateRequired,
  stripInternalFields,
  param,
} from '../lib/helpers.js'
import type { SprintDTO, SprintDeleteResult, DiscoveryImportPreviewData, DiscoveryImportResult, SprintPromptData, AuditRoundData, AuditRoundCreateResult, SendItResult, ReopenResult } from '@tomachina/core'

export const sprintRoutes = Router()
const SPRINT_COLLECTION = 'sprints'
const TRACKER_COLLECTION = 'tracker_items'

// GET / — list all sprints
sprintRoutes.get('/', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(SPRINT_COLLECTION).orderBy('created_at', 'desc').get()
    const data = snap.docs.map(doc => stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>))
    res.json(successResponse<unknown>(data))
  } catch (err) {
    console.error('GET /api/sprints error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST / — create sprint + assign tracker items
sprintRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const err = validateRequired(req.body, ['name'])
    if (err) { res.status(400).json(errorResponse(err)); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    const sprintRef = db.collection(SPRINT_COLLECTION).doc()
    const sprintData = {
      name: req.body.name,
      description: req.body.description || '',
      discovery_url: req.body.discovery_url || null,
      plan_link: req.body.plan_link || null,
      item_ids: req.body.item_ids || [],
      status: 'active',
      created_at: now,
      updated_at: now,
      _created_by: userEmail,
    }

    await sprintRef.set(sprintData)

    // Batch-update tracker items to assign sprint_id and set status to in_sprint
    const itemIds = req.body.item_ids as string[] | undefined
    if (itemIds && itemIds.length > 0) {
      const batch = db.batch()
      for (const itemId of itemIds) {
        const ref = db.collection(TRACKER_COLLECTION).doc(itemId)
        batch.update(ref, {
          sprint_id: sprintRef.id,
          status: 'in_sprint',
          updated_at: now,
          _updated_by: userEmail,
        })
      }
      await batch.commit()
    }

    res.status(201).json(successResponse<unknown>({ id: sprintRef.id, ...sprintData }))
  } catch (err) {
    console.error('POST /api/sprints error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /auto — auto-generate next sprint from unassigned items
// Prioritizes: Bugs → Enhancements → Features → Questions, clustered by component
sprintRoutes.post('/auto', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const now = new Date().toISOString()
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
    const maxItems = Math.min(parseInt(req.body.max_items as string) || 25, 50)

    // Find all unassigned items
    const snap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const unassigned = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
      .filter(d => !d.sprint_id && ['queue', 'not_touched'].includes(d.status as string))

    if (unassigned.length === 0) {
      res.status(400).json(errorResponse('No unassigned items available for a sprint'))
      return
    }

    // Priority order: broken > improve > idea > question > untyped
    const typePriority: Record<string, number> = { broken: 0, improve: 1, idea: 2, question: 3 }
    const sorted = unassigned.sort((a, b) => {
      const pa = typePriority[a.type as string] ?? 4
      const pb = typePriority[b.type as string] ?? 4
      if (pa !== pb) return pa - pb
      // Within same type, cluster by component
      const ca = (a.component as string) || ''
      const cb = (b.component as string) || ''
      return ca.localeCompare(cb)
    })

    const selected = sorted.slice(0, maxItems)

    // Determine sprint number
    const sprintSnap = await db.collection(SPRINT_COLLECTION).get()
    const sprintNum = sprintSnap.size + 1
    const name = req.body.name || `Sprint ${sprintNum}`
    const description = req.body.description || (() => {
      const bugs = selected.filter(i => i.type === 'broken').length
      const enhancements = selected.filter(i => i.type === 'improve').length
      const features = selected.filter(i => i.type === 'idea').length
      const questions = selected.filter(i => i.type === 'question').length
      const parts: string[] = []
      if (bugs) parts.push(`${bugs} bugs`)
      if (enhancements) parts.push(`${enhancements} enhancements`)
      if (features) parts.push(`${features} features`)
      if (questions) parts.push(`${questions} questions`)
      return `Auto-generated: ${parts.join(', ') || `${selected.length} items`}`
    })()

    // Create sprint
    const sprintRef = db.collection(SPRINT_COLLECTION).doc()
    const sprintData = {
      name,
      description,
      item_ids: selected.map(i => i.id),
      status: 'active',
      created_at: now,
      updated_at: now,
      _created_by: userEmail,
    }
    await sprintRef.set(sprintData)

    // Assign items
    const batch = db.batch()
    for (const item of selected) {
      batch.update(db.collection(TRACKER_COLLECTION).doc(item.id as string), {
        sprint_id: sprintRef.id,
        status: 'in_sprint',
        updated_at: now,
        _updated_by: userEmail,
      })
    }
    await batch.commit()

    res.status(201).json(successResponse<unknown>({
      id: sprintRef.id,
      ...sprintData,
      item_count: selected.length,
    }))
  } catch (err) {
    console.error('POST /api/sprints/auto error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /roadmap — generate branded tabbed HTML roadmap
sprintRoutes.get('/roadmap', async (_req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const snap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const allItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>))
    // Exclude completed work — roadmap only shows what's NOT done
    const items = allItems.filter(i => !['confirmed', 'deferred', 'wont_fix'].includes(i.status as string))

    // Read logos and base64 encode them
    const fs = await import('fs')
    const path = await import('path')
    // In dev: cwd is services/api, in prod: varies. Try multiple paths.
    const tryPaths = [
      path.resolve(process.cwd(), '..', '..', 'packages/ui/src/logos'),
      path.resolve(process.cwd(), '..', 'packages/ui/src/logos'),
      path.resolve(process.cwd(), 'packages/ui/src/logos'),
      '/Users/joshd.millang/Projects/toMachina/packages/ui/src/logos',
    ]
    const logoDir = tryPaths.find(p => { try { return fs.existsSync(p) } catch { return false } }) || tryPaths[0]
    const encode = (file: string) => { try { return fs.readFileSync(path.join(logoDir, file)).toString('base64') } catch { return '' } }
    const logos: Record<string, { data: string; mime: string }> = {
      PRODASHX: { data: encode('prodashx-tm/prodashx-tm-transparent.png'), mime: 'image/png' },
      RIIMO: { data: encode('riimo-tm/riimo-tm-transparent.png'), mime: 'image/png' },
      SENTINEL: { data: encode('sentinel-tm/sentinel-tm-transparent.png'), mime: 'image/png' },
      SHARED: { data: encode('tomachina/tomachina-transparent.png'), mime: 'image/png' },
    }

    const typeLabels: Record<string, string> = { broken: 'Bug', improve: 'Enhancement', idea: 'Feature', question: 'Question' }
    const statusLabels: Record<string, string> = {
      queue: 'Queue', not_touched: 'Not Touched', in_sprint: 'In Sprint',
      planned: 'Planned', built: 'Built', audited: 'Audited',
      confirmed: 'Confirmed', deferred: 'Deferred', wont_fix: "Won't Fix",
    }
    const statusColors: Record<string, string> = {
      queue: '#fbbf24', not_touched: '#ef4444', in_sprint: '#f59e0b',
      planned: '#4a7ab5', built: '#14b8a6', audited: '#a855f7',
      confirmed: '#22c55e', deferred: '#9ca3af', wont_fix: '#64748b',
    }

    const tabs = [
      { key: 'PRODASHX', label: 'ProDashX', color: '#4a7ab5', desc: 'B2C — Direct Client Sales & Service' },
      { key: 'SENTINEL', label: 'SENTINEL', color: '#40bc58', desc: 'B2B — M&A + Partnerships' },
      { key: 'RIIMO', label: 'RIIMO', color: '#a78bfa', desc: 'B2E — Shared Services Operations' },
      { key: 'SHARED', label: 'toMachina', color: '#e07c3e', desc: 'Cross-Portal — Shared Platform' },
      { key: 'DATA', label: 'Data', color: '#d69e2e', desc: 'Firestore + Data Integrity' },
      { key: 'INFRA', label: 'Infrastructure', color: '#718096', desc: 'Platform Infrastructure' },
    ]

    function categorize(type: string): string {
      if (type === 'broken') return 'Reactive'
      if (type === 'improve' || type === 'idea') return 'Proactive'
      if (type === 'question') return 'Considerations'
      return 'Uncategorized'
    }
    const categoryOrder = ['Reactive', 'Proactive', 'Considerations', 'Uncategorized']
    const categoryColors: Record<string, string> = {
      Reactive: '#ef4444', Proactive: '#a855f7', Considerations: '#3b82f6', Uncategorized: '#9ca3af',
    }

    const totalItems = items.length
    const totalBugs = items.filter(i => i.type === 'broken').length
    const totalEnhancements = items.filter(i => i.type === 'improve').length
    const totalFeatures = items.filter(i => i.type === 'idea').length
    const totalQuestions = items.filter(i => i.type === 'question').length
    const completedCount = allItems.length - items.length
    const genDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

    let html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>FORGE Platform Roadmap — toMachina</title>
<style>
@page { size: letter; margin: 0.5in; }
@media print {
  .no-print { display: none !important; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  body { background: #0d1117 !important; }
  .container { padding: 0 !important; }
  .hero { margin-bottom: 20px !important; padding: 24px !important; }
  .tab-bar { display: none !important; }
  .tab-content { display: block !important; padding-top: 8px !important; }
  .tab-content + .tab-content { page-break-before: always; }
  .portal-banner { margin-bottom: 10px !important; padding: 12px 16px !important; page-break-after: avoid !important; }
  .portal-banner + .category { page-break-before: avoid !important; }
  .category { margin-bottom: 10px !important; }
  .cat-header { page-break-after: avoid !important; }
  .item-row { padding: 4px 8px !important; font-size: 11px !important; page-break-inside: avoid; }
  .footer { margin-top: 24px !important; }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e2e8f0; background: #0d1117; line-height: 1.5; }
.container { max-width: 1100px; margin: 0 auto; padding: 40px 36px; }
.hero { position: relative; padding: 40px 36px; border-radius: 16px; margin-bottom: 32px; background: linear-gradient(135deg, #161b26 0%, #1c2333 100%); border: 1px solid #2a3347; overflow: hidden; }
.hero::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #e07c3e, #f59e0b, #e07c3e); }
.hero-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.hero h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; }
.hero h1 span { background: linear-gradient(135deg, #e07c3e, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
.hero .sub { color: #64748b; font-size: 14px; margin-top: 4px; }
.hero .sub strong { color: #94a3b8; }
.stats { display: flex; gap: 8px; flex-wrap: wrap; }
.stat { text-align: center; padding: 12px 16px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid #2a3347; min-width: 72px; }
.stat .num { font-size: 22px; font-weight: 800; }
.stat .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; }
.tab-bar { display: flex; gap: 0; border-bottom: 1px solid #2a3347; margin-bottom: 0; background: #161b26; border-radius: 12px 12px 0 0; padding: 0 8px; }
.tab { padding: 12px 20px; cursor: pointer; font-size: 13px; font-weight: 600; border: none; background: none; color: #64748b; border-bottom: 3px solid transparent; display: flex; align-items: center; gap: 8px; transition: all 0.2s; margin-bottom: -1px; }
.tab:hover { color: #e2e8f0; background: rgba(255,255,255,0.02); }
.tab.active { border-bottom-color: var(--tab-color); color: #e2e8f0; }
.tab img { height: 20px; width: auto; filter: drop-shadow(0 0 4px rgba(255,255,255,0.1)); }
.tab .dot { width: 12px; height: 12px; border-radius: 50%; }
.tab .count { font-size: 10px; font-weight: 500; color: #4a5568; margin-left: 2px; }
.tab-content { display: none; padding: 28px 0; }
.tab-content.active { display: block; }
.portal-banner { display: flex; align-items: center; gap: 16px; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; background: rgba(255,255,255,0.02); border: 1px solid #2a3347; }
.portal-banner img { height: 48px; width: auto; filter: drop-shadow(0 0 8px rgba(255,255,255,0.08)); }
.portal-banner .dot { width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; font-size: 16px; }
.portal-banner h2 { font-size: 22px; font-weight: 800; letter-spacing: -0.3px; }
.portal-banner p { font-size: 12px; color: #64748b; }
.portal-banner .pstats { margin-left: auto; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.portal-banner .ps { font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
.category { margin-bottom: 24px; break-inside: avoid; }
.cat-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; padding: 5px 14px; border-radius: 6px; display: inline-block; color: #fff; }
.item-row { display: flex; gap: 10px; align-items: center; padding: 8px 12px; border-radius: 6px; margin-bottom: 2px; font-size: 13px; transition: background 0.1s; }
.item-row:hover { background: rgba(255,255,255,0.02); }
.item-id { font-family: 'SF Mono', Menlo, monospace; font-size: 11px; color: #4a5568; min-width: 58px; }
.item-type { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 4px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em; }
.item-title { flex: 1; color: #e2e8f0; }
.item-status { font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 4px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em; }
.item-component { font-size: 10px; color: #4a5568; min-width: 110px; text-align: right; }
.footer { text-align: center; margin-top: 48px; padding-top: 24px; border-top: 1px solid #2a3347; }
.footer p { color: #4a5568; font-size: 11px; }
.footer strong { color: #e07c3e; }
.print-btn { position: fixed; bottom: 28px; right: 28px; padding: 14px 28px; background: linear-gradient(135deg, #e07c3e, #d4691e); color: #fff; border: none; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(224,124,62,0.3); z-index: 10; transition: all 0.2s; }
.summary { display: none; }
@media print { .summary { display: block !important; } }
.print-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(224,124,62,0.4); }
</style></head><body>
<button class="print-btn no-print" onclick="window.print()">Print / Save PDF</button>
<div class="container">

<div class="hero">
<div class="hero-top">
<div>
<h1><span>FORGE</span> Platform Roadmap</h1>
<p class="sub"><strong>toMachina</strong> — ${genDate} &nbsp;|&nbsp; Retirement Protectors, Inc.</p>
</div>
<div class="stats">
<div class="stat"><div class="num" style="color:#e2e8f0">${totalItems}</div><div class="lbl">Total</div></div>
<div class="stat"><div class="num" style="color:#ef4444">${totalBugs}</div><div class="lbl">Bugs</div></div>
<div class="stat"><div class="num" style="color:#f59e0b">${totalEnhancements}</div><div class="lbl">Enhance</div></div>
<div class="stat"><div class="num" style="color:#a855f7">${totalFeatures}</div><div class="lbl">Feature</div></div>
<div class="stat"><div class="num" style="color:#3b82f6">${totalQuestions}</div><div class="lbl">Question</div></div>
<div class="stat"><div class="num" style="color:#22c55e">${completedCount}</div><div class="lbl">Done</div></div>
</div>
</div>
</div>

<!-- Executive Summary (print only on page 1) -->
<div class="summary" style="margin-bottom:28px">`

    // Generate summary banners for all portals
    for (const t of tabs) {
      const portalItems = items.filter(it => it.portal === t.key)
      if (portalItems.length === 0) continue

      const pBugs = portalItems.filter(it => it.type === 'broken').length
      const pEnh = portalItems.filter(it => it.type === 'improve').length
      const pFeat = portalItems.filter(it => it.type === 'idea').length
      const pQ = portalItems.filter(it => it.type === 'question').length
      const pConf = portalItems.filter(it => it.status === 'confirmed').length

      const sLogo = logos[t.key]
      const sLogoImg = sLogo?.data ? `<img src="data:${sLogo.mime};base64,${sLogo.data}" style="height:36px;width:auto" />` : `<span class="dot" style="background:${t.color};width:24px;height:24px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:13px">${t.label[0]}</span>`

      html += `<div style="display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:10px;background:${t.color}08;border:1px solid ${t.color}20;margin-bottom:8px">
${sLogoImg}
<div style="flex:1"></div>
<div style="display:flex;gap:6px;flex-wrap:wrap">
${pBugs ? `<span class="ps" style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#ef444415;color:#ef4444">${pBugs} bugs</span>` : ''}
${pEnh ? `<span class="ps" style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#f59e0b15;color:#f59e0b">${pEnh} enh</span>` : ''}
${pFeat ? `<span class="ps" style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#a855f715;color:#a855f7">${pFeat} feat</span>` : ''}
${pQ ? `<span class="ps" style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#3b82f615;color:#3b82f6">${pQ} q</span>` : ''}
<span class="ps" style="font-size:10px;font-weight:600;padding:3px 10px;border-radius:20px;background:#22c55e15;color:#22c55e">${pConf}/${portalItems.length} done</span>
</div>
</div>`
    }

    html += `</div>

<!-- Tab bar -->
<div class="tab-bar no-print">`

    // Generate tabs
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i]
      const count = items.filter(it => it.portal === t.key).length
      if (count === 0) continue
      const logo = logos[t.key]
      const logoSrc = logo?.data ? `<img src="data:${logo.mime};base64,${logo.data}" />` : `<span class="dot" style="background:${t.color}">${t.label[0]}</span>`
      const tabLabel = logo?.data ? '' : t.label
      html += `<button class="tab${i === 0 ? ' active' : ''}" style="--tab-color:${t.color}" onclick="showTab('${t.key}')">${logoSrc}${tabLabel}<span class="count">(${count})</span></button>`
    }

    html += `</div><!-- /tab-bar -->`

    // Generate tab content for each portal
    for (let i = 0; i < tabs.length; i++) {
      const t = tabs[i]
      const portalItems = items.filter(it => it.portal === t.key)
      if (portalItems.length === 0) continue

      const pBugs = portalItems.filter(it => it.type === 'broken').length
      const pEnh = portalItems.filter(it => it.type === 'improve').length
      const pFeat = portalItems.filter(it => it.type === 'idea').length
      const pQ = portalItems.filter(it => it.type === 'question').length
      const pConf = portalItems.filter(it => it.status === 'confirmed').length

      const bannerLogo = logos[t.key]
      const logoImg = bannerLogo?.data ? `<img src="data:${bannerLogo.mime};base64,${bannerLogo.data}" />` : `<span class="dot" style="background:${t.color}">${t.label[0]}</span>`

      html += `<div class="tab-content${i === 0 ? ' active' : ''}" id="tab-${t.key}">
<div class="portal-banner" style="background:${t.color}10;border-left:4px solid ${t.color}">
${logoImg}
<div class="pstats" style="margin-left:auto">
${pBugs ? `<span class="ps" style="background:#ef444415;color:#ef4444">${pBugs} bugs</span>` : ''}
${pEnh ? `<span class="ps" style="background:#f59e0b15;color:#f59e0b">${pEnh} enh</span>` : ''}
${pFeat ? `<span class="ps" style="background:#a855f715;color:#a855f7">${pFeat} feat</span>` : ''}
${pQ ? `<span class="ps" style="background:#3b82f615;color:#3b82f6">${pQ} q</span>` : ''}
<span class="ps" style="background:#22c55e15;color:#22c55e">${pConf}/${portalItems.length} done</span>
</div>
</div>`

      for (const cat of categoryOrder) {
        const catItems = portalItems.filter(it => categorize(it.type as string) === cat)
        if (catItems.length === 0) continue

        catItems.sort((a, b) => {
          const ca = (a.component as string) || ''
          const cb = (b.component as string) || ''
          if (ca !== cb) return ca.localeCompare(cb)
          return ((a.item_id as string) || '').localeCompare((b.item_id as string) || '')
        })

        html += `<div class="category">
<span class="cat-header" style="background:${categoryColors[cat]}">${cat} (${catItems.length})</span>`

        for (const item of catItems) {
          const tl = typeLabels[item.type as string] || ''
          const tc = ({ broken: '#ef4444', improve: '#f59e0b', idea: '#a855f7', question: '#3b82f6' } as Record<string, string>)[item.type as string] || '#999'
          const sl = statusLabels[item.status as string] || (item.status as string) || ''
          const sc = statusColors[item.status as string] || '#999'
          html += `<div class="item-row">
<span class="item-id">${item.item_id}</span>
${tl ? `<span class="item-type" style="background:${tc}15;color:${tc}">${tl}</span>` : ''}
<span class="item-title">${item.title}</span>
<span class="item-status" style="background:${sc}15;color:${sc}">${sl}</span>
<span class="item-component">${item.component || ''}</span>
</div>`
        }
        html += `</div>`
      }

      html += `</div><!-- /tab-content -->`
    }

    html += `
<div class="footer">
<p><strong>FORGE</strong> — The Machine's Build Tracker</p>
<p>Retirement Protectors, Inc. — toMachina Platform</p>
</div>
</div><!-- /container -->

<script>
function showTab(key) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + key).classList.add('active');
  event.currentTarget.classList.add('active');
}
</script>
</body></html>`

    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (err) {
    console.error('GET /api/sprints/roadmap error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /import-discovery — parse a discovery markdown doc into sprint + tracker items
sprintRoutes.post('/import-discovery', async (req: Request, res: Response) => {
  try {
    const { content, discovery_url, dry_run } = req.body as { content: string; discovery_url?: string; dry_run?: boolean }
    if (!content) { res.status(400).json(errorResponse('content (markdown) is required')); return }

    const db = getFirestore()
    const now = new Date().toISOString()
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    // --- Parse markdown ---

    // Extract sprint name from title: "# DISCOVERY HANDOFF: <name>"
    const titleMatch = content.match(/^#\s+(?:DISCOVERY HANDOFF:\s*)?(.+)/m)
    const sprintName = titleMatch ? titleMatch[1].trim() : 'Imported Discovery'

    // Extract description from first paragraph after title (before next ##)
    const descMatch = content.match(/^#\s+.+\n+(?:\*\*.+\*\*\n+)*(.+?)(?=\n##|\n---)/ms)
    const sprintDesc = descMatch ? descMatch[1].trim().substring(0, 500) : ''

    // Extract deliverables from "### Deliverable N:" sections
    const deliverableRegex = /###\s+Deliverable\s+\d+:\s+(.+)\n([\s\S]*?)(?=###\s+Deliverable|\n##\s+\d+\.|\n---\s*$)/g
    const items: Array<Record<string, unknown>> = []
    let match

    while ((match = deliverableRegex.exec(content)) !== null) {
      const deliverableName = match[1].trim()
      const deliverableBody = match[2]

      // Extract **What:** as description
      const whatMatch = deliverableBody.match(/\*\*What:\*\*\s*(.+?)(?=\n\*\*|\n\n)/s)
      const description = whatMatch ? whatMatch[1].trim() : ''

      // Extract **Where:** for section
      const whereMatch = deliverableBody.match(/\*\*Where:\*\*\s*(.+?)(?=\n\*\*|\n\n)/s)
      const section = whereMatch ? whereMatch[1].trim().substring(0, 200) : ''

      // Determine portal + scope from content
      const isInfra = /wire|api|firestore|backend|engine|collection/i.test(deliverableName + description)
      const isShared = /ui|frontend|screen|module|drop.zone|review/i.test(deliverableName + description)
      const portal = isInfra ? 'INFRA' : isShared ? 'SHARED' : 'INFRA'
      const scope = isInfra ? 'Data' : 'App'

      // Extract sub-items: "**Layer N —", "**Screen N —", or bold sub-headers
      const subItemRegex = /\*\*(?:Layer|Screen|Step)\s+\d+\s*[—–-]\s*(.+?)\*\*/g
      const subItems: string[] = []
      let subMatch
      while ((subMatch = subItemRegex.exec(deliverableBody)) !== null) {
        subItems.push(subMatch[1].trim())
      }

      if (subItems.length > 0) {
        // Create one item per sub-item, grouped under the deliverable as component
        for (const subItem of subItems) {
          // Extract description for sub-item: bullet points after the sub-header
          const subPattern = new RegExp(`\\*\\*(?:Layer|Screen|Step)\\s+\\d+\\s*[—–-]\\s*${subItem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*\\n([\\s\\S]*?)(?=\\*\\*(?:Layer|Screen|Step)|$)`)
          const subDescMatch = deliverableBody.match(subPattern)
          const subDesc = subDescMatch
            ? subDescMatch[1].split('\n').filter(l => l.trim().startsWith('-')).map(l => l.trim().replace(/^-\s*/, '')).join('. ').substring(0, 500)
            : ''

          items.push({
            title: subItem,
            description: subDesc,
            portal: /ui|frontend|review|drop|report/i.test(subItem) ? 'SHARED' : portal,
            scope: /ui|frontend|review|drop|report/i.test(subItem) ? 'App' : scope,
            component: deliverableName.replace(/\s*\(.+\)\s*$/, ''),
            section: '',
            type: 'idea',
            discovery_url: discovery_url || null,
          })
        }
      } else {
        // No sub-items — create one item for the whole deliverable
        items.push({
          title: deliverableName,
          description,
          portal,
          scope,
          component: deliverableName.replace(/\s*\(.+\)\s*$/, ''),
          section,
          type: 'idea',
          discovery_url: discovery_url || null,
        })
      }
    }

    // --- Dry run: return preview ---
    if (dry_run) {
      res.json(successResponse<unknown>({
        sprint: { name: sprintName, description: sprintDesc, discovery_url: discovery_url || null },
        sprint_name: sprintName,
        items,
        item_count: items.length,
        items_created: items.length,
      }))
      return
    }

    // --- Commit: create sprint + items ---

    // Get next TRK number
    const lastSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'desc').limit(1).get()
    let nextNum = 1
    if (!lastSnap.empty) {
      const lastId = (lastSnap.docs[0].data().item_id || 'TRK-000') as string
      nextNum = parseInt(lastId.replace('TRK-', ''), 10) + 1
    }

    // Create tracker items
    const itemIds: string[] = []
    const batch = db.batch()
    for (const item of items) {
      const itemId = `TRK-${String(nextNum).padStart(3, '0')}`
      const ref = db.collection(TRACKER_COLLECTION).doc(itemId)
      batch.set(ref, {
        ...item,
        item_id: itemId,
        status: 'in_sprint',
        plan_link: null,
        notes: '',
        created_at: now,
        updated_at: now,
        _created_by: userEmail,
      })
      itemIds.push(itemId)
      nextNum++
    }

    // Create sprint
    const sprintRef = db.collection(SPRINT_COLLECTION).doc()
    batch.set(sprintRef, {
      name: sprintName,
      description: sprintDesc,
      discovery_url: discovery_url || null,
      plan_link: null,
      item_ids: itemIds,
      status: 'active',
      created_at: now,
      updated_at: now,
      _created_by: userEmail,
    })

    // Link items to sprint
    for (const itemId of itemIds) {
      batch.update(db.collection(TRACKER_COLLECTION).doc(itemId), { sprint_id: sprintRef.id })
    }

    await batch.commit()

    res.status(201).json(successResponse<unknown>({
      sprint_id: sprintRef.id,
      sprint_name: sprintName,
      discovery_url: discovery_url || null,
      items_created: itemIds.length,
      item_ids: itemIds,
    }))
  } catch (err) {
    console.error('POST /api/sprints/import-discovery error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id/prompt — generate markdown prompt from sprint items
sprintRoutes.get('/:id/prompt', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const sprint = sprintDoc.data() as Record<string, unknown>
    const allSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const snap = { docs: allSnap.docs.filter(d => d.data().sprint_id === id) }

    // Group items by component
    const grouped: Record<string, Array<Record<string, unknown>>> = {}
    for (const doc of snap.docs) {
      const item = doc.data()
      const component = (item.component as string) || 'Uncategorized'
      if (!grouped[component]) grouped[component] = []
      grouped[component].push(item)
    }

    // Collect item IDs and doc IDs for status update commands
    const allItems = snap.docs.map(d => d.data())
    const itemIds = allItems.map(i => i.item_id as string)
    const docIds = snap.docs.map(d => d.id)

    // Phase determines prompt framing
    const phase = (req.query.phase as string) || 'discovery'

    // Sprint directory for artifacts
    const sprintSlug = (sprint.name as string || 'sprint').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const sprintDir = `.claude/${sprintSlug}`

    // Build markdown
    let md = ''
    if (phase === 'building') {
      md += `# FORGE Builder: ${sprint.name}\n\n`
      md += `> **You are a builder agent executing the ${sprint.name} sprint.**\n`
      md += `> Your job is to READ the plan, EXECUTE every ticket, and REPORT results.\n`
      md += `> Do NOT deviate from the plan. Do NOT skip tickets. Do NOT add scope.\n`
      md += `> **FORGE Standards:** Read \`.claude/sprints/FORGE_STANDARDS.md\` for reporting format requirements.\n\n`
      md += `## Your Documents\n\n`
      if (sprint.discovery_url) md += `**Discovery Doc (source of truth):**\nRead FIRST: \`${sprint.discovery_url}\`\n\n`
      if (sprint.plan_link) md += `**Plan Doc (your blueprint):**\nRead SECOND: \`${sprint.plan_link}\`\n\n`
      if (sprint.description) md += `**Sprint Goal:** ${sprint.description}\n\n`
    } else {
      md += `# ${sprint.name}`
      if (sprint.description) md += ` — ${sprint.description}`
      md += '\n'
      if (sprint.discovery_url) md += `> **Discovery Document:** [${sprint.discovery_url}](${sprint.discovery_url})\n`
    }

    // Artifact Persistence Protocol — always included
    md += `\n---\n`
    md += `\n## Artifact Persistence Protocol\n`
    md += `> Every phase produces artifacts. Artifacts MUST be saved to files AND linked to the FORGE sprint.\n`
    md += `> A file without a FORGE link is invisible. A FORGE link without a file is broken.\n\n`
    md += `**Sprint directory:** \`${sprintDir}/\`\n`
    md += `**Sprint ID:** \`${id}\`\n\n`

    if (phase === 'discovery') {
      const planFileName = `${(sprint.name as string || 'SPRINT').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_PLAN.md`

      md += `### Discovery Phase — You Are Here\n\n`

      md += `**Step 1: Discovery Document**\n`
      md += `- Save research/analysis to \`${sprintDir}/DISCOVERY.md\` (or .html for visual mockups)\n`
      md += `- Link it to the sprint:\n`
      md += '```bash\n'
      md += `curl -X PATCH http://localhost:8080/api/sprints/${id} -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"discovery_url":"${sprintDir}/DISCOVERY.md"}'\n`
      md += '```\n\n'

      md += `**Step 2: Create Tracker Items**\n`
      md += `- Every deliverable identified during discovery becomes a tracker item\n`
      md += `- Create items via seed script or POST /api/tracker with \`sprint_id: '${id}'\`\n`
      md += `- Each item needs: title, description, portal, scope, component, section, type\n\n`

      md += `**Step 3: Write the Plan**\n`
      md += `- Save implementation plan to \`${sprintDir}/${planFileName}\`\n`
      md += `- Link it to the sprint:\n`
      md += '```bash\n'
      md += `curl -X PATCH http://localhost:8080/api/sprints/${id} -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"plan_link":"${sprintDir}/${planFileName}"}'\n`
      md += '```\n\n'

      md += `**Step 3b: Generate HTML Plan Document**\n`
      md += `- After creating the plan markdown, also generate a branded HTML plan document.\n`
      md += `- Save it to \`apps/prodash/public/plans/${sprintSlug}.html\`\n`
      md += `- Use the established FORGE HTML format: dark theme (#0d1117 bg), branded header with gradient, sections for each deliverable, print-friendly.\n`
      md += `- Update the sprint plan_link to point to the HTML:\n`
      md += '```bash\n'
      md += `curl -X PATCH http://localhost:8080/api/sprints/${id} -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"plan_link":"https://prodash.tomachina.com/plans/${sprintSlug}.html"}'\n`
      md += '```\n'
      md += `- Open the plan in the browser after generation to verify it renders correctly.\n\n`

      md += `**Step 4: Plan Audit**\n`
      md += `- Run a Plan Audit: compare plan ↔ tickets ↔ discovery document\n`
      md += `- All 3 must align. Gaps = rejected plan.\n\n`

      md += `**Nothing advances to building until: discovery file exists + plan file exists + both are linked to the sprint + tracker items are created + plan audit passes.**\n`
    } else if (phase === 'building') {
      md += `### Building Phase — You Are Here\n\n`

      md += `**Read BOTH files before writing any code:**\n`
      if (sprint.discovery_url) {
        md += `1. Discovery: [${sprint.discovery_url}](${sprint.discovery_url})\n`
      } else {
        md += `1. Discovery: **NOT LINKED** — check \`${sprintDir}/\` or ask JDM\n`
      }
      if (sprint.plan_link) {
        md += `2. Plan: [${sprint.plan_link}](${sprint.plan_link})\n\n`
      } else {
        md += `2. Plan: **NOT LINKED** — check \`${sprintDir}/\` or ask JDM\n\n`
      }

      md += `**After build:**\n`
      md += `3. Save builder prompts to \`${sprintDir}/BUILDER_*.md\` (one per builder agent)\n`
      md += `4. Save builder reports to \`.claude/_ARCHIVED/builder-reports/\`\n`
      md += `5. If no HTML plan exists yet, generate one at \`apps/prodash/public/plans/${sprintSlug}.html\` (dark theme, branded FORGE header, sections per deliverable) and update plan_link:\n`
      md += '```bash\n'
      md += `curl -X PATCH http://localhost:8080/api/sprints/${id} -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d '{"plan_link":"https://prodash.tomachina.com/plans/${sprintSlug}.html"}'\n`
      md += '```\n'
    }

    // Separate questions from build items
    const buildItems: Record<string, Array<Record<string, unknown>>> = {}
    const questionItems: Array<Record<string, unknown>> = []

    for (const [component, compItems] of Object.entries(grouped)) {
      for (const item of compItems) {
        if (item.type === 'question') {
          questionItems.push(item)
        } else {
          if (!buildItems[component]) buildItems[component] = []
          buildItems[component].push(item)
        }
      }
    }

    // Build items — grouped by component
    for (const [component, items] of Object.entries(buildItems)) {
      md += `\n## ${component}\n`
      for (const item of items) {
        const typeLabel = ({ broken: 'Bug', improve: 'Enhancement', idea: 'Feature' } as Record<string, string>)[item.type as string] || ''
        md += `- [${item.item_id}]${typeLabel ? ` [${typeLabel}]` : ''} ${item.title}`
        if (item.description) md += ` — ${item.description}`
        md += '\n'
      }
    }

    // Questions — investigate and answer, don't build
    if (questionItems.length > 0) {
      md += `\n## Questions (Investigate + Answer)\n`
      md += `> These are not build tasks. Research each question and provide findings to JDM using AskUserQuestion.\n\n`
      for (const item of questionItems) {
        md += `- [${item.item_id}] ${item.title}`
        if (item.description) md += ` — ${item.description}`
        md += '\n'
      }
    }

    // New App Registration Checklist — building phase only
    if (phase === 'building') {
      md += `\n---\n`
      md += `\n## New App / Module Registration Checklist\n`
      md += `> If this sprint introduces a NEW App or Module, ALL of the following must be completed.\n`
      md += `> Skip this section if the sprint only modifies existing features.\n\n`
      md += `| # | Registration Point | File | What |\n`
      md += `|---|---|---|---|\n`
      md += `| 1 | Module definition + suite | \`packages/core/src/users/modules.ts\` | Add to MODULES constant + appropriate TOOL_SUITES array |\n`
      md += `| 2 | AppKey type + APP_BRANDS | \`packages/ui/src/apps/brands.ts\` | Add key to AppKey union + brand entry (color, icon, label, description) |\n`
      md += `| 3 | Sidebar APP_ITEMS (x3) | \`apps/*/components/PortalSidebar.tsx\` | Add to APP_ITEMS in all 3 portal sidebars |\n`
      md += `| 4 | AdminPanel MODULE_SECTIONS | \`packages/ui/src/modules/AdminPanel.tsx\` | Add to appropriate section so it appears in permissions audit |\n`
      md += `| 5 | Module export | \`packages/ui/src/modules/index.ts\` | Export the new component |\n`
      md += `| 6 | Portal pages (x3) | \`apps/*/app/(portal)/.../page.tsx\` | Create page in each portal that renders the module |\n`
      md += `| 7 | Firestore rules | \`firestore.rules\` | Add rules for any new collections |\n`
      md += `| 8 | API routes + server mount | \`services/api/src/server.ts\` | Import + mount new routes |\n`
    }

    // FORGE status update protocol — phase-specific
    md += `\n---\n`
    md += `\n## FORGE Status Protocol\n`
    md += `This sprint is tracked in FORGE (Build Tracker). Sprint is in **${
      phase === 'discovery' ? 'Plan' : phase === 'building' ? 'Build' : 'Unknown'
    }** phase.\n`
    md += `\n**Sprint ID:** \`${id}\``
    md += `\n**Items:** ${itemIds.join(', ')}`
    md += `\n**Doc IDs:** ${JSON.stringify(docIds)}\n`

    if (phase === 'discovery') {
      md += `\n### After Plan approved — update FORGE to \`planned\`\n`
      md += '```bash\n'
      md += `npx tsx -e "const{initializeApp,getApps}=require('firebase-admin/app');const{getFirestore}=require('firebase-admin/firestore');if(getApps().length===0)initializeApp({projectId:'claude-mcp-484718'});const db=getFirestore();(async()=>{const b=db.batch();${JSON.stringify(docIds)}.forEach(id=>b.update(db.collection('tracker_items').doc(id),{status:'planned',updated_at:new Date().toISOString()}));await b.commit();console.log('FORGE: ${docIds.length} items → planned')})()"`
      md += '\n```\n'
      md += `\n> **Confirmed** status is set by JDM in FORGE after visual verification.\n`
      md += `\n---\n`
      md += `\n#LetsPlanIt\n`
    } else if (phase === 'building') {
      md += `\n### Build Verification\n`
      md += '```bash\n'
      md += `npm run type-check    # Must pass 13/13\n`
      md += `npm run build         # Must pass 11/11\n`
      md += '```\n'

      md += `\n### After Build complete — update FORGE to \`built\`\n`
      md += '```bash\n'
      md += `npx tsx -e "const{initializeApp,getApps}=require('firebase-admin/app');const{getFirestore}=require('firebase-admin/firestore');if(getApps().length===0)initializeApp({projectId:'claude-mcp-484718'});const db=getFirestore();(async()=>{const b=db.batch();${JSON.stringify(docIds)}.forEach(id=>b.update(db.collection('tracker_items').doc(id),{status:'built',updated_at:new Date().toISOString()}));await b.commit();console.log('FORGE: ${docIds.length} items → built')})()"`
      md += '\n```\n'

      md += `\n### Reporting Format (MANDATORY)\n`
      md += 'When complete, report in this EXACT format:\n'
      md += '```\n'
      md += `✅ ${sprint.name} — Build Complete\n\n`
      md += `| TRK | Status | What Changed |\n`
      md += `|-----|--------|-------------|\n`
      for (const item of allItems) {
        md += `| ${item.item_id} | ✅/❌ | ... |\n`
      }
      md += `\nBuild verification:\n`
      md += `- type-check: ✅ 13/13\n`
      md += `- build: ✅ 11/11\n\n`
      md += `Files changed: [list]\n`
      md += `FORGE status: ${docIds.length} items → built\n`
      md += '```\n'
      md += `\n> **Confirmed** status is set by JDM in FORGE after visual verification.\n`
      md += `\n---\n`
      md += `\n**Read the plan. Execute the plan. Report results. Go.**\n`
    }

    res.json(successResponse<unknown>({ prompt: md }))
  } catch (err) {
    console.error('GET /api/sprints/:id/prompt error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id/audit-round — summarize current audit round (pass/fail/pending)
sprintRoutes.get('/:id/audit-round', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const allSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const sprintItems = allSnap.docs
      .filter(d => d.data().sprint_id === id)
      .filter(d => !['deferred', 'wont_fix'].includes(d.data().status as string))
      .map(d => stripInternalFields({ id: d.id, ...d.data() } as Record<string, unknown>))

    // Determine audit round based on item states
    const passed = sprintItems.filter(d => ['confirmed', 'audited'].includes(d.status as string))
    const failed = sprintItems.filter(d => ['built', 'planned', 'in_sprint', 'not_touched', 'queue'].includes(d.status as string))
    const pending = sprintItems.filter(d => ['plan_audited', 'disc_audited'].includes(d.status as string))

    // Round heuristic: if any items are confirmed, we are at least round 1
    const round = passed.length > 0 ? 1 : 0

    res.json(successResponse<unknown>({
      current_round: Math.max(round, 1),
      total_items: sprintItems.length,
      pending,
      pending_count: pending.length,
      passed,
      passed_count: passed.length,
      failed,
      failed_count: failed.length,
    }))
  } catch (err) {
    console.error('GET /api/sprints/:id/audit-round error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:id/sendit — confirm all items + close sprint + git commit
sprintRoutes.post('/:id/sendit', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const sprint = sprintDoc.data() as Record<string, unknown>
    const now = new Date().toISOString()
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    // 1. Confirm all active items in this sprint
    const allSnap = await db.collection(TRACKER_COLLECTION).get()
    const sprintItems = allSnap.docs.filter(d => d.data().sprint_id === id)
    const batch = db.batch()
    let confirmed = 0
    for (const doc of sprintItems) {
      const status = doc.data().status as string
      if (!['confirmed', 'deferred', 'wont_fix'].includes(status)) {
        batch.update(doc.ref, { status: 'confirmed', updated_at: now, _updated_by: userEmail })
        confirmed++
      }
    }

    // 2. Close the sprint
    batch.update(sprintDoc.ref, { status: 'complete', updated_at: now, _updated_by: userEmail })
    await batch.commit()

    // 3. Git stage + commit (local dev only — exec runs on same machine as repo)
    let gitResult = { committed: false, message: '' }
    try {
      const { execSync } = await import('child_process')
      const repoDir = process.env.REPO_DIR || '/Users/joshd.millang/Projects/toMachina'
      const sprintName = (sprint.name as string) || 'Sprint'
      const sprintDesc = (sprint.description as string) || ''
      const commitMsg = `${sprintName}${sprintDesc ? ' — ' + sprintDesc : ''}\n\n#SendIt via FORGE\nItems: ${sprintItems.map(d => d.data().item_id).join(', ')}\n\nCo-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

      execSync('git add -A', { cwd: repoDir, timeout: 10000 })
      try {
        execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { cwd: repoDir, timeout: 15000 })
        gitResult = { committed: true, message: `Committed: ${sprintName}` }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.includes('nothing to commit')) {
          gitResult = { committed: false, message: 'Nothing to commit — working tree clean' }
        } else {
          gitResult = { committed: false, message: `Git commit failed: ${msg.substring(0, 200)}` }
        }
      }
    } catch (e: unknown) {
      gitResult = { committed: false, message: `Git not available: ${e instanceof Error ? e.message : String(e)}` }
    }

    res.json(successResponse<unknown>({
      confirmed,
      sprint_closed: true,
      git: gitResult,
    }))
  } catch (err) {
    console.error('POST /api/sprints/:id/sendit error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// POST /:id/reopen — reopen a completed sprint (move back to active, unconfirm items to audited)
sprintRoutes.post('/:id/reopen', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const sprint = sprintDoc.data() as Record<string, unknown>
    if (sprint.status !== 'complete') {
      res.status(400).json(errorResponse('Sprint is not complete — nothing to reopen'))
      return
    }

    const now = new Date().toISOString()
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'

    // Move all confirmed items back to audited
    const allSnap = await db.collection(TRACKER_COLLECTION).get()
    const sprintItems = allSnap.docs.filter(d => d.data().sprint_id === id)
    const batch = db.batch()
    let reverted = 0
    for (const doc of sprintItems) {
      if (doc.data().status === 'confirmed') {
        batch.update(doc.ref, { status: 'audited', updated_at: now, _updated_by: userEmail })
        reverted++
      }
    }

    // Reopen the sprint
    batch.update(sprintDoc.ref, { status: 'active', updated_at: now, _updated_by: userEmail })
    await batch.commit()

    res.json(successResponse<unknown>({ reverted, sprint_reopened: true }))
  } catch (err) {
    console.error('POST /api/sprints/:id/reopen error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id/audit-discovery — verify tickets match discovery document
sprintRoutes.get('/:id/audit-discovery', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const sprint = sprintDoc.data() as Record<string, unknown>
    const allSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const sprintDocs = allSnap.docs.filter(d => d.data().sprint_id === id)
    const docIds = sprintDocs.map(d => d.id)

    let md = `# Discovery Audit — ${sprint.name}\n`
    md += `> **Purpose:** Verify that the tracker tickets accurately and completely capture everything in the discovery document. Every requirement, feature, bug, and question from the discovery must have a corresponding ticket. Nothing should be missing, misinterpreted, or added without basis.\n\n`

    if (sprint.discovery_url) {
      md += `## Discovery Document\n`
      md += `**URL:** ${sprint.discovery_url}\n`
      md += `> Read the full discovery document at this URL before proceeding.\n\n`
    } else {
      md += `> ⚠️ No discovery_url set on this sprint. Check the sprint description or ask JDM for the discovery document.\n\n`
    }

    if (sprint.prompt_text) {
      md += `## Discovery Content (Stored)\n`
      md += `\`\`\`\n${sprint.prompt_text}\n\`\`\`\n\n`
    }

    md += `## Tickets Created (${sprintDocs.length})\n`
    for (const doc of sprintDocs) {
      const item = doc.data()
      const typeLabel = ({ broken: 'Bug', improve: 'Enhancement', idea: 'Feature', question: 'Question' } as Record<string, string>)[item.type as string] || ''
      md += `- **${item.item_id}**${typeLabel ? ` [${typeLabel}]` : ''}: ${item.title}`
      if (item.description) md += ` — ${item.description}`
      md += '\n'
    }

    md += `\n## Audit Checklist\n`
    md += `For each requirement/feature/bug in the discovery document:\n`
    md += `- [ ] Is there a matching ticket?\n`
    md += `- [ ] Is the ticket type correct (Bug/Enhancement/Feature/Question)?\n`
    md += `- [ ] Is the ticket description accurate and complete?\n`
    md += `- [ ] Is the component/portal assignment correct?\n\n`
    md += `Then check the reverse:\n`
    md += `- [ ] Are there any tickets that have NO basis in the discovery document?\n`
    md += `- [ ] Are there any tickets that misinterpret what the discovery asked for?\n\n`

    md += `## Output Format\n`
    md += `Report findings as:\n`
    md += `1. **GAPS** — Requirements in discovery with no ticket (create them)\n`
    md += `2. **MISMATCHES** — Tickets that don't match what discovery says (fix them)\n`
    md += `3. **EXTRAS** — Tickets with no basis in discovery (flag for JDM decision)\n`
    md += `4. **PASS** — Everything matches, no gaps found\n\n`

    md += `## FORGE Status Protocol\n`
    md += `After discovery audit passes — update items to \`disc_audited\`:\n`
    md += '```bash\n'
    md += `npx tsx -e "const{initializeApp,getApps}=require('firebase-admin/app');const{getFirestore}=require('firebase-admin/firestore');if(getApps().length===0)initializeApp({projectId:'claude-mcp-484718'});const db=getFirestore();(async()=>{const b=db.batch();${JSON.stringify(docIds)}.forEach(id=>b.update(db.collection('tracker_items').doc(id),{status:'disc_audited',updated_at:new Date().toISOString()}));await b.commit();console.log('FORGE: ${docIds.length} items → disc_audited')})()"`
    md += '\n```\n'
    md += `\n---\n`
    md += `\n#LetsAuditTheDiscovery\n`

    res.json(successResponse<unknown>({ prompt: md }))
  } catch (err) {
    console.error('GET /api/sprints/:id/audit-discovery error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id/audit-plan — verify plan covers all tickets and matches discovery
sprintRoutes.get('/:id/audit-plan', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const sprint = sprintDoc.data() as Record<string, unknown>
    const allSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const sprintDocs = allSnap.docs.filter(d => d.data().sprint_id === id)
    const docIds = sprintDocs.map(d => d.id)

    let md = `# Plan Audit — ${sprint.name}\n`
    md += `> **Purpose:** Verify that the plan completely and accurately covers every ticket, and that the plan is faithful to the original discovery document. The plan is the blueprint — if it's wrong, the build will be wrong.\n\n`

    if (sprint.discovery_url) {
      md += `## Discovery Document\n`
      md += `**URL:** ${sprint.discovery_url}\n`
      md += `> Read the full discovery document. This is the source of truth.\n\n`
    }

    if (sprint.plan_link) {
      md += `## Plan Document\n`
      md += `**URL:** ${sprint.plan_link}\n`
      md += `> Read the full plan document. This is what you're auditing.\n\n`
    } else {
      md += `> ⚠️ No plan_link set on this sprint. The plan may be in the prompt text or in a linked document. Check with JDM.\n\n`
    }

    if (sprint.prompt_text) {
      md += `## Sprint Prompt (Stored)\n`
      md += `\`\`\`\n${sprint.prompt_text}\n\`\`\`\n\n`
    }

    md += `## Tickets (${sprintDocs.length})\n`
    for (const doc of sprintDocs) {
      const item = doc.data()
      const typeLabel = ({ broken: 'Bug', improve: 'Enhancement', idea: 'Feature', question: 'Question' } as Record<string, string>)[item.type as string] || ''
      md += `- **${item.item_id}**${typeLabel ? ` [${typeLabel}]` : ''}: ${item.title}`
      if (item.description) md += ` — ${item.description}`
      md += '\n'
    }

    md += `\n## Audit Checklist\n`
    md += `### Plan ↔ Tickets\n`
    md += `For each ticket:\n`
    md += `- [ ] Is there a corresponding section/task in the plan?\n`
    md += `- [ ] Does the plan's approach correctly address what the ticket asks for?\n`
    md += `- [ ] Are there any tickets the plan ignores or only partially covers?\n\n`
    md += `### Plan ↔ Discovery\n`
    md += `For each requirement in the discovery:\n`
    md += `- [ ] Does the plan address it?\n`
    md += `- [ ] Does the plan's approach match the discovery's intent (not just the letter)?\n`
    md += `- [ ] Has the plan introduced scope that wasn't in the discovery?\n\n`
    md += `### Plan Quality\n`
    md += `- [ ] Are builders given enough detail to execute without guessing?\n`
    md += `- [ ] Are dependencies between tasks identified?\n`
    md += `- [ ] Are there any ambiguous instructions that could be misinterpreted?\n\n`

    md += `## Output Format\n`
    md += `Report findings as:\n`
    md += `1. **GAPS** — Tickets or discovery requirements not covered by the plan\n`
    md += `2. **MISMATCHES** — Plan approach doesn't match what was asked for\n`
    md += `3. **AMBIGUITIES** — Plan instructions that could be misread by a builder\n`
    md += `4. **SCOPE CREEP** — Plan includes work not grounded in discovery or tickets\n`
    md += `5. **PASS** — Plan fully covers all tickets and faithfully represents the discovery\n\n`

    md += `## FORGE Status Protocol\n`
    md += `After plan audit passes — update items to \`plan_audited\`:\n`
    md += '```bash\n'
    md += `npx tsx -e "const{initializeApp,getApps}=require('firebase-admin/app');const{getFirestore}=require('firebase-admin/firestore');if(getApps().length===0)initializeApp({projectId:'claude-mcp-484718'});const db=getFirestore();(async()=>{const b=db.batch();${JSON.stringify(docIds)}.forEach(id=>b.update(db.collection('tracker_items').doc(id),{status:'plan_audited',updated_at:new Date().toISOString()}));await b.commit();console.log('FORGE: ${docIds.length} items → plan_audited')})()"`
    md += '\n```\n'
    md += `\n---\n`
    md += `\n#LetsAuditThePlan\n`

    res.json(successResponse<unknown>({ prompt: md }))
  } catch (err) {
    console.error('GET /api/sprints/:id/audit-plan error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id/audit — generate audit verification prompt
sprintRoutes.get('/:id/audit', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const sprint = sprintDoc.data() as Record<string, unknown>
    const allSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const sprintDocs = allSnap.docs.filter(d => d.data().sprint_id === id)
    const docIds = sprintDocs.map(d => d.id)

    let md = `# Audit — ${sprint.name}\n`
    md += `Verify all ${sprintDocs.length} items. Run \`npm run dev\` and check all 3 portals.\n`
    md += `\n## Verification Checklist\n`

    for (const doc of sprintDocs) {
      const item = doc.data()
      const typeLabel = ({ broken: 'Bug', improve: 'Enhancement', idea: 'Feature', question: 'Question' } as Record<string, string>)[item.type as string] || ''
      md += `\n### ${item.item_id}${typeLabel ? ` [${typeLabel}]` : ''}: ${item.title}\n`
      if (item.description) md += `${item.description}\n`
      if (item.portal && item.portal !== 'SHARED') {
        md += `- [ ] ${item.portal}\n`
      } else if (item.portal === 'SHARED') {
        md += `- [ ] ProDash\n`
        md += `- [ ] RIIMO\n`
        md += `- [ ] SENTINEL\n`
      }
      md += `\n**Issues / Findings:**\n\n${'_'.repeat(60)}\n\n${'_'.repeat(60)}\n`
    }

    md += `\n## Build Verification\n\`\`\`bash\nnpm run build\n\`\`\`\nMust pass all workspaces. Catches webpack/bundler issues that type-check misses.\n\nAlso verify: no server-only code (fs, child_process) exported from shared package barrels — types only.\n`

    md += `\n## FORGE Status Protocol\nAfter audit passes:\n`
    md += '```bash\n'
    md += `npx tsx -e "\nconst { initializeApp, getApps } = require('firebase-admin/app');\nconst { getFirestore } = require('firebase-admin/firestore');\nif (getApps().length === 0) initializeApp({ projectId: 'claude-mcp-484718' });\nconst db = getFirestore();\n(async () => {\n  const batch = db.batch();\n  ${JSON.stringify(docIds)}.forEach(id =>\n    batch.update(db.collection('tracker_items').doc(id), { status: 'audited', updated_at: new Date().toISOString() })\n  );\n  await batch.commit();\n  console.log('FORGE: ${docIds.length} items → audited');\n})();\n"`
    md += '\n```\n'
    md += `\n> **Confirmed** status is set by JDM in FORGE after visual verification.\n`
    md += `\n---\n`
    md += `\n#LetsAuditTheBuild\n`

    res.json(successResponse<unknown>({ prompt: md }))
  } catch (err) {
    console.error('GET /api/sprints/:id/audit error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})


// POST /:id/audit-rounds — create a new audit round from failed items
sprintRoutes.post('/:id/audit-rounds', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
    const now = new Date().toISOString()

    const sprintDoc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!sprintDoc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    // Get all items in this sprint
    const allSnap = await db.collection(TRACKER_COLLECTION).orderBy('item_id', 'asc').get()
    const sprintDocs = allSnap.docs.filter(d => d.data().sprint_id === id && !['deferred', 'wont_fix'].includes(d.data().status as string))

    // Find items that failed audit
    const failedDocs = sprintDocs.filter(d => d.data().audit_status === 'failed')

    if (failedDocs.length === 0) {
      res.status(400).json(errorResponse('No failed audit items found in this sprint'))
      return
    }

    // Determine current round and new round number
    const rounds = sprintDocs.map(d => (d.data().audit_round as number) || 1)
    const currentRound = Math.max(...rounds)
    const newRound = currentRound + 1

    // Batch update: increment audit_round and reset audit_status to 'pending' for failed items
    const batch = db.batch()
    for (const doc of failedDocs) {
      batch.update(doc.ref, {
        audit_round: newRound,
        audit_status: 'pending',
        audit_notes: '',
        updated_at: now,
        _updated_by: userEmail,
      })
    }
    await batch.commit()

    // Return updated items
    const updatedItems = await Promise.all(
      failedDocs.map(async (doc) => {
        const updated = await doc.ref.get()
        return stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)
      })
    )

    res.json(successResponse<unknown>({
      new_round: newRound,
      previous_round: currentRound,
      items: updatedItems,
      item_count: updatedItems.length,
    }))
  } catch (err) {
    console.error('POST /api/sprints/:id/audit-rounds error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// GET /:id — single sprint
sprintRoutes.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const doc = await db.collection(SPRINT_COLLECTION).doc(id).get()
    if (!doc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }
    res.json(successResponse<unknown>(stripInternalFields({ id: doc.id, ...doc.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('GET /api/sprints/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// PATCH /:id — partial update sprint
sprintRoutes.patch('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(SPRINT_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    const updates = {
      ...req.body,
      updated_at: new Date().toISOString(),
      _updated_by: (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api',
    }
    delete updates.id
    delete updates.created_at

    await docRef.update(updates)
    const updated = await docRef.get()
    res.json(successResponse<unknown>(stripInternalFields({ id: updated.id, ...updated.data() } as Record<string, unknown>)))
  } catch (err) {
    console.error('PATCH /api/sprints/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// DELETE /:id — delete sprint + unassign items
sprintRoutes.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const id = param(req.params.id)
    const docRef = db.collection(SPRINT_COLLECTION).doc(id)
    const doc = await docRef.get()
    if (!doc.exists) { res.status(404).json(errorResponse('Sprint not found')); return }

    // Unassign all tracker items that belong to this sprint
    const allItemsSnap = await db.collection(TRACKER_COLLECTION).get()
    const itemsSnap = { empty: true as boolean, size: 0, docs: allItemsSnap.docs.filter(d => d.data().sprint_id === id) }
    itemsSnap.size = itemsSnap.docs.length
    itemsSnap.empty = itemsSnap.docs.length === 0
    if (!itemsSnap.empty) {
      const batch = db.batch()
      const now = new Date().toISOString()
      const userEmail = (req as unknown as Record<string, unknown> & { user?: { email?: string } }).user?.email || 'api'
      for (const itemDoc of itemsSnap.docs) {
        batch.update(itemDoc.ref, {
          sprint_id: null,
          updated_at: now,
          _updated_by: userEmail,
        })
      }
      await batch.commit()
    }

    await docRef.delete()
    res.json(successResponse<unknown>({ deleted: id, unassigned_items: itemsSnap.size }))
  } catch (err) {
    console.error('DELETE /api/sprints/:id error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
