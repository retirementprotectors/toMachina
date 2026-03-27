// ─── VOLTRON Registry Generator — TRK-13739 ──────────────────────────────────
// Parses 4 sources into a unified VoltronRegistryEntry[] for the voltron_registry
// Firestore collection. Idempotent: stable tool_id means re-runs overwrite,
// never duplicate.
//
// Sources:
//   1. API Routes   — services/api/src/routes/*.ts  (method + path → ATOMIC)
//   2. Firestore    — packages/db/src/firestore.ts  (collections → CRUD tools)
//   3. MCP Bridge   — mdj-agent/src/tools/mcp-bridge.ts  (25 MCP tools)
//   4. Voltron      — voltron/tools/*.ts + super-tools + wires + legacy map
//
// NOT exported from barrel — server/script-only (uses Node fs).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, existsSync } from 'fs'
import path from 'path'
import type {
  VoltronRegistryEntry,
  VoltronToolSource,
  VoltronToolType,
  VoltronUserRole,
} from './types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RegistryGeneratorPaths {
  /** Root of the toMachina monorepo */
  monorepoRoot: string
  /** Root of mdj-agent (for MCP bridge) */
  mdjAgentRoot: string
}

export interface RegistryGeneratorResult {
  entries: VoltronRegistryEntry[]
  stats: {
    api_route: number
    firestore: number
    mcp: number
    voltron: number
    total: number
    duplicates_merged: number
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeEntry(
  tool_id: string,
  name: string,
  description: string,
  type: VoltronToolType,
  source: VoltronToolSource,
  entitlement_min: VoltronUserRole,
  parameters: Record<string, unknown>,
  server_only: boolean,
  generated_at: string,
): VoltronRegistryEntry {
  return { tool_id, name, description, type, source, entitlement_min, parameters, server_only, generated_at }
}

/**
 * Normalize a route path + method into a stable tool_id.
 * e.g. GET /api/clients → api_clients_get
 */
function routeToolId(basePath: string, subPath: string, method: string): string {
  const full = (basePath + subPath)
    .replace(/^\/api\//, '')
    .replace(/\/:([^/]+)/g, '_by_$1')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
  return `api_${full}_${method.toLowerCase()}`
}

/**
 * Describe a route endpoint for the LLM.
 */
function routeDescription(method: string, basePath: string, subPath: string): string {
  const fullPath = basePath + (subPath === '/' ? '' : subPath)
  return `${method.toUpperCase()} ${fullPath}`
}

// ─── Source 1: API Routes ───────────────────────────────────────────────────

interface RouteMountInfo {
  basePath: string
  routeFile: string
}

function parseServerMounts(serverTsPath: string): RouteMountInfo[] {
  if (!existsSync(serverTsPath)) return []
  const content = readFileSync(serverTsPath, 'utf8')
  const mounts: RouteMountInfo[] = []

  // Match: app.use('/api/clients', ... clientRoutes)
  // Also handle: app.use('/api/voltron/registry', voltronRegistryRoutes)
  const mountRegex = /app\.use\(\s*'(\/api\/[^']+)'\s*,\s*(?:normalizeBody\s*,\s*)?(\w+Routes?)\s*\)/g
  let match: RegExpExecArray | null

  // Build import map: variable name → file path
  const importMap = new Map<string, string>()
  const importRegex = /import\s+\{[^}]*\b(\w+Routes?)\b[^}]*\}\s+from\s+'\.\/routes\/([^']+)'/g
  let importMatch: RegExpExecArray | null
  while ((importMatch = importRegex.exec(content)) !== null) {
    importMap.set(importMatch[1], importMatch[2])
  }

  while ((match = mountRegex.exec(content)) !== null) {
    const basePath = match[1]
    const routeVar = match[2]
    const routeFile = importMap.get(routeVar)
    if (routeFile) {
      mounts.push({ basePath, routeFile: routeFile.replace(/\.js$/, '.ts') })
    }
  }

  return mounts
}

interface ParsedEndpoint {
  method: string
  subPath: string
}

function parseRouteFile(filePath: string): ParsedEndpoint[] {
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf8')
  const endpoints: ParsedEndpoint[] = []

  // Match: routerVar.get('/', ...) or routerVar.post('/:id', ...)
  // Handles any variable name (clientRoutes, voltronRegistryRoutes, etc.)
  const routeRegex = /\w+\.(get|post|put|patch|delete)\(\s*'([^']+)'/g
  let match: RegExpExecArray | null

  while ((match = routeRegex.exec(content)) !== null) {
    endpoints.push({ method: match[1], subPath: match[2] })
  }

  return endpoints
}

