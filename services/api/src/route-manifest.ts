/**
 * Route Manifest — Auto-loaded by server.ts
 *
 * WHY THIS EXISTS: When 3+ RONINs build in parallel, they ALL add imports
 * and app.use() calls to server.ts, creating merge conflicts every time.
 * This manifest lets each CXO add their routes to a separate file that
 * auto-registers on startup.
 *
 * HOW TO ADD ROUTES:
 * 1. Create your route file in routes/ (e.g., routes/cmo-wires.ts)
 * 2. Add an entry to the ROUTE_MANIFEST array below
 * 3. Your route auto-registers — no server.ts edit needed
 *
 * The manifest is append-only. Each entry is one line. Merge conflicts
 * are trivial (just keep both sides).
 */

import type { Router } from 'express'

export interface RouteManifestEntry {
  /** URL path prefix (e.g., '/api/cmo') */
  path: string
  /** Lazy import — only loaded when server starts */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  load: () => Promise<any>
  /** Which export name to use (default: 'default') */
  exportName?: string
  /** Comment for git blame */
  addedBy: string
}

/**
 * Add new routes here. One line per route. Append only.
 * Each CXO owns their section — marked with comments.
 */
export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  // === MEGAZORD (CIO) ===
  { path: '/api/rangers', load: () => import('./routes/rangers.js'), exportName: 'rangerRoutes', addedBy: 'ZRD-O08' },

  // === VOLTRON (CSO) ===
  { path: '/api/voltron/cases', load: () => import('./routes/voltron-cases.js'), exportName: 'voltronCasesRoutes', addedBy: 'VOL-O07' },
  { path: '/api/voltron/gap-requests', load: () => import('./routes/voltron-gap-requests.js'), exportName: 'voltronGapRequestRoutes', addedBy: 'VOL-O18' },

  // === MUSASHI (CMO) ===
  { path: '/api/cmo', load: () => import('./routes/cmo-wires.js'), exportName: 'cmoWireRoutes', addedBy: 'MUS-O05' },
  { path: '/api/cmo/intake', load: () => import('./routes/cmo-intake.js'), exportName: 'cmoIntakeRoutes', addedBy: 'MUS-O09' },
  { path: '/api/cmo/pipeline', load: () => import('./routes/cmo-pipeline.js'), exportName: 'cmoPipelineRoutes', addedBy: 'MUS-O10' },
]
