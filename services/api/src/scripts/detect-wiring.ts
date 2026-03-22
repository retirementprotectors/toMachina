/**
 * detect-wiring.ts — Auto-detect collection wiring status at build time.
 *
 * Phase 1: Enhanced detection (collectionGroup, client-side Firestore, hardcoded configs)
 * Phase 2: Flow tracing (Component → API Endpoint → Firestore Collection)
 * Phase 3: Dependency graph (FK references, read/write classification, portal mapping)
 *
 * Run: npx tsx services/api/src/scripts/detect-wiring.ts
 * Runs automatically as part of API build (pre-build hook).
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..', '..', '..', '..')
const API_ROUTES = path.join(ROOT, 'services', 'api', 'src', 'routes')
const UI_MODULES = path.join(ROOT, 'packages', 'ui', 'src', 'modules')
const PORTAL_APPS = path.join(ROOT, 'apps')
const OUTPUT = path.join(ROOT, 'services', 'api', 'src', 'generated', 'wiring-status.json')

/* ═══ Types ═══ */

interface RouteRef {
  file: string
  endpoints: number
  reads: boolean
  writes: boolean
  operations: string[] // ['list', 'get', 'create', 'update', 'delete']
}

interface FrontendRef {
  file: string
  api_calls: string[]    // ['/api/acf/config', '/api/acf/audit']
  direct_firestore: boolean
}

interface CollectionWiring {
  // Backward-compatible fields (Phase 0 — old format)
  status: 'full_stack' | 'backend_only' | 'frontend_only' | 'none'
  backend: string
  frontend: string
  backend_endpoints: number

  // Phase 1: Enhanced detection
  hardcoded: boolean           // Data is in code constants, not Firestore
  sub_collection: boolean      // Accessed via collectionGroup()

  // Phase 2: Flow tracing
  backend_routes: RouteRef[]
  frontend_components: FrontendRef[]
  portals: string[]            // ['prodash', 'riimo', 'sentinel']

  // Phase 3: Dependency graph
  fk_to: string[]              // Collections this one references (outbound FK)
  fk_from: string[]            // Collections that reference this one (inbound FK)
  flow_paths: string[]         // ['ACFAuditAdmin.tsx → /api/acf/* → acf_config']
}

/* ═══ Helpers ═══ */

function scanDir(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...scanDir(full, ext))
    else if (entry.name.endsWith(ext)) files.push(full)
  }
  return files
}