function generateApiRouteEntries(paths: RegistryGeneratorPaths, timestamp: string): VoltronRegistryEntry[] {
  const serverTs = path.join(paths.monorepoRoot, 'services/api/src/server.ts')
  const routesDir = path.join(paths.monorepoRoot, 'services/api/src/routes')
  const mounts = parseServerMounts(serverTs)
  const entries: VoltronRegistryEntry[] = []

  for (const mount of mounts) {
    const routeFilePath = path.join(routesDir, mount.routeFile.endsWith('.ts') ? mount.routeFile : `${mount.routeFile}.ts`)
    const endpoints = parseRouteFile(routeFilePath)

    for (const ep of endpoints) {
      const toolId = routeToolId(mount.basePath, ep.subPath, ep.method)
      const desc = routeDescription(ep.method, mount.basePath, ep.subPath)

      // Write methods are SPECIALIST, read methods are COORDINATOR
      const entitlement: VoltronUserRole = ['post', 'put', 'patch', 'delete'].includes(ep.method)
        ? 'SPECIALIST'
        : 'COORDINATOR'

      entries.push(makeEntry(
        toolId,
        toolId,
        desc,
        'ATOMIC',
        'API_ROUTE',
        entitlement,
        { method: ep.method.toUpperCase(), path: mount.basePath + ep.subPath },
        true,
        timestamp,
      ))
    }
  }

  return entries
}

// ─── Source 2: Firestore Collections ────────────────────────────────────────

function parseFirestoreCollections(firestoreTsPath: string): string[] {
  if (!existsSync(firestoreTsPath)) return []
  const content = readFileSync(firestoreTsPath, 'utf8')
  const collections: string[] = []

  // Match: collection(getDb(), 'collection_name')
  const collRegex = /collection\(getDb\(\)\s*,\s*'([^']+)'\)/g
  let match: RegExpExecArray | null

  while ((match = collRegex.exec(content)) !== null) {
    if (!collections.includes(match[1])) {
      collections.push(match[1])
    }
  }

  return collections
}

function generateFirestoreEntries(paths: RegistryGeneratorPaths, timestamp: string): VoltronRegistryEntry[] {
  const firestoreTs = path.join(paths.monorepoRoot, 'packages/db/src/firestore.ts')
  const collections = parseFirestoreCollections(firestoreTs)
  const entries: VoltronRegistryEntry[] = []

  const operations = [
    { suffix: 'list', method: 'LIST', entitlement: 'COORDINATOR' as VoltronUserRole, desc: 'List documents from' },
    { suffix: 'get', method: 'GET', entitlement: 'COORDINATOR' as VoltronUserRole, desc: 'Get a document from' },
    { suffix: 'create', method: 'CREATE', entitlement: 'SPECIALIST' as VoltronUserRole, desc: 'Create a document in' },
    { suffix: 'update', method: 'UPDATE', entitlement: 'SPECIALIST' as VoltronUserRole, desc: 'Update a document in' },
    { suffix: 'delete', method: 'DELETE', entitlement: 'DIRECTOR' as VoltronUserRole, desc: 'Delete a document from' },
  ]

  for (const col of collections) {
    for (const op of operations) {
      const toolId = `fs_${col}_${op.suffix}`
      entries.push(makeEntry(
        toolId,
        toolId,
        `${op.desc} ${col} collection`,
        'ATOMIC',
        'FIRESTORE',
        op.entitlement,
        { collection: col, operation: op.method },
        true,
        timestamp,
      ))
    }
  }

  return entries
}

// ─── Source 3: MCP Bridge ───────────────────────────────────────────────────

interface ParsedMcpTool {
  name: string
  description: string
  requires_approval: boolean
  server: string
  parameters: Record<string, unknown>
}

