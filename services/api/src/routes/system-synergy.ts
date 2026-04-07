/**
 * System Synergy API route — GET /api/system-synergy/{tool-name}
 * ZRD-SYN-006 | Phase 2: Build Tools + Wires
 *
 * 10 atomic tools for platform observability + hygiene.
 * Requires executive-level access.
 */

import { Router, type Request, type Response, type NextFunction } from 'express'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

export const systemSynergyRoutes = Router()

// ─── Auth Guard ───────────────────────────────────────────────────────────────
const ALLOWED_ROLES = ['EXECUTIVE', 'OWNER', 'SUPER_ADMIN']

async function requireExecutive(req: Request, res: Response, next: NextFunction) {
  try {
    const email: string | undefined = (req as unknown as { user?: { email?: string } }).user?.email
    if (!email) {
      res.status(401).json(errorResponse('Authentication required'))
      return
    }
    // Domain-gated: any @retireprotected.com user passes.
    // Module-level access (OWNER) is enforced by the portal UI entitlements.
    if (!email.endsWith('@retireprotected.com')) {
      res.status(403).json(errorResponse('System Synergy requires @retireprotected.com domain'))
      return
    }
    next()
  } catch (err) {
    console.error('[system-synergy] Auth check failed:', err)
    res.status(500).json(errorResponse('Authorization check failed'))
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const HOME = process.env.HOME || '/home/jdm'
const CLAUDE_DIR = path.join(HOME, '.claude')
const WARRIORS_DIR = path.join(HOME, 'Projects', 'dojo-warriors', 'warriors')
const PROJECTS_DIR = path.join(HOME, 'Projects')

function safeReadDir(dir: string): string[] {
  try { return fs.readdirSync(dir) } catch { return [] }
}

function safeReadFile(filePath: string): string | null {
  try { return fs.readFileSync(filePath, 'utf-8') } catch { return null }
}

function safeStat(filePath: string): fs.Stats | null {
  try { return fs.statSync(filePath) } catch { return null }
}

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { timeout, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() } catch { return '' }
}

function lineCount(filePath: string): number {
  const content = safeReadFile(filePath)
  if (!content) return 0
  return content.split('\n').length
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
}

function getDb() { return getFirestore() }

function tsToIso(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString()
  return String(val || '')
}

// ─── Tool 1: session-inventory ────────────────────────────────────────────────
systemSynergyRoutes.get('/session-inventory', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const sessionsDir = path.join(CLAUDE_DIR, 'sessions')
    const sessionFiles = safeReadDir(sessionsDir).filter(f => f.endsWith('.json'))

    const sessions = sessionFiles.map(f => {
      const content = safeReadFile(path.join(sessionsDir, f))
      if (!content) return null
      try {
        const data = JSON.parse(content) as Record<string, unknown>
        const sessionId = String(data.sessionId || '')

        let subagentCount = 0
        const projectDirs = safeReadDir(path.join(CLAUDE_DIR, 'projects'))
        for (const projDir of projectDirs) {
          const subagentsDir = path.join(CLAUDE_DIR, 'projects', projDir, sessionId, 'subagents')
          subagentCount += safeReadDir(subagentsDir).length
        }

        return {
          file: f,
          pid: data.pid,
          sessionId,
          cwd: data.cwd,
          startedAt: data.startedAt,
          kind: data.kind,
          name: data.name || null,
          entrypoint: data.entrypoint || null,
          subagentCount,
        }
      } catch { return null }
    }).filter(Boolean)

    const projectDirs = safeReadDir(path.join(CLAUDE_DIR, 'projects'))
    let totalJsonl = 0
    for (const projDir of projectDirs) {
      const projPath = path.join(CLAUDE_DIR, 'projects', projDir)
      totalJsonl += safeReadDir(projPath).filter(f => f.endsWith('.jsonl')).length
    }

    res.json(successResponse({
      active_sessions: sessions,
      total_jsonl_transcripts: totalJsonl,
      session_count: sessions.length,
    }))
  } catch (err) {
    console.error('[system-synergy] session-inventory failed:', err)
    res.status(500).json(errorResponse('Failed to inventory sessions'))
  }
})

