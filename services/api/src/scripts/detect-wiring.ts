/**
 * detect-wiring.ts — Auto-detect collection wiring status at build time.
 * Greps API routes for collection() calls and UI modules for fetch calls.
 * Outputs services/api/src/generated/wiring-status.json
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

// The 12 config collections we care about
const CONFIG_COLLECTIONS = [
  'acf_config', 'spark_config', 'specialist_configs', 'territories',
  'comp_grids', 'comp_grid_history', 'wire_definitions', 'source_registry',
  'tool_registry', 'atlas_formats', 'format_library', 'org',
]

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

function findCollectionRefs(content: string): string[] {
  const matches: string[] = []
  // Match collection('name') or collection("name")
  const re = /collection\(['"]([a-z_]+)['"]\)/g
  let m
  while ((m = re.exec(content)) !== null) {
    matches.push(m[1])
  }
  return matches
}

function findApiRouteForCollection(collName: string, routeFiles: Map<string, string>): { file: string; endpoints: number } | null {
  for (const [filePath, content] of routeFiles) {
    const refs = findCollectionRefs(content)
    if (refs.includes(collName)) {
      // Count route handlers (get, post, put, patch, delete)
      const endpointRe = /\.(get|post|put|patch|delete)\s*\(/g
      let count = 0
      let em
      while ((em = endpointRe.exec(content)) !== null) count++
      return { file: path.basename(filePath), endpoints: count }
    }
  }
  // Also check for hardcoded references like WIRE_DEFINITIONS constant
  for (const [filePath, content] of routeFiles) {
    const snakeUpper = collName.toUpperCase()
    if (content.includes(snakeUpper) || content.includes(`'${collName}'`) || content.includes(`"${collName}"`)) {
      return { file: path.basename(filePath), endpoints: 0 }
    }
  }
  return null
}

function findFrontendUsage(collName: string, uiFiles: Map<string, string>, portalFiles: Map<string, string>): { file: string } | null {
  // Look for API fetch calls that correspond to this collection's route
  // e.g., fetchWithAuth('/api/acf/config') for acf_config
  // or direct collection references, or component imports
  const searchTerms = [
    collName,
    collName.replace(/_/g, '-'),
    collName.replace(/_config$/, ''),
    collName.replace(/_/g, ''),
  ]

  for (const [filePath, content] of uiFiles) {
    const fileName = path.basename(filePath)
    // Skip the FirestoreConfig module itself — that's the generic viewer, not a dedicated wiring
    if (fileName === 'FirestoreConfig.tsx') continue
    // Skip fetchWithAuth.ts
    if (fileName === 'fetchWithAuth.ts') continue

    for (const term of searchTerms) {
      // Look for fetch calls to API routes matching this collection
      if (content.includes(`/api/${term}`) || content.includes(`/api/${term.replace(/_/g, '-')}`)) {
        return { file: fileName }
      }
      // Look for direct Firestore collection references
      if (content.includes(`collection('${collName}')`) || content.includes(`"${collName}"`)) {
        return { file: fileName }
      }
    }
  }

  // Also check portal app pages for imports of relevant modules
  for (const [filePath, content] of portalFiles) {
    for (const term of searchTerms) {
      if (content.toLowerCase().includes(term.toLowerCase())) {
        return { file: path.basename(filePath) }
      }
    }
  }

  return null
}

function main() {
  console.log('Detecting collection wiring status...')

  // Load all API route files
  const routeFiles = new Map<string, string>()
  for (const f of scanDir(API_ROUTES, '.ts')) {
    // Skip the firestore-config route itself
    if (path.basename(f) === 'firestore-config.ts') continue
    routeFiles.set(f, fs.readFileSync(f, 'utf-8'))
  }

  // Load all UI module files
  const uiFiles = new Map<string, string>()
  for (const f of scanDir(UI_MODULES, '.tsx')) {
    uiFiles.set(f, fs.readFileSync(f, 'utf-8'))
  }
  for (const f of scanDir(UI_MODULES, '.ts')) {
    uiFiles.set(f, fs.readFileSync(f, 'utf-8'))
  }

  // Load portal page files (for import detection)
  const portalFiles = new Map<string, string>()
  for (const portal of ['prodash', 'riimo', 'sentinel']) {
    const pagesDir = path.join(PORTAL_APPS, portal, 'app', '(portal)')
    for (const f of scanDir(pagesDir, '.tsx')) {
      portalFiles.set(f, fs.readFileSync(f, 'utf-8'))
    }
  }

  console.log(`Scanned: ${routeFiles.size} API routes, ${uiFiles.size} UI modules, ${portalFiles.size} portal pages`)

  // Detect wiring for each collection
  const result: Record<string, {
    status: 'full_stack' | 'backend_only' | 'frontend_only' | 'none'
    backend: string
    frontend: string
    backend_endpoints: number
  }> = {}

  for (const coll of CONFIG_COLLECTIONS) {
    const backend = findApiRouteForCollection(coll, routeFiles)
    const frontend = findFrontendUsage(coll, uiFiles, portalFiles)

    let status: 'full_stack' | 'backend_only' | 'frontend_only' | 'none'
    if (backend && frontend) status = 'full_stack'
    else if (backend) status = 'backend_only'
    else if (frontend) status = 'frontend_only'
    else status = 'none'

    result[coll] = {
      status,
      backend: backend?.file || '',
      frontend: frontend?.file || '',
      backend_endpoints: backend?.endpoints || 0,
    }

    const icon = status === 'full_stack' ? 'FULL' : status === 'backend_only' ? 'BACK' : status === 'frontend_only' ? 'FRONT' : 'NONE'
    console.log(`  ${icon.padEnd(5)} ${coll.padEnd(22)} BE: ${(backend?.file || '—').padEnd(28)} FE: ${frontend?.file || '—'}`)
  }

  // Write output
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true })
  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2))
  console.log(`\nWrote ${OUTPUT}`)
}

main()
