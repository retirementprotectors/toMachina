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

  // ── Output ──
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2))

  // Console summary
  const statuses = Object.values(result).reduce(
    (acc, w) => { acc[w.status] = (acc[w.status] || 0) + 1; return acc },
    {} as Record<string, number>,
  )

  console.log('─── Collection Wiring Summary ───\n')

  for (const [collName, w] of Object.entries(result)) {
    const icon = w.status === 'full_stack' ? 'FULL'
      : w.status === 'backend_only' ? 'BACK'
      : w.status === 'frontend_only' ? 'FRNT'
      : 'NONE'
    const flags = [
      w.hardcoded ? 'hardcoded' : '',
      w.sub_collection ? 'sub-collection' : '',
      w.portals.length > 0 ? `portals: ${w.portals.join(',')}` : '',
      w.fk_to.length > 0 ? `FK→ ${w.fk_to.join(',')}` : '',
    ].filter(Boolean).join(' | ')

    const be = w.backend_routes.map(r => `${r.file}(${r.operations.join('/')})`).join(', ') || '—'
    const fe = w.frontend_components.map(r => r.file).join(', ') || '—'

    console.log(`  ${icon.padEnd(5)} ${collName}`)
    console.log(`        BE: ${be}`)
    console.log(`        FE: ${fe}`)
    if (flags) console.log(`        ${flags}`)
    console.log()
  }

  console.log(`\nTotals: ${Object.keys(result).length} collections | ${statuses.full_stack || 0} full-stack | ${statuses.backend_only || 0} backend-only | ${statuses.frontend_only || 0} frontend-only | ${statuses.none || 0} not wired`)
  console.log(`Wrote ${OUTPUT}`)
}

main()