// ─── Tool 2: memory-inventory ─────────────────────────────────────────────────
systemSynergyRoutes.get('/memory-inventory', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects')
    const projectDirs = safeReadDir(projectsDir)

    const projects = projectDirs.map(projDir => {
      const memoryDir = path.join(projectsDir, projDir, 'memory')
      const indexContent = safeReadFile(path.join(memoryDir, 'MEMORY.md'))
      if (!indexContent) return null

      const memoryFiles = safeReadDir(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
      const entries = memoryFiles.map(f => {
        const filePath = path.join(memoryDir, f)
        const stat = safeStat(filePath)
        const content = safeReadFile(filePath)
        const frontmatter = content?.match(/^---\n([\s\S]*?)\n---/)
        let type = 'unknown'
        let name = f.replace('.md', '')
        if (frontmatter) {
          const typeMatch = frontmatter[1].match(/type:\s*(.+)/)
          const nameMatch = frontmatter[1].match(/name:\s*(.+)/)
          if (typeMatch) type = typeMatch[1].trim()
          if (nameMatch) name = nameMatch[1].trim()
        }
        return {
          file: f,
          name,
          type,
          lines: content ? content.split('\n').length : 0,
          last_modified: stat?.mtime?.toISOString() || null,
          days_stale: stat ? daysSince(stat.mtime) : null,
        }
      })

      return {
        project: projDir,
        index_lines: indexContent.split('\n').length,
        memory_files: entries.length,
        entries,
      }
    }).filter(Boolean)

    const totalEntries = projects.reduce((sum, p) => sum + ((p as { memory_files: number }).memory_files || 0), 0)

    res.json(successResponse({
      projects,
      total_memory_entries: totalEntries,
      project_count: projects.length,
    }))
  } catch (err) {
    console.error('[system-synergy] memory-inventory failed:', err)
    res.status(500).json(errorResponse('Failed to inventory memory'))
  }
})

// ─── Tool 3: claude-md-diff ───────────────────────────────────────────────────
systemSynergyRoutes.get('/claude-md-diff', requireExecutive, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7
    const target = (req.query.target as string) || 'all'

    const claudeMdFiles: Array<{ label: string; filePath: string }> = [
      { label: 'global', filePath: path.join(CLAUDE_DIR, 'CLAUDE.md') },
      { label: 'toMachina', filePath: path.join(PROJECTS_DIR, 'toMachina', 'CLAUDE.md') },
    ]

    if (target !== 'all') {
      const match = claudeMdFiles.find(f => f.label === target)
      if (!match) {
        res.status(400).json(errorResponse(`Unknown target: ${target}. Use 'global', 'toMachina', or 'all'`))
        return
      }
    }

    const diffs = claudeMdFiles
      .filter(f => target === 'all' || f.label === target)
      .map(f => {
        const stat = safeStat(f.filePath)
        const lines = lineCount(f.filePath)
        const dir = path.dirname(f.filePath)
        const basename = path.basename(f.filePath)
        const gitLog = safeExec(`cd "${dir}" && git log --oneline --since="${days} days ago" -- "${basename}" 2>/dev/null`)
        const diffContent = safeExec(`cd "${dir}" && git diff "HEAD~5" -- "${basename}" 2>/dev/null`)

        return {
          label: f.label,
          path: f.filePath,
          lines,
          last_modified: stat?.mtime?.toISOString() || null,
          recent_commits: gitLog ? gitLog.split('\n').filter(Boolean) : [],
          diff_preview: diffContent ? diffContent.slice(0, 2000) : null,
        }
      })

    res.json(successResponse({ diffs, days_queried: days }))
  } catch (err) {
    console.error('[system-synergy] claude-md-diff failed:', err)
    res.status(500).json(errorResponse('Failed to diff CLAUDE.md'))
  }
})

