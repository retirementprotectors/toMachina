# Sprint 7 -- Builder 02 Report: App Integration & Rebranding

**Branch:** `sprint7/app-integration-rebranding`
**Build Status:** 11/11 tasks successful, 0 errors (force rebuild verified)

---

## Scope Delivered

### Part 1: App Brand Registry (`packages/ui/src/apps/`)
- `brands.ts` -- `APP_BRANDS` constant with 7 app definitions (atlas, cam, dex, c3, command-center, david-hub, leadership-center)
- `AppIcon.tsx` -- 28x28 branded circle with white Material icon
- `AppWrapper.tsx` -- 4px brand-color top bar + portal-themed content below
- `index.ts` -- barrel exports with types

**App Brand Colors (identical across all portals):**

| App | Color | Icon |
|-----|-------|------|
| ATLAS | `#3182ce` (blue) | `hub` |
| CAM | `#d69e2e` (gold) | `payments` |
| DEX | `#38a169` (green) | `description` |
| C3 | `#e53e3e` (red) | `campaign` |
| Command Center | `#718096` (gray) | `speed` |
| Leadership Center | `#a78bfa` (purple) | `leaderboard` |
| DAVID HUB | `#40bc58` (green) | `calculate` |

### Part 2: Sidebar Restructure (All 3 Portals)
All three `PortalSidebar.tsx` files restructured with new architecture:

**Key changes:**
- Apps section moved to **fixed bottom zone** (does not scroll with main nav)
- Each app uses `AppIcon` with its own brand color -- not portal color
- Clean `AppItem` interface using `AppKey` type directly for type-safe brand resolution
- Section headers: icon + title text + rotate arrow (twist/rotate expand per rules N4, N5)
- SVG logos in sidebar headers (collapsed: `-mark.svg`, expanded: `-logo.svg`)
- Clickable logos navigate to portal home pages (N1: ProDashX -> /clients)
- RPI Connect and Admin rendered as fixed individual items, not nav sections
- Admin always uses red branding (`var(--admin-color)`)
- Connect uses green branding (`var(--connect-color)`)

**Logo Click Destinations:**
| Portal | Destination |
|--------|-----------|
| ProDashX | `/clients` (rule N1) |
| RIIMO | `/dashboard` |
| SENTINEL | `/deals` |

**Per-portal app order:**
| ProDashX | RIIMO | SENTINEL |
|----------|-------|----------|
| ATLAS | CAM | DAVID HUB |
| CAM | DEX | CAM |
| DEX | C3 | DEX |
| C3 | ATLAS | ATLAS |
| Command Center | Leadership Center | Command Center |

**Per-portal sidebar sections:**
| Portal | Scrollable Sections |
|--------|-------------------|
| ProDashX | Workspace (Clients, Accounts, Quick Intake), Sales Centers, Service Centers, Pipelines |
| RIIMO | Workspace (Dashboard, Tasks, Org Admin, Intelligence), Service Centers, Pipelines |
| SENTINEL | Workspace (Deals, Producers, Analysis, Market Intel), Service Centers, Pipelines |

### Part 3: App Page Wrappers (16 pages)
All module pages wrapped with `AppWrapper`:
- ProDashX: atlas, cam, dex, c3, command-center (5)
- RIIMO: atlas, cam, dex, c3, command-center/leadership (5)
- SENTINEL: atlas, cam, dex, c3, command-center, david-hub (6)

### Part 4: CSS Variables
Added to all 3 `globals.css`:
```css
--app-atlas: #3182ce;
--app-cam: #d69e2e;
--app-dex: #38a169;
--app-c3: #e53e3e;
--app-cc: #718096;
```

### Part 5: Barrel Exports
`packages/ui/src/index.ts` updated with `APP_BRANDS`, `AppIcon`, `AppWrapper`, and types.

---

## Files Changed

### Created (6)
- `packages/ui/src/apps/brands.ts`
- `packages/ui/src/apps/AppIcon.tsx`
- `packages/ui/src/apps/AppWrapper.tsx`
- `packages/ui/src/apps/index.ts`
- `apps/prodash/public/prodashx-logo.svg`
- `apps/prodash/public/prodashx-mark.svg`

### Modified (23)
- 3x `PortalSidebar.tsx` (prodash, riimo, sentinel)
- 16x module `page.tsx` files (all app pages across all portals)
- 3x `globals.css` (prodash, riimo, sentinel)
- 1x `packages/ui/src/index.ts`

### NOT Touched (per spec)
- `packages/ui/src/modules/*.tsx` (module internals -- owned by other builders)
- `packages/core/**` (business logic)
- `services/**` (API routes)

---

## Verification Checklist
- [x] Each app shows unique brand color icon in all 3 portal sidebars
- [x] App icons look identical across portals (same color, same icon, same size)
- [x] Internal module icons still use `var(--module-color)` (not app brand colors)
- [x] Apps section is fixed at bottom, does not scroll
- [x] Apps appear in per-portal default order
- [x] Permission filtering via `canAccessModule()` + `moduleKey` preserved
- [x] Clicking an app opens module page wrapped in `AppWrapper`
- [x] AppWrapper shows thin brand-color top bar, portal-themed content below
- [x] RPI Connect sits below Apps, Admin at very bottom
- [x] Sidebar collapsed mode works (branded icons show, no labels)
- [x] No hardcoded hex colors in component JSX for brand identity
- [x] `npm run build` passes (11/11 tasks, force rebuild)
- [x] No `alert()`, `confirm()`, `prompt()` anywhere
- [x] No `any` types
- [x] Section headers have icon + title + rotate arrow (rules N4, N5)
- [x] Portal logos use SVG assets (mark for collapsed, logo for expanded)
- [x] ProDashX logo click -> /clients (rule N1)
- [x] RIIMO logo click -> /dashboard
- [x] SENTINEL logo click -> /deals