/** Extract all collection() and collectionGroup() references */
function findAllCollections(content: string): Array<{ name: string; group: boolean }> {
  const results: Array<{ name: string; group: boolean }> = []
  const re = /(?:collection|collectionGroup)\(['"]([a-z_]+)['"]\)/g
  let m
  while ((m = re.exec(content)) !== null) {
    results.push({ name: m[1], group: m[0].startsWith('collectionGroup') })
  }
  return results
}

/** Classify route operations from handler methods */
function classifyOperations(content: string, collName: string): { endpoints: number; reads: boolean; writes: boolean; operations: string[] } {
  const ops: string[] = []
  let endpoints = 0

  // Count HTTP method handlers
  const getCount = (content.match(/\.get\s*\(/g) || []).length
  const postCount = (content.match(/\.post\s*\(/g) || []).length
  const putCount = (content.match(/\.put\s*\(/g) || []).length
  const patchCount = (content.match(/\.patch\s*\(/g) || []).length
  const deleteCount = (content.match(/\.delete\s*\(/g) || []).length

  endpoints = getCount + postCount + putCount + patchCount + deleteCount

  if (getCount > 0) ops.push('list', 'get')
  if (postCount > 0) ops.push('create')
  if (putCount > 0 || patchCount > 0) ops.push('update')
  if (deleteCount > 0) ops.push('delete')

  // Detect reads vs writes by looking for Firestore methods near the collection name
  const reads = content.includes('.get(') || content.includes('.orderBy(') || content.includes('.where(')
  const writes = content.includes('.set(') || content.includes('.update(') || content.includes('.add(') ||
    content.includes('.delete()') || content.includes('batch.update') || content.includes('batch.set') ||
    content.includes('batch.delete')

  return { endpoints, reads, writes, operations: [...new Set(ops)] }
}

/** Extract API fetch calls from frontend code */
function extractApiCalls(content: string): string[] {
  const calls: string[] = []
  const re = /fetchWithAuth\s*\(\s*[`'"]([^`'"]+)[`'"]/g
  let m
  while ((m = re.exec(content)) !== null) {
    // Normalize: strip template literal expressions, keep the base path
    const normalized = m[1].replace(/\$\{[^}]+\}/g, '*')
    calls.push(normalized)
  }
  return [...new Set(calls)]
}

/** Detect FK references between collections (field names ending in _id that match collection names) */
function detectFKReferences(allCollections: Set<string>, content: string, thisCollection: string): string[] {
  const fks: string[] = []
  // Common FK patterns: client_id → clients, household_id → households, territory_id → territories
  for (const coll of allCollections) {
    if (coll === thisCollection) continue
    // Singular form: territories → territory_id
    const singular = coll.endsWith('ies')
      ? coll.slice(0, -3) + 'y'
      : coll.endsWith('s')
        ? coll.slice(0, -1)
        : coll
    const fkField = `${singular}_id`
    // Also check: {collection}_id (e.g., sprint_id, session_id)
    const altFkField = `${coll.replace(/s$/, '')}_id`

    if (content.includes(`'${fkField}'`) || content.includes(`"${fkField}"`) ||
        content.includes(`'${altFkField}'`) || content.includes(`"${altFkField}"`)) {
      fks.push(coll)
    }
  }
  return [...new Set(fks)]
}

/** Determine which portals use a given UI component */
function findPortals(componentFile: string, portalFiles: Map<string, string>): string[] {
  const portals: string[] = []
  const componentName = path.basename(componentFile, path.extname(componentFile))

  for (const [filePath, content] of portalFiles) {
    // Check for import of the component
    if (content.includes(componentName)) {
      const portalMatch = filePath.match(/apps\/(\w+)\//)
      if (portalMatch && !portals.includes(portalMatch[1])) {
        portals.push(portalMatch[1])
      }
    }
  }
  return portals.sort()
}

/* ═══ Main ═══ */

function main() {
  console.log('Detecting collection wiring status (Phase 1/2/3)...\n')

  // ── Load all source files ──
  const routeFiles = new Map<string, string>()
  for (const f of scanDir(API_ROUTES, '.ts')) {
    if (path.basename(f) === 'firestore-config.ts') continue
    routeFiles.set(f, fs.readFileSync(f, 'utf-8'))
  }

  const uiFiles = new Map<string, string>()
  for (const f of [...scanDir(UI_MODULES, '.tsx'), ...scanDir(UI_MODULES, '.ts')]) {
    uiFiles.set(f, fs.readFileSync(f, 'utf-8'))
  }

  const portalFiles = new Map<string, string>()
  for (const portal of ['prodash', 'riimo', 'sentinel']) {
    const pagesDir = path.join(PORTAL_APPS, portal, 'app', '(portal)')
    for (const f of scanDir(pagesDir, '.tsx')) {
      portalFiles.set(f, fs.readFileSync(f, 'utf-8'))
    }
  }

  console.log(`Scanned: ${routeFiles.size} API routes, ${uiFiles.size} UI modules, ${portalFiles.size} portal pages\n`)

  // ── Phase 1: Auto-discover ALL collections ──
  const allCollections = new Set<string>()
  const collectionIsGroup = new Map<string, boolean>()

  for (const [, content] of routeFiles) {
    for (const ref of findAllCollections(content)) {
      allCollections.add(ref.name)
      if (ref.group) collectionIsGroup.set(ref.name, true)
    }
  }
  // Also check for hardcoded constant patterns (e.g., WIRE_DEFINITIONS = [...])
  const hardcodedCollections = new Set<string>()
  for (const [, content] of routeFiles) {
    const constRe = /const\s+([A-Z_]+)\s*(?::\s*[^=]+)?\s*=\s*\[/g
    let cm
    while ((cm = constRe.exec(content)) !== null) {
      const constName = cm[1].toLowerCase()
      // If the constant name matches a known pattern, flag it
      if (constName.includes('definition') || constName.includes('registry') || constName.includes('format')) {
        hardcodedCollections.add(constName)
      }
    }
  }

  console.log(`Found ${allCollections.size} collections referenced in API routes`)
  console.log(`Found ${hardcodedCollections.size} hardcoded constants\n`)

  // ── Phase 2: Build route → collection mapping ──
  const routeToCollections = new Map<string, string[]>()
  const collectionToRoutes = new Map<string, RouteRef[]>()

  for (const [filePath, content] of routeFiles) {
    const fileName = path.basename(filePath)
    const refs = findAllCollections(content).map(r => r.name)
    const uniqueRefs = [...new Set(refs)]
    routeToCollections.set(fileName, uniqueRefs)

    for (const collName of uniqueRefs) {
      const ops = classifyOperations(content, collName)
      const routeRef: RouteRef = {
        file: fileName,
        endpoints: ops.endpoints,
        reads: ops.reads,
        writes: ops.writes,
        operations: ops.operations,
      }

      const existing = collectionToRoutes.get(collName) || []
      existing.push(routeRef)
      collectionToRoutes.set(collName, existing)
    }
  }

  // ── Phase 2: Build frontend → collection mapping ──
  const collectionToFrontend = new Map<string, FrontendRef[]>()

  for (const [filePath, content] of uiFiles) {
    const fileName = path.basename(filePath)
    if (fileName === 'FirestoreConfig.tsx' || fileName === 'fetchWithAuth.ts') continue

    const apiCalls = extractApiCalls(content)
    const directRefs = findAllCollections(content)

    // For each collection, check if this component uses it
    for (const collName of allCollections) {
      const searchTerms = [
        collName,
        collName.replace(/_/g, '-'),
        collName.replace(/_config$/, ''),
        collName.replace(/_/g, ''),
      ]

      let isConsumer = false
      const matchedCalls: string[] = []

      // Check API fetch calls
      for (const call of apiCalls) {
        for (const term of searchTerms) {
          if (call.includes(`/api/${term}`) || call.includes(`/api/${term.replace(/_/g, '-')}`)) {
            isConsumer = true
            matchedCalls.push(call)
          }
        }
      }

      // Check direct Firestore refs
      const hasDirect = directRefs.some(r => r.name === collName)
      if (hasDirect) isConsumer = true

      if (isConsumer) {
        const ref: FrontendRef = {
          file: fileName,
          api_calls: matchedCalls,
          direct_firestore: hasDirect,
        }
        const existing = collectionToFrontend.get(collName) || []
        existing.push(ref)
        collectionToFrontend.set(collName, existing)
      }
    }
  }

  // ── Phase 3: Build dependency graph + flow paths ──
  const result: Record<string, CollectionWiring> = {}

  for (const collName of [...allCollections].sort()) {
    const backendRoutes = collectionToRoutes.get(collName) || []
    const frontendComponents = collectionToFrontend.get(collName) || []
    const isGroup = collectionIsGroup.get(collName) || false
    const isHardcoded = hardcodedCollections.has(collName)

    // Detect FK references from route files that touch this collection
    const fkTo: string[] = []
    for (const route of backendRoutes) {
      const routeContent = [...routeFiles.entries()].find(([p]) => path.basename(p) === route.file)?.[1]
      if (routeContent) {
        fkTo.push(...detectFKReferences(allCollections, routeContent, collName))
      }
    }

    // Find which portals use the frontend components
    const portals: string[] = []
    for (const comp of frontendComponents) {
      const compPath = [...uiFiles.keys()].find(p => path.basename(p) === comp.file)
      if (compPath) {
        portals.push(...findPortals(compPath, portalFiles))
      }
    }
    // Also check portal pages directly
    for (const [filePath, content] of portalFiles) {
      const searchTerms = [collName, collName.replace(/_/g, '-'), collName.replace(/_config$/, '')]
      for (const term of searchTerms) {
        if (content.includes(`/api/${term}`) || content.includes(`'${collName}'`)) {
          const portalMatch = filePath.match(/apps\/(\w+)\//)
          if (portalMatch && !portals.includes(portalMatch[1])) {
            portals.push(portalMatch[1])
          }
        }
      }
    }

    // Build flow paths (Component → API → Collection)
    const flowPaths: string[] = []
    for (const comp of frontendComponents) {
      const routes = backendRoutes.map(r => r.file).join(', ')
      if (routes) {
        flowPaths.push(`${comp.file} → ${routes} → ${collName}`)
      } else if (comp.direct_firestore) {
        flowPaths.push(`${comp.file} → [direct Firestore] → ${collName}`)
      }
    }

    // Determine status
    const hasBackend = backendRoutes.length > 0
    const hasFrontend = frontendComponents.length > 0
    let status: CollectionWiring['status']
    if (hasBackend && hasFrontend) status = 'full_stack'
    else if (hasBackend) status = 'backend_only'
    else if (hasFrontend) status = 'frontend_only'
    else status = 'none'

    result[collName] = {
      // Backward-compatible
      status,
      backend: backendRoutes[0]?.file || '',
      frontend: frontendComponents[0]?.file || '',
      backend_endpoints: backendRoutes.reduce((sum, r) => sum + r.endpoints, 0),
      // Phase 1
      hardcoded: isHardcoded,
      sub_collection: isGroup,
      // Phase 2
      backend_routes: backendRoutes,
      frontend_components: frontendComponents,
      portals: [...new Set(portals)].sort(),
      // Phase 3
      fk_to: [...new Set(fkTo)].sort(),
      fk_from: [], // Populated in second pass
      flow_paths: flowPaths,
    }
  }

  // Second pass: populate fk_from (reverse FK references)
  for (const [collName, wiring] of Object.entries(result)) {
    for (const target of wiring.fk_to) {
      if (result[target]) {
        result[target].fk_from.push(collName)
      }
    }
  }
  // Dedupe fk_from
  for (const wiring of Object.values(result)) {
    wiring.fk_from = [...new Set(wiring.fk_from)].sort()
  }

  // ══════════════════════════════════════════════════════════════
  // ASSET 2: API Routes Inventory
  // ══════════════════════════════════════════════════════════════
  console.log('\n─── Scanning API Routes ───\n')

  interface ApiRouteInfo {
    file: string
    endpoints: number
    operations: string[]
    collections: string[]
    frontend_consumers: string[]
    status: 'full_stack' | 'backend_only'
  }

  const apiRoutes: Record<string, ApiRouteInfo> = {}

  for (const [filePath, content] of routeFiles) {
    const fileName = path.basename(filePath)
    const refs = findAllCollections(content).map(r => r.name)
    const ops = classifyOperations(content, '')

    // Find frontend consumers — any UI file that calls /api/{route-name-prefix}
    const routePrefix = fileName.replace(/\.ts$/, '').replace(/-/g, '')
    const consumers: string[] = []
    for (const [uiPath, uiContent] of uiFiles) {
      const uiName = path.basename(uiPath)
      if (uiName === 'FirestoreConfig.tsx' || uiName === 'fetchWithAuth.ts') continue
      const apiCalls = extractApiCalls(uiContent)
      // Match route file to API path: cam.ts → /api/cam, campaign-send.ts → /api/campaign-send
      const routeSlug = fileName.replace(/\.ts$/, '')
      if (apiCalls.some(c => c.includes(`/api/${routeSlug}`) || c.includes(`/api/${routeSlug}/`))) {
        consumers.push(uiName)
      }
    }

    apiRoutes[fileName] = {
      file: fileName,
      endpoints: ops.endpoints,
      operations: ops.operations,
      collections: [...new Set(refs)],
      frontend_consumers: [...new Set(consumers)],
      status: consumers.length > 0 ? 'full_stack' : 'backend_only',
    }

    const icon = consumers.length > 0 ? 'WIRED' : 'ORPHN'
    console.log(`  ${icon.padEnd(6)} ${fileName.padEnd(28)} ${ops.endpoints} endpoints | ${consumers.length > 0 ? consumers.join(', ') : '(no UI)'}`)
  }

  // ══════════════════════════════════════════════════════════════
  // ASSET 3: Cloud Functions Inventory
  // ══════════════════════════════════════════════════════════════
  console.log('\n─── Scanning Cloud Functions ───\n')

  interface CloudFunctionInfo {
    name: string
    type: 'http' | 'scheduled' | 'firestore_trigger' | 'unknown'
    schedule?: string
    region: string
    memory: string
    timeout: number
    source_file: string
    description: string
  }

  const cloudFunctions: CloudFunctionInfo[] = []
  const intakeIndex = path.join(ROOT, 'services', 'intake', 'src', 'index.ts')
  if (fs.existsSync(intakeIndex)) {
    const intakeContent = fs.readFileSync(intakeIndex, 'utf-8')

    // Scan onRequest exports
    const httpRe = /export\s+const\s+(\w+)\s*=\s*onRequest\s*\(\s*\{([^}]+)\}/g
    let hm
    while ((hm = httpRe.exec(intakeContent)) !== null) {
      const name = hm[1]
      const opts = hm[2]
      const region = opts.match(/region:\s*'([^']+)'/)?.[1] || 'us-central1'
      const memory = opts.match(/memory:\s*'([^']+)'/)?.[1] || '256MiB'
      const timeout = parseInt(opts.match(/timeoutSeconds:\s*(\d+)/)?.[1] || '60')
      cloudFunctions.push({ name, type: 'http', region, memory, timeout, source_file: 'index.ts', description: '' })
    }

    // Scan onSchedule exports
    const schedRe = /export\s+const\s+(\w+)\s*=\s*onSchedule\s*\(\s*\{([^}]+)\}/g
    let sm
    while ((sm = schedRe.exec(intakeContent)) !== null) {
      const name = sm[1]
      const opts = sm[2]
      const schedule = opts.match(/schedule:\s*'([^']+)'/)?.[1] || ''
      const region = opts.match(/region:\s*'([^']+)'/)?.[1] || 'us-central1'
      const memory = opts.match(/memory:\s*'([^']+)'/)?.[1] || '256MiB'
      const timeout = parseInt(opts.match(/timeoutSeconds:\s*(\d+)/)?.[1] || '60')
      cloudFunctions.push({ name, type: 'scheduled', schedule, region, memory, timeout, source_file: 'index.ts', description: '' })
    }

    // Scan re-exported Firestore triggers
    if (intakeContent.includes('onClientWrite')) {
      cloudFunctions.push({ name: 'onClientWrite', type: 'firestore_trigger', region: 'us-central1', memory: '256MiB', timeout: 60, source_file: 'notification-triggers.ts', description: 'Creates notification on client write' })
    }
    if (intakeContent.includes('onAccountWrite')) {
      cloudFunctions.push({ name: 'onAccountWrite', type: 'firestore_trigger', region: 'us-central1', memory: '256MiB', timeout: 60, source_file: 'notification-triggers.ts', description: 'Creates notification on account write' })
    }
    if (intakeContent.includes('onIntakeQueueCreated')) {
      cloudFunctions.push({ name: 'onIntakeQueueCreated', type: 'firestore_trigger', region: 'us-central1', memory: '256MiB', timeout: 60, source_file: 'wire-trigger.ts', description: 'Processes intake_queue entries through wire executor' })
    }
  }

  for (const fn of cloudFunctions) {
    const icon = fn.type === 'scheduled' ? 'SCHED' : fn.type === 'http' ? 'HTTP ' : 'TRIGG'
    console.log(`  ${icon} ${fn.name.padEnd(30)} ${fn.schedule || fn.type.padEnd(15)} ${fn.memory} ${fn.timeout}s`)
  }

  // ══════════════════════════════════════════════════════════════
  // ASSET 4: Environment Variables Inventory
  // ══════════════════════════════════════════════════════════════
  console.log('\n─── Scanning Environment Variables ───\n')

  interface EnvVarInfo {
    name: string
    services: string[]
    has_value: boolean
    source: string // 'env_example' | 'dockerfile' | 'code_reference'
    sensitive: boolean
  }

  const envVars: Record<string, EnvVarInfo> = {}

  // Scan .env.example for declared vars
  const envExample = path.join(ROOT, '.env.example')
  if (fs.existsSync(envExample)) {
    const lines = fs.readFileSync(envExample, 'utf-8').split('\n')
    for (const line of lines) {
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=/)
      if (match) {
        const name = match[1]
        const sensitive = /KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL/i.test(name)
        envVars[name] = { name, services: ['root'], has_value: line.includes('=') && line.split('=')[1]?.trim() !== '', source: 'env_example', sensitive }
      }
    }
  }

  // Scan Dockerfiles for ENV and ARG
  const dockerfiles = [
    { file: path.join(ROOT, 'services', 'api', 'Dockerfile'), service: 'api' },
    { file: path.join(ROOT, 'services', 'bridge', 'Dockerfile'), service: 'bridge' },
    { file: path.join(ROOT, 'apps', 'prodash', 'Dockerfile'), service: 'prodash' },
    { file: path.join(ROOT, 'apps', 'riimo', 'Dockerfile'), service: 'riimo' },
    { file: path.join(ROOT, 'apps', 'sentinel', 'Dockerfile'), service: 'sentinel' },
  ]
  for (const { file, service } of dockerfiles) {
    if (!fs.existsSync(file)) continue
    const content = fs.readFileSync(file, 'utf-8')
    const envRe = /^(?:ENV|ARG)\s+([A-Z_][A-Z0-9_]*)/gm
    let em
    while ((em = envRe.exec(content)) !== null) {
      const name = em[1]
      if (envVars[name]) {
        if (!envVars[name].services.includes(service)) envVars[name].services.push(service)
      } else {
        envVars[name] = { name, services: [service], has_value: false, source: 'dockerfile', sensitive: /KEY|SECRET|TOKEN|PASSWORD/i.test(name) }
      }
    }
  }

  // Scan code for process.env references
  for (const [filePath, content] of routeFiles) {
    const envRefs = content.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)
    for (const ref of envRefs) {
      const name = ref[1]
      const service = filePath.includes('/api/') ? 'api' : filePath.includes('/bridge/') ? 'bridge' : 'unknown'
      if (envVars[name]) {
        if (!envVars[name].services.includes(service)) envVars[name].services.push(service)
      } else {
        envVars[name] = { name, services: [service], has_value: false, source: 'code_reference', sensitive: /KEY|SECRET|TOKEN|PASSWORD/i.test(name) }
      }
    }
  }

  const envList = Object.values(envVars).sort((a, b) => a.name.localeCompare(b.name))
  for (const ev of envList) {
    const icon = ev.sensitive ? 'SECRET' : ev.has_value ? 'SET   ' : 'EMPTY '
    console.log(`  ${icon} ${ev.name.padEnd(42)} ${ev.services.join(', ')}`)
  }

  // ══════════════════════════════════════════════════════════════
  // ASSET 5: Hookify Rules Inventory
  // ══════════════════════════════════════════════════════════════
  console.log('\n─── Scanning Hookify Rules ───\n')

  interface HookifyRuleInfo {
    name: string
    enabled: boolean
    event: string
    action: string
    tier: 'block' | 'warn' | 'intent' | 'quality_gate' | 'unknown'
    description: string
  }

  const hookifyRules: HookifyRuleInfo[] = []
  const hookifyDir = path.join(ROOT, '.claude')
  if (fs.existsSync(hookifyDir)) {
    const ruleFiles2 = fs.readdirSync(hookifyDir).filter(f => f.startsWith('hookify.') && f.endsWith('.local.md'))
    for (const ruleFile of ruleFiles2) {
      const content = fs.readFileSync(path.join(hookifyDir, ruleFile), 'utf-8')
      const frontmatter = content.match(/^---\n([\s\S]*?)\n---/)?.[1] || ''
      const name = frontmatter.match(/name:\s*(.+)/)?.[1]?.trim() || ruleFile
      const enabled = frontmatter.match(/enabled:\s*(.+)/)?.[1]?.trim() !== 'false'
      const event = frontmatter.match(/event:\s*(.+)/)?.[1]?.trim() || 'unknown'
      const action = frontmatter.match(/action:\s*(.+)/)?.[1]?.trim() || 'unknown'

      // Determine tier from name
      let tier: HookifyRuleInfo['tier'] = 'unknown'
      if (name.startsWith('block-')) tier = 'block'
      else if (name.startsWith('warn-')) tier = 'warn'
      else if (name.startsWith('intent-')) tier = 'intent'
      else if (name.startsWith('quality-gate-')) tier = 'quality_gate'

      // Get first line of body as description
      const body = content.split('---').slice(2).join('---').trim()
      const firstLine = body.split('\n').find(l => l.trim() && !l.startsWith('#'))?.replace(/\*\*/g, '').trim() || ''

      hookifyRules.push({ name, enabled, event, action, tier, description: firstLine.slice(0, 100) })
    }
  }

  hookifyRules.sort((a, b) => {
    const tierOrder: Record<string, number> = { block: 0, warn: 1, intent: 2, quality_gate: 3, unknown: 4 }
    return (tierOrder[a.tier] || 4) - (tierOrder[b.tier] || 4) || a.name.localeCompare(b.name)
  })

  for (const rule of hookifyRules) {
    const icon = rule.tier === 'block' ? 'BLOCK' : rule.tier === 'warn' ? 'WARN ' : rule.tier === 'intent' ? 'INTNT' : rule.tier === 'quality_gate' ? 'GATE ' : '?????'
    const status = rule.enabled ? 'ON ' : 'OFF'
    console.log(`  ${icon} ${status} ${rule.name.padEnd(40)} ${rule.event}/${rule.action}`)
  }

  // ══════════════════════════════════════════════════════════════
  // COMBINED OUTPUT
  // ══════════════════════════════════════════════════════════════

  const fullOutput = {
    collections: result,
    api_routes: apiRoutes,
    cloud_functions: cloudFunctions,
    env_vars: envList,
    hookify_rules: hookifyRules,
    scan_stats: {
      route_files: routeFiles.size,
      ui_files: uiFiles.size,
      portal_pages: portalFiles.size,
      collections_found: Object.keys(result).length,
      api_routes_found: Object.keys(apiRoutes).length,
      cloud_functions_found: cloudFunctions.length,
      env_vars_found: envList.length,
      hookify_rules_found: hookifyRules.length,
      scanned_at: new Date().toISOString(),
    },
  }

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, JSON.stringify(fullOutput, null, 2))

  // Console summary
  const statuses = Object.values(result).reduce(
    (acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc },
    {} as Record<string, number>,
  )

  const routeStatuses = Object.values(apiRoutes).reduce(
    (acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc },
    {} as Record<string, number>,
  )

  console.log('\n═══ Platform Scan Summary ═══')
  console.log(`  Collections: ${Object.keys(result).length} (${statuses.full_stack || 0} full-stack, ${statuses.backend_only || 0} backend-only, ${statuses.none || 0} unwired)`)
  console.log(`  API Routes:  ${Object.keys(apiRoutes).length} (${routeStatuses.full_stack || 0} with UI, ${routeStatuses.backend_only || 0} orphaned)`)
  console.log(`  Functions:   ${cloudFunctions.length} (${cloudFunctions.filter(f => f.type === 'scheduled').length} scheduled, ${cloudFunctions.filter(f => f.type === 'http').length} HTTP, ${cloudFunctions.filter(f => f.type === 'firestore_trigger').length} triggers)`)
  console.log(`  Env Vars:    ${envList.length} (${envList.filter(e => e.sensitive).length} secrets, ${envList.filter(e => !e.has_value).length} empty)`)
  console.log(`  Hookify:     ${hookifyRules.length} (${hookifyRules.filter(r => r.tier === 'block').length} block, ${hookifyRules.filter(r => r.tier === 'warn').length} warn, ${hookifyRules.filter(r => r.tier === 'intent').length} intent, ${hookifyRules.filter(r => r.tier === 'quality_gate').length} gates)`)
  console.log(`\nWrote ${OUTPUT}`)
}

main()
