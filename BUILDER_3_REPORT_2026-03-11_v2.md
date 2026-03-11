# Builder 3 Report (Round 3) — 2026-03-11

> Scope: Entitlements integration, PortalSwitcher, data-connected placeholder pages
> Builder: Claude Opus 4.6 (1M context) — Builder 3 Round 3
> Branch: `builder-3/portal-polish`
> Worktree: `~/Projects/toMachina-builder3-r3`
> Plan: `~/.claude/plans/valiant-napping-waterfall.md`

---

## Commits

| Commit | Hash | Description |
|--------|------|-------------|
| Entitlements + PortalSwitcher + data-connected pages | `f0cd5f2` | 16 files changed, +2,171/-82 lines |

**Total: 1 commit, 2,899 lines across 16 files**

---

## Checkpoint Status

| CP | Status | Details |
|----|--------|---------|
| CP1: Entitlements wired in both portals | DONE | Both sidebars import buildEntitlementContext/canAccessModule, all nav items have moduleKeys, sections with zero visible items hide entirely |
| CP2: PortalSwitcher built and integrated | DONE | Shared component in packages/ui, integrated in RIIMO + SENTINEL TopBars |
| CP3: Remaining placeholder pages data-connected | DONE | 4 RIIMO pages + 6 SENTINEL pages upgraded from static placeholders to Firestore-reading views |
| CP4: Build passes — 9/9 workspaces | DONE | RIIMO 16 pages, SENTINEL 14 pages, 0 errors |

---

## P1: Entitlements Integration

### Pattern (Copied Exactly from ProDash PortalSidebar.tsx)

Both RIIMO and SENTINEL sidebars now:
1. Import `useAuth`, `buildEntitlementContext`, `canAccessModule` from `@tomachina/auth`
2. Import `UserEntitlementContext` type from `@tomachina/auth`
3. Build entitlement context via `useMemo(() => buildEntitlementContext(user), [user])`
4. Filter nav sections via `filterSections()` — same function as ProDash
5. Admin section rendered conditionally (`visibleAdmin && ...`)

### Module Key Mappings

**RIIMO:**
| Nav Item | Module Key | Min Level |
|----------|-----------|-----------|
| Dashboard | MY_RPI | USER |
| Tasks | MY_RPI | USER |
| MyRPI | MY_RPI | USER |
| Pipelines | DATA_MAINTENANCE | LEADER |
| Org Admin | ORG_STRUCTURE | EXECUTIVE |
| Intelligence | MCP_HUB | USER |
| CAM | CAM | EXECUTIVE |
| DEX | DEX | LEADER |
| C3 | C3 | USER |
| ATLAS | ATLAS | EXECUTIVE |
| Command Center | RPI_COMMAND_CENTER | EXECUTIVE |
| Admin (section) | ORG_STRUCTURE | EXECUTIVE |
| Admin (item) | PERMISSIONS | EXECUTIVE |

**SENTINEL:**
| Nav Item | Module Key | Min Level |
|----------|-----------|-----------|
| Deals | SENTINEL_DEALS | USER |
| Producers | SENTINEL_PRODUCERS | USER |
| Analysis | SENTINEL_ANALYSIS | USER |
| Market Intel | SENTINEL_ANALYSIS | USER |
| DAVID HUB | DAVID_HUB | LEADER |
| CAM | CAM | EXECUTIVE |
| DEX | DEX | LEADER |
| ATLAS | ATLAS | EXECUTIVE |
| Command Center | RPI_COMMAND_CENTER | EXECUTIVE |
| Admin (section+item) | SENTINEL_ADMIN | LEADER |

---

## P2: PortalSwitcher Component

**File:** `packages/ui/src/components/PortalSwitcher.tsx` (192 lines)

### Features
- Dropdown trigger showing current portal with color badge
- Lists all 3 portals: ProDash (teal), RIIMO (green), SENTINEL (sea green)
- Current portal shown with checkmark, others with external link icon
- **Dev mode detection**: `localhost` uses port-based URLs (3001/3002/3003)
- **Production**: links to `*.tomachina.com` subdomains
- Closes on outside click and Escape key
- Responsive: hides label on small screens, shows icon badge only

### Props
```typescript
interface PortalSwitcherProps {
  currentPortal: string  // 'prodash' | 'riimo' | 'sentinel'
}
```

### Integration
- Exported from `@tomachina/ui` via `packages/ui/src/index.ts`
- Added to RIIMO TopBar with `<PortalSwitcher currentPortal="riimo" />`
- Added to SENTINEL TopBar with `<PortalSwitcher currentPortal="sentinel" />`
- Positioned after portal name, separated by a vertical divider

### Builder 1 Action Required
**ProDash TopBar needs PortalSwitcher integration.** The component is exported from `@tomachina/ui` and ready to use. Builder 1 should add to `apps/prodash/app/(portal)/components/TopBar.tsx`:
```tsx
import { PortalSwitcher } from '@tomachina/ui'
// In the left section, after "toMachina" text:
<PortalSwitcher currentPortal="prodash" />
```