// ─── Tool 4: brain-health ─────────────────────────────────────────────────────
systemSynergyRoutes.get('/brain-health', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const warriorDirs = safeReadDir(WARRIORS_DIR)

    const warriors = warriorDirs
      .filter(d => safeStat(path.join(WARRIORS_DIR, d))?.isDirectory())
      .map(warrior => {
        const wp = path.join(WARRIORS_DIR, warrior)
        const soulStat = safeStat(path.join(wp, 'soul.md'))
        const spiritStat = safeStat(path.join(wp, 'spirit.md'))
        const brainStat = safeStat(path.join(wp, 'brain.txt'))

        const fileInfo = (stat: fs.Stats | null, fp: string) => stat
          ? { exists: true, lines: lineCount(fp), last_modified: stat.mtime.toISOString(), size_kb: Math.round(stat.size / 1024) }
          : { exists: false as const }

        return {
          warrior,
          soul: fileInfo(soulStat, path.join(wp, 'soul.md')),
          spirit: fileInfo(spiritStat, path.join(wp, 'spirit.md')),
          brain: brainStat
            ? { exists: true, lines: lineCount(path.join(wp, 'brain.txt')), last_modified: brainStat.mtime.toISOString(), size_kb: Math.round(brainStat.size / 1024), days_since_update: daysSince(brainStat.mtime) }
            : { exists: false as const },
        }
      })

    const totalBrainLines = warriors.reduce((sum, w) => {
      const brain = w.brain as { exists: boolean; lines?: number }
      return sum + (brain.exists ? (brain.lines || 0) : 0)
    }, 0)

    res.json(successResponse({
      warriors,
      warrior_count: warriors.length,
      total_brain_lines: totalBrainLines,
      warriors_missing_brain: warriors.filter(w => !(w.brain as { exists: boolean }).exists).map(w => w.warrior),
    }))
  } catch (err) {
    console.error('[system-synergy] brain-health failed:', err)
    res.status(500).json(errorResponse('Failed to check brain health'))
  }
})

// ─── Tool 5: knowledge-query ──────────────────────────────────────────────────
systemSynergyRoutes.get('/knowledge-query', requireExecutive, async (req: Request, res: Response) => {
  try {
    const db = getDb()
    const type = req.query.type as string | undefined
    const warrior = req.query.warrior as string | undefined
    const minConfidence = parseFloat(req.query.min_confidence as string) || 0
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)

    let query = db.collection('knowledge_entries').orderBy('created_at', 'desc') as FirebaseFirestore.Query

    if (type) query = query.where('type', '==', type)
    if (warrior) query = query.where('warrior', '==', warrior)
    if (minConfidence > 0) query = query.where('confidence', '>=', minConfidence)

    const snapshot = await query.limit(limit).get()

    const entries = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        type: data.type,
        warrior: data.warrior,
        content: String(data.content || '').slice(0, 500),
        confidence: data.confidence,
        tags: data.tags || [],
        promoted_to_claude_md: data.promoted_to_claude_md || false,
        created_at: tsToIso(data.created_at),
      }
    })

    res.json(successResponse({
      entries,
      count: entries.length,
      filters: { type: type || 'all', warrior: warrior || 'all', min_confidence: minConfidence },
    }))
  } catch (err) {
    console.error('[system-synergy] knowledge-query failed:', err)
    res.status(500).json(errorResponse('Failed to query knowledge entries'))
  }
})

// ─── Tool 6: session-env-audit ────────────────────────────────────────────────
systemSynergyRoutes.get('/session-env-audit', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const sessionEnvDir = path.join(CLAUDE_DIR, 'session-env')
    const envDirs = safeReadDir(sessionEnvDir)

    // Get active session IDs
    const sessionsDir = path.join(CLAUDE_DIR, 'sessions')
    const sessionFiles = safeReadDir(sessionsDir).filter(f => f.endsWith('.json'))
    const activeSessionIds = new Set<string>()
    for (const f of sessionFiles) {
      const content = safeReadFile(path.join(sessionsDir, f))
      if (content) {
        try {
          const data = JSON.parse(content) as { sessionId?: string }
          if (data.sessionId) activeSessionIds.add(data.sessionId)
        } catch { /* skip */ }
      }
    }

    const envEntries = envDirs.map(dir => {
      const dirPath = path.join(sessionEnvDir, dir)
      const stat = safeStat(dirPath)
      const isOrphan = !activeSessionIds.has(dir)
      const daysOld = stat ? daysSince(stat.mtime) : null

      return {
        session_id: dir,
        is_orphan: isOrphan,
        days_old: daysOld,
        last_modified: stat?.mtime?.toISOString() || null,
        auto_delete_eligible: isOrphan && daysOld !== null && daysOld > 30,
      }
    })

    const orphans = envEntries.filter(e => e.is_orphan)
    const deleteEligible = envEntries.filter(e => e.auto_delete_eligible)

    res.json(successResponse({
      total_session_envs: envEntries.length,
      active: envEntries.length - orphans.length,
      orphaned: orphans.length,
      auto_delete_eligible: deleteEligible.length,
      orphans: orphans.slice(0, 50),
    }))
  } catch (err) {
    console.error('[system-synergy] session-env-audit failed:', err)
    res.status(500).json(errorResponse('Failed to audit session environments'))
  }
})