function parseMcpBridge(bridgePath: string): ParsedMcpTool[] {
  if (!existsSync(bridgePath)) return []
  const content = readFileSync(bridgePath, 'utf8')
  const tools: ParsedMcpTool[] = []

  // Parse tool definitions using regex blocks.
  // Each tool starts with "  {" (2-space indent) and has name, description, input_schema, requires_approval, _server
  const nameRegex = /name:\s*'([^']+)'/g
  const descRegex = /description:\s*'([^']+)'/g
  const approvalRegex = /requires_approval:\s*(true|false)/g
  const serverRegex = /_server:\s*'([^']+)'/g

  // Split on tool object boundaries — each tool block starts with `  {` on its own line
  // after the TOOL_DEFINITIONS array opening
  const defStart = content.indexOf('const TOOL_DEFINITIONS')
  if (defStart === -1) return []

  const defSection = content.slice(defStart)
  const names: string[] = []
  const descs: string[] = []
  const approvals: boolean[] = []
  const servers: string[] = []

  let m: RegExpExecArray | null
  while ((m = nameRegex.exec(defSection)) !== null) names.push(m[1])
  while ((m = descRegex.exec(defSection)) !== null) descs.push(m[1])
  while ((m = approvalRegex.exec(defSection)) !== null) approvals.push(m[1] === 'true')
  while ((m = serverRegex.exec(defSection)) !== null) servers.push(m[1])

  // Zip them together
  const count = Math.min(names.length, descs.length, approvals.length, servers.length)
  for (let i = 0; i < count; i++) {
    tools.push({
      name: names[i],
      description: descs[i],
      requires_approval: approvals[i],
      server: servers[i],
      parameters: {},
    })
  }

  return tools
}

function generateMcpEntries(paths: RegistryGeneratorPaths, timestamp: string): VoltronRegistryEntry[] {
  const bridgePath = path.join(paths.mdjAgentRoot, 'src/tools/mcp-bridge.ts')
  const tools = parseMcpBridge(bridgePath)

  return tools.map(t => makeEntry(
    t.name,
    t.name,
    t.description,
    'ATOMIC',
    'MCP',
    t.requires_approval ? 'SPECIALIST' : 'COORDINATOR',
    { _server: t.server },
    true,
    timestamp,
  ))
}

// ─── Source 4: Voltron (Atomic + Super + Wire + Legacy) ─────────────────────

function generateVoltronEntries(paths: RegistryGeneratorPaths, timestamp: string): VoltronRegistryEntry[] {
  const entries: VoltronRegistryEntry[] = []
  const toolsDir = path.join(paths.monorepoRoot, 'packages/core/src/voltron/tools')
  const superDir = path.join(paths.monorepoRoot, 'packages/core/src/voltron/super-tools')
  const wiresFile = path.join(paths.monorepoRoot, 'packages/core/src/voltron/wires.ts')

  // 4a. Atomic tools — parse definition exports from individual tool files
  if (existsSync(toolsDir)) {
    const toolFiles = readdirSync(toolsDir).filter(
      f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'legacy-tool-map.ts',
    )

    for (const file of toolFiles) {
      const filePath = path.join(toolsDir, file)
      const content = readFileSync(filePath, 'utf8')

      // Extract definition fields from: export const definition = { ... }
      const toolId = extractField(content, 'tool_id')
      if (!toolId) continue

      const name = extractField(content, 'name') || toolId
      const desc = extractField(content, 'description') || `Atomic tool: ${toolId}`
      const entitlement = extractField(content, 'entitlement_min') || 'COORDINATOR'
      const serverOnly = content.includes("server_only: true")

      entries.push(makeEntry(
        toolId,
        name,
        desc,
        'ATOMIC',
        'VOLTRON',
        entitlement as VoltronUserRole,
        {},
        serverOnly,
        timestamp,
      ))
    }
  }

  // 4b. Super tools — parse definition exports from individual super-tool files
  if (existsSync(superDir)) {
    const superFiles = readdirSync(superDir).filter(
      f => f.endsWith('.ts') && f !== 'index.ts',
    )

    for (const file of superFiles) {
      const filePath = path.join(superDir, file)
      const content = readFileSync(filePath, 'utf8')

      const toolId = extractField(content, 'super_tool_id')
      if (!toolId) continue

      const name = extractField(content, 'name') || toolId
      const desc = extractField(content, 'description') || `Super tool: ${toolId}`
      const entitlement = extractField(content, 'entitlement_min') || 'SPECIALIST'

      // Extract tools array
      const toolsMatch = content.match(/tools:\s*\[([^\]]+)\]/)
      const tools = toolsMatch
        ? toolsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
        : []

      entries.push(makeEntry(
        toolId,
        name,
        desc,
        'SUPER',
        'VOLTRON',
        entitlement as VoltronUserRole,
        { tools },
        false,
        timestamp,
      ))
    }
  }

  // 4c. Wire definitions — parse from wires.ts
  if (existsSync(wiresFile)) {
    const content = readFileSync(wiresFile, 'utf8')

    // Parse each wire definition block
    const wireBlockRegex = /\{\s*wire_id:\s*'([^']+)'[\s\S]*?entitlement_min:\s*'([^']+)'\s*,?\s*\}/g
    let match: RegExpExecArray | null

    while ((match = wireBlockRegex.exec(content)) !== null) {
      const block = match[0]
      const wireId = match[1]
      const entitlement = match[2] as VoltronUserRole

      const nameMatch = block.match(/name:\s*'([^']+)'/)
      const descMatch = block.match(/description:\s*'([^']+)'/)
      const superToolsMatch = block.match(/super_tools:\s*\[([^\]]+)\]/)
      const gatesMatch = block.match(/approval_gates:\s*\[([^\]]+)\]/)

      const superTools = superToolsMatch
        ? superToolsMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
        : []
      const gates = gatesMatch
        ? gatesMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
        : []

      entries.push(makeEntry(
        wireId,
        nameMatch?.[1] || wireId,
        descMatch?.[1] || `Wire: ${wireId}`,
        'WIRE',
        'VOLTRON',
        entitlement,
        { super_tools: superTools, approval_gates: gates.length > 0 ? gates : undefined },
        false,
        timestamp,
      ))
    }
  }

  // 4d. Legacy tool map — parse tool_id entries from legacy-tool-map.ts
  const legacyPath = path.join(toolsDir, 'legacy-tool-map.ts')
  if (existsSync(legacyPath)) {
    const content = readFileSync(legacyPath, 'utf8')

    // Match entry() calls: entry('tool_id', 'description', 'SOURCE', 'ROLE', {...}, bool)
    const entryRegex = /entry\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'/g
    let m: RegExpExecArray | null

    while ((m = entryRegex.exec(content)) !== null) {
      entries.push(makeEntry(
        m[1],         // tool_id
        m[1],         // name (same as tool_id for legacy)
        m[2],         // description
        'ATOMIC',
        m[3] as VoltronToolSource,
        m[4] as VoltronUserRole,
        {},
        true,
        timestamp,
      ))
    }
  }

  return entries
}