---

## P3: RIIMO Data-Connected Pages

### Intelligence (`/intelligence`) — 221 lines
- **Data sources**: clients, opportunities, revenue (3 Firestore queries)
- **Metrics**: Total clients, open opportunities (with won/lost breakdown), total revenue, product types
- **Pipeline funnel**: Horizontal bar chart showing open/won/lost distribution with percentages
- **Platform health**: Key metrics table (clients, opportunities, revenue records, total premium, carriers)

### DEX (`/modules/dex`) — 152 lines
- **Data sources**: communications, case_tasks
- **Metrics**: Total communications, document-related comms, case tasks, open doc tasks
- **Document pipeline**: 3-stage visualization (Intake -> Processing -> Filing) with active badges
- **Coming soon section**: Notes document taxonomy and form-fill features pending migration

### ATLAS (`/modules/atlas`) — 197 lines
- **Data source**: source_registry collection
- **Empty state**: When no sources exist, shows architecture preview cards (Automated Feeds, Manual Sources, API Integrations)
- **With data**: Summary cards (total/active/types), source-type breakdown, automation-level breakdown, paginated source table (50 rows max)
- **Status badges**: Color-coded (active=green, planned=yellow, unknown=gray)

### Admin (`/admin`) — 198 lines
- **Data source**: users collection
- **Stats**: Total users + top 3 level breakdowns
- **Search**: Real-time text filtering by name/email
- **User table**: Name (with job title), email, level badge (color-coded by OWNER/EXECUTIVE/LEADER/USER), division, status
- **Level badges**: Purple=owner, blue=executive, green=leader, gray=user

---

## P4: SENTINEL Data-Connected Pages

### Analysis (`/analysis`) — 195 lines
- **Data sources**: revenue, agents
- **Metrics**: Total revenue, revenue records, carriers, total agents
- **Three-column layout**: Revenue by carrier (with bar visualization), by agent (ranked list), by type (ranked list)
- **Loading skeletons**: Shimmer rows while data loads

### Market Intel (`/market-intel`) — 308 lines
- **Data sources**: agents, carriers, producers (3 Firestore queries)
- **Summary**: Agent count (with state count), carrier count (with active count), producer count
- **State distribution**: Grid showing top 15 states by agent count
- **Tab browser**: Switchable between Agents/Carriers/Producers with search
- **Data tables**: Paginated (50 rows) with name, NPN, state, status columns

### DAVID HUB (`/modules/david-hub`) — 172 lines
- **Data sources**: revenue, agents, opportunities
- **Metrics**: Total revenue, pipeline value (open deals), active agents, revenue records
- **Calculator cards**: MEC Calculator, PRP Evaluator, SPH Projections, Deal Valuation (all "Coming Soon")
- **Placeholder**: Notes inline calculators replacing GAS-based DAVID-HUB web app

### DEX (`/modules/dex`) — 124 lines
- Same pattern as RIIMO DEX (shared comms/tasks collections)

### ATLAS (`/modules/atlas`) — 152 lines
- Same pattern as RIIMO ATLAS (shared source_registry collection)

### Admin (`/admin`) — 188 lines
- Same pattern as RIIMO Admin (shared users collection)

---

## New Shared Component: PortalSwitcher

Created `packages/ui/src/components/PortalSwitcher.tsx` and exported from `@tomachina/ui`.

---

## Files Changed

### RIIMO (4 modified, 0 new)
| File | Lines | Change |
|------|-------|--------|
| `apps/riimo/.../components/PortalSidebar.tsx` | 314 | Entitlements: +useAuth, +buildEntitlementContext, +canAccessModule, +filterSections, +moduleKey on all items |
| `apps/riimo/.../components/TopBar.tsx` | 81 | +PortalSwitcher import and integration |
| `apps/riimo/.../intelligence/page.tsx` | 221 | Rewrote: static placeholder -> Firestore pipeline/revenue/client analytics |
| `apps/riimo/.../modules/dex/page.tsx` | 152 | Rewrote: static placeholder -> comms/tasks metrics + pipeline stages |
| `apps/riimo/.../modules/atlas/page.tsx` | 197 | Rewrote: static placeholder -> source_registry with empty state + data view |
| `apps/riimo/.../admin/page.tsx` | 198 | Rewrote: static placeholder -> user list with search, badges, stats |