// ─── Tool 7: duplicate-detector ───────────────────────────────────────────────
systemSynergyRoutes.get('/duplicate-detector', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const projectsDir = path.join(CLAUDE_DIR, 'projects')
    const projectDirs = safeReadDir(projectsDir)

    const allEntries: Array<{ project: string; file: string; name: string; type: string }> = []

    for (const projDir of projectDirs) {
      const memoryDir = path.join(projectsDir, projDir, 'memory')
      const memoryFiles = safeReadDir(memoryDir).filter(f => f.endsWith('.md') && f !== 'MEMORY.md')

      for (const f of memoryFiles) {
        const content = safeReadFile(path.join(memoryDir, f))
        if (!content) continue
        const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)
        let type = 'unknown'
        let name = f.replace('.md', '')
        if (frontmatter) {
          const typeMatch = frontmatter[1].match(/type:\s*(.+)/)
          const nameMatch = frontmatter[1].match(/name:\s*(.+)/)
          if (typeMatch) type = typeMatch[1].trim()
          if (nameMatch) name = nameMatch[1].trim()
        }
        allEntries.push({ project: projDir, file: f, name, type })
      }
    }

    // Detect duplicates by normalized name
    const seen = new Map<string, Array<{ project: string; file: string }>>()
    for (const entry of allEntries) {
      const key = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      const existing = seen.get(key)
      if (existing) {
        existing.push({ project: entry.project, file: entry.file })
      } else {
        seen.set(key, [{ project: entry.project, file: entry.file }])
      }
    }

    const duplicates: Array<{ name: string; entries: Array<{ project: string; file: string }> }> = []
    for (const [name, entries] of seen) {
      if (entries.length > 1) duplicates.push({ name, entries })
    }

    res.json(successResponse({
      total_entries: allEntries.length,
      duplicate_groups: duplicates.length,
      duplicates,
    }))
  } catch (err) {
    console.error('[system-synergy] duplicate-detector failed:', err)
    res.status(500).json(errorResponse('Failed to detect duplicates'))
  }
})

// ─── Tool 8: warrior-roster ───────────────────────────────────────────────────
systemSynergyRoutes.get('/warrior-roster', requireExecutive, async (_req: Request, res: Response) => {
  try {
    // Check tmux sessions
    const tmuxOutput = safeExec('tmux list-sessions -F "#{session_name}:#{session_activity}:#{session_windows}" 2>/dev/null')
    const tmuxSessions = tmuxOutput
      ? tmuxOutput.split('\n').filter(Boolean).map(line => {
          const [name, activity, windows] = line.split(':')
          return {
            name,
            last_activity: activity ? new Date(parseInt(activity) * 1000).toISOString() : null,
            windows: parseInt(windows) || 0,
          }
        })
      : []

    // Check warrior queues via MDJ_SERVER dojo API
    const warriors = ['RONIN', 'RAIDEN', 'MEGAZORD', 'MUSASHI', 'VOLTRON', 'SHINOB1']
    const queueStatus = await Promise.all(
      warriors.map(async warrior => {
        try {
          const response = await fetch(`http://localhost:4200/dojo/queue/${warrior}`, {
            signal: AbortSignal.timeout(3000),
          })
          if (response.ok) {
            const data = await response.json() as { success: boolean; data?: { messages?: unknown[]; last_updated?: string } }
            return {
              warrior,
              queue_depth: data.data?.messages?.length || 0,
              last_queue_update: data.data?.last_updated || null,
              queue_reachable: true,
            }
          }
          return { warrior, queue_depth: 0, last_queue_update: null, queue_reachable: false }
        } catch {
          return { warrior, queue_depth: 0, last_queue_update: null, queue_reachable: false }
        }
      })
    )

    // Warrior file existence
    const warriorDirs = safeReadDir(WARRIORS_DIR).filter(d =>
      safeStat(path.join(WARRIORS_DIR, d))?.isDirectory()
    )

    res.json(successResponse({
      tmux_sessions: tmuxSessions,
      warrior_queues: queueStatus,
      warrior_directories: warriorDirs,
      dojo_api_reachable: queueStatus.some(q => q.queue_reachable),
    }))
  } catch (err) {
    console.error('[system-synergy] warrior-roster failed:', err)
    res.status(500).json(errorResponse('Failed to check warrior roster'))
  }
})

