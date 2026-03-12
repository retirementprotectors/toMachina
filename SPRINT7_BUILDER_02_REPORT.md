# Sprint 7 — Builder 02 Report: App Integration & Rebranding

**Branch:** `sprint7/app-integration-rebranding`
**Commit:** `db28d86`
**Build Status:** 11/11 tasks successful, 0 errors

---

## Scope Delivered

### Part 1: App Brand Registry (`packages/ui/src/apps/`)
- `brands.ts` — `APP_BRANDS` constant with 7 app definitions (atlas, cam, dex, c3, command-center, david-hub, leadership-center)
- `AppIcon.tsx` — 28x28 branded circle with white Material icon
- `AppWrapper.tsx` — 4px brand-color top bar + portal-themed content below
- `index.ts` — barrel exports with types

### Part 2: Sidebar Restructure (All 3 Portals)
All three `PortalSidebar.tsx` files restructured:
- Apps section moved to **fixed bottom zone** (does not scroll)
- Each app uses `AppIcon` with its own brand color
- Clean `AppItem` interface using `AppKey` directly from brands
- SVG logos in sidebar headers (collapsed: mark, expanded: full logo)
- Clickable logos navigate to portal home pages
- Admin as a single `ADMIN_ITEM` with direct entitlement check
- RPI Connect added to ProDashX and SENTINEL fixed bottoms
- Section headers show icons and work properly in collapsed mode

**Per-portal app order:**
| ProDashX | RIIMO | SENTINEL |
|----------|-------|----------|
| ATLAS | CAM | DAVID HUB |
| CAM | DEX | CAM |
| DEX | C3 | DEX |
| C3 | ATLAS | ATLAS |
| Command Center | Leadership Center | Command Center |

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

---

## Verification Checklist
- [x] Each app shows unique brand color icon in all 3 portal sidebars
- [x] App icons look identical across portals
- [x] Internal module icons still use `var(--module-color)`
- [x] Apps section is fixed at bottom, does not scroll
- [x] Apps appear in per-portal default order
- [x] Permission filtering via `canAccessModule()` preserved
- [x] AppWrapper shows thin brand-color top bar
- [x] RPI Connect sits below Apps, Admin at very bottom
- [x] Sidebar collapsed mode works
- [x] No hardcoded hex in JSX — all from APP_BRANDS or CSS vars
- [x] `npm run build` passes (11/11)
- [x] No `alert()`, `confirm()`, `prompt()` anywhere