/**
 * Extract a string field value from a TypeScript object literal.
 * e.g. extractField(content, 'tool_id') for `tool_id: 'get_client_documents'`
 */
function extractField(content: string, field: string): string | null {
  const regex = new RegExp(`${field}:\\s*'([^']+)'`)
  const match = content.match(regex)
  return match ? match[1] : null
}

// ─── Main Generator ─────────────────────────────────────────────────────────

export function generateVoltronRegistry(paths: RegistryGeneratorPaths): RegistryGeneratorResult {
  const timestamp = new Date().toISOString()
  const registry = new Map<string, VoltronRegistryEntry>()
  let duplicatesMerged = 0

  const counts = { api_route: 0, firestore: 0, mcp: 0, voltron: 0 }

  // Source 1: API Routes
  const apiEntries = generateApiRouteEntries(paths, timestamp)
  counts.api_route = apiEntries.length

  // Source 2: Firestore Collections
  const fsEntries = generateFirestoreEntries(paths, timestamp)
  counts.firestore = fsEntries.length

  // Source 3: MCP Bridge
  const mcpEntries = generateMcpEntries(paths, timestamp)
  counts.mcp = mcpEntries.length

  // Source 4: Voltron (atomic + super + wire + legacy)
  const voltronEntries = generateVoltronEntries(paths, timestamp)
  counts.voltron = voltronEntries.length

  // Merge all entries into a Map keyed by tool_id (idempotent: last-write-wins)
  // Voltron-native entries take priority over auto-generated ones
  const allSources = [apiEntries, fsEntries, mcpEntries, voltronEntries]

  for (const source of allSources) {
    for (const entry of source) {
      if (registry.has(entry.tool_id)) {
        duplicatesMerged++
      }
      registry.set(entry.tool_id, entry)
    }
  }

  const entries = Array.from(registry.values()).sort((a, b) => {
    // Sort by source, then type, then tool_id
    const sourceCmp = a.source.localeCompare(b.source)
    if (sourceCmp !== 0) return sourceCmp
    const typeCmp = a.type.localeCompare(b.type)
    if (typeCmp !== 0) return typeCmp
    return a.tool_id.localeCompare(b.tool_id)
  })

  return {
    entries,
    stats: {
      ...counts,
      total: entries.length,
      duplicates_merged: duplicatesMerged,
    },
  }
}