// ─── Tool 9: deploy-status ────────────────────────────────────────────────────
systemSynergyRoutes.get('/deploy-status', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const ghToken = process.env.GITHUB_TOKEN || ''
    const repo = 'retirementprotectors/toMachina'

    let ciRuns: unknown[] = []
    if (ghToken) {
      try {
        const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, {
          headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(5000),
        })
        if (response.ok) {
          const data = await response.json() as { workflow_runs?: Array<Record<string, unknown>> }
          ciRuns = (data.workflow_runs || []).map(run => ({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            branch: run.head_branch,
            created_at: run.created_at,
            updated_at: run.updated_at,
            html_url: run.html_url,
          }))
        }
      } catch { /* GitHub API unavailable */ }
    }

    // Get last deploy from git log
    const lastDeployCommit = safeExec(`cd "${path.join(PROJECTS_DIR, 'toMachina')}" && git log --oneline -1 origin/main 2>/dev/null`)
    const lastDeployTime = safeExec(`cd "${path.join(PROJECTS_DIR, 'toMachina')}" && git log -1 --format="%ci" origin/main 2>/dev/null`)

    res.json(successResponse({
      ci_runs: ciRuns,
      ci_runs_count: ciRuns.length,
      last_main_commit: lastDeployCommit || null,
      last_main_timestamp: lastDeployTime || null,
      github_api_available: ciRuns.length > 0,
    }))
  } catch (err) {
    console.error('[system-synergy] deploy-status failed:', err)
    res.status(500).json(errorResponse('Failed to check deploy status'))
  }
})

// ─── Tool 10: hook-audit ──────────────────────────────────────────────────────
systemSynergyRoutes.get('/hook-audit', requireExecutive, async (_req: Request, res: Response) => {
  try {
    const hookifySource = path.join(PROJECTS_DIR, '_RPI_STANDARDS', 'hookify')
    const sourceRules = safeReadDir(hookifySource).filter(f => f.endsWith('.local.md'))

    const hookifyTargets = [
      { name: 'toMachina', targetPath: path.join(PROJECTS_DIR, 'toMachina', '.claude') },
      { name: 'global', targetPath: path.join(HOME, '.claude') },
    ]

    const projectAudits = hookifyTargets.map(target => {
      const existingRules = safeReadDir(target.targetPath).filter(f => f.endsWith('.local.md'))

      const ruleStatus = sourceRules.map(rule => {
        const rulePath = path.join(target.targetPath, rule)
        const stat = safeStat(rulePath)
        let status: 'linked' | 'missing' | 'broken' = 'missing'

        if (stat) {
          try {
            const linkTarget = fs.readlinkSync(rulePath)
            const resolvedTarget = path.resolve(target.targetPath, linkTarget)
            status = safeStat(resolvedTarget) ? 'linked' : 'broken'
          } catch {
            status = 'linked' // regular file copy, not symlink — still valid
          }
        }

        return { rule, status }
      })

      const linked = ruleStatus.filter(r => r.status === 'linked').length
      const missing = ruleStatus.filter(r => r.status === 'missing').length
      const broken = ruleStatus.filter(r => r.status === 'broken').length

      return {
        project: target.name,
        path: target.targetPath,
        total_source_rules: sourceRules.length,
        linked,
        missing,
        broken,
        extra_rules: existingRules.filter(r => !sourceRules.includes(r)),
        missing_rules: ruleStatus.filter(r => r.status === 'missing').map(r => r.rule),
        broken_rules: ruleStatus.filter(r => r.status === 'broken').map(r => r.rule),
      }
    })

    const allHealthy = projectAudits.every(p => p.missing === 0 && p.broken === 0)

    res.json(successResponse({
      source_rules_count: sourceRules.length,
      projects: projectAudits,
      all_healthy: allHealthy,
    }))
  } catch (err) {
    console.error('[system-synergy] hook-audit failed:', err)
    res.status(500).json(errorResponse('Failed to audit hooks'))
  }
})