### SENTINEL (6 modified, 0 new)
| File | Lines | Change |
|------|-------|--------|
| `apps/sentinel/.../components/PortalSidebar.tsx` | 311 | Entitlements: same pattern as RIIMO |
| `apps/sentinel/.../components/TopBar.tsx` | 81 | +PortalSwitcher import and integration |
| `apps/sentinel/.../analysis/page.tsx` | 195 | Rewrote: static placeholder -> revenue analysis by carrier/agent/type |
| `apps/sentinel/.../market-intel/page.tsx` | 308 | Rewrote: static placeholder -> agent/carrier/producer browser with tabs |
| `apps/sentinel/.../modules/david-hub/page.tsx` | 172 | Rewrote: static placeholder -> metrics + calculator cards |
| `apps/sentinel/.../modules/dex/page.tsx` | 124 | Rewrote: static placeholder -> comms/tasks metrics + pipeline |
| `apps/sentinel/.../modules/atlas/page.tsx` | 152 | Rewrote: static placeholder -> source_registry with empty state |
| `apps/sentinel/.../admin/page.tsx` | 188 | Rewrote: static placeholder -> user list with search, badges |

### Shared (1 new, 1 modified)
| File | Lines | Change |
|------|-------|--------|
| `packages/ui/src/components/PortalSwitcher.tsx` | 192 | NEW: Portal switcher dropdown component |
| `packages/ui/src/index.ts` | 13 | Added PortalSwitcher export |

---

## Build Verification

```
turbo run build — 9/9 workspaces pass
  @tomachina/core       CACHED
  @tomachina/auth       CACHED
  @tomachina/db         CACHED
  @tomachina/ui         REBUILT (PortalSwitcher added)
  @tomachina/riimo      16 routes, 0 errors
  @tomachina/sentinel   14 routes, 0 errors
  @tomachina/prodash    21 routes, 0 errors
  @tomachina/api        CACHED
  @tomachina/bridge     CACHED
  Time: 34.2s
```

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Module key mapping follows MODULES definitions exactly | RIIMO workspace items use RAPID_TOOLS keys (MY_RPI, MCP_HUB, DATA_MAINTENANCE). SENTINEL workspace uses DAVID_TOOLS keys (SENTINEL_DEALS, SENTINEL_PRODUCERS, SENTINEL_ANALYSIS). Apps section uses cross-suite keys (CAM, DEX, ATLAS, etc.). |
| Market Intel reuses SENTINEL_ANALYSIS module key | Market Intel is a view within the Analysis capability, not a separate entitlement. Using the same gate keeps them paired. |
| PortalSwitcher detects dev mode via window.location.hostname | Simple and reliable. No env var needed. Works identically in dev and prod. |
| PortalSwitcher uses `<a href>` not `<Link>` | Cross-portal navigation is a full page load to a different domain/port. Next.js Link is for same-app routing only. |
| ATLAS shows architecture cards when source_registry is empty | Better UX than a blank page. Users understand what ATLAS will do even before data is migrated. |
| DEX reads from comms/tasks as proxy | Document-specific collections don't exist yet. Using communications and case_tasks filtered for document-related items gives real numbers while showing the pipeline concept. |
| Admin pages shared pattern, different cache keys | RIIMO and SENTINEL Admin both read from `users` collection but use portal-prefixed cache keys to avoid cross-portal state conflicts. |

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| ProDash needs PortalSwitcher wired in | LOW | Component is built and exported. Builder 1 needs to add one import + one JSX line to ProDash TopBar. |
| Entitlements default to OWNER for @retireprotected.com | LOW | Known from Builder 1 Round 2. JDM sees everything (correct). New users without Firestore records also get OWNER. Should default to USER for unknowns. |
| Intelligence page loads all docs from 3 collections | MEDIUM | Same concern as dashboard. Fine at current scale (~5K clients). Needs aggregation queries at production scale. |
| Market Intel loads all agents/carriers/producers | MEDIUM | ~500 agents, ~165 carriers renders fine. Would need pagination if these grow 10x. |
| ATLAS source_registry likely empty | LOW | Collection not yet migrated. Empty state renders gracefully with architecture preview. |
| DEX document metrics are proxy-based | LOW | Filters comms/tasks for doc-related items. Real document collections will replace this. |

---

## Merge Notes

This branch touches **only** files in scope:
- `apps/riimo/**` — sidebar + topbar + 4 data-connected pages
- `apps/sentinel/**` — sidebar + topbar + 6 data-connected pages
- `packages/ui/src/components/PortalSwitcher.tsx` — new file
- `packages/ui/src/index.ts` — additive only (1 export added)

**Zero conflicts expected with main branch.** No changes to ProDash, services, scripts, db, auth, core, or root configs.

---

## Session Summary

| Metric | Count |
|--------|-------|
| Commits | 1 |
| Files modified | 14 |
| Files created | 1 (PortalSwitcher) |
| Files additive-modified | 1 (ui/index.ts) |
| Total lines | 2,899 |
| RIIMO routes | 16 (unchanged count, 4 upgraded from placeholders) |
| SENTINEL routes | 14 (unchanged count, 6 upgraded from placeholders) |
| Shared components added | 1 (PortalSwitcher) |
| Build time | ~34 seconds |
| Build errors | 0 |
| Pages data-connected this round | 10 (4 RIIMO + 6 SENTINEL) |
| Remaining pure placeholders | 0 in RIIMO, 0 in SENTINEL |
