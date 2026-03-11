# Sprint 3 — Builder 32 Report: ProDashX Sales + Quoting

**Branch:** `sprint3/prodashx-sales-quoting`
**Builder:** 32 (ProDashX Sales + Quoting)
**Status:** COMPLETE

---

## Summary

Built all 4 priority tiers:
1. **Medicare Quoting** (HIGH) — Full CSG API integration + sortable results + plan comparison
2. **Discovery Kit** (MEDIUM) — 5-step wizard with client selection, draft auto-save, summary generation
3. **Pipeline Depth** (MEDIUM) — Kanban board with Firestore-backed stages, card detail modal, stage change
4. **Sales Center Shells** (LOW) — Life, Annuity, Advisory pages with real client data from Firestore

---

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `services/api/src/routes/medicare-quote.ts` | CSG API integration — auth, quotes, companies, plan letters, status | ~170 |
| `apps/prodash/app/(portal)/discovery/page.tsx` | Discovery Kit wizard — 5 steps, localStorage draft, client search | ~400 |

## Files Modified

| File | Change |
|------|--------|
| `apps/prodash/app/(portal)/sales-centers/medicare/page.tsx` | Replaced stub with full quoting UI (form + results table + comparison panel + recommendation logic) |
| `apps/prodash/app/(portal)/sales-centers/life/page.tsx` | Replaced stub with client table (filtered to life accounts) + quoting placeholder |
| `apps/prodash/app/(portal)/sales-centers/annuity/page.tsx` | Replaced stub with client table (filtered to annuity accounts) + rate comparison placeholder |
| `apps/prodash/app/(portal)/sales-centers/advisory/page.tsx` | Replaced stub with client table (filtered to BD/RIA accounts) + advisory placeholder |
| `apps/prodash/app/(portal)/pipelines/page.tsx` | Replaced stub with Kanban board (pipeline selector, stage columns, card detail modal, stage change) |
| `apps/prodash/app/(portal)/components/PortalSidebar.tsx` | Added "Pipeline Board" + "Discovery Kit" nav items to Pipelines section |
| `services/api/src/server.ts` | Registered `medicareQuoteRoutes` at `/api/medicare-quote` |

## Files NOT Touched (scope boundaries respected)

- `packages/ui/src/modules/**` — Sprint 2 builders
- `apps/prodash/app/(portal)/clients/**` — Sprint 3 Builder 31
- `apps/prodash/app/(portal)/service-centers/**` — Sprint 3 Builder 31
- `apps/prodash/app/(portal)/casework/**` — Sprint 3 Builder 31
- `apps/riimo/**` — Sprint 3 Builder 33
- `apps/sentinel/**` — Sprint 3 Builder 33
- `packages/core/**` — import only

---

## Feature Details

### 1. Medicare Quoting (HIGH)

**API Route** (`/api/medicare-quote`):
- `POST /quotes` — Authenticates with CSG, fetches Med Supp quotes, normalizes pennies→dollars, enriches with company data
- `GET /companies` — Cached company list (24h TTL)
- `GET /plan-letters` — Static plan letter definitions (A-N)
- `GET /status` — Check if CSG API key is configured
- Token cached for 7 hours (safe margin under 8hr TTL)
- Graceful fallback: returns 503 with setup instructions if `CSG_API_KEY` not set

**Frontend** (`/sales-centers/medicare`):
- 6-field input form: ZIP, DOB, gender, tobacco, plan letter (default G), effective date
- Age calculation + validation (minimum 64)
- Sortable results table: carrier, AM Best rating, monthly/annual premium, rate type, EFT discount
- Recommendation engine: highlights top 3 best-value plans (lowest premium among rated carriers)
- Comparison panel: select up to 3 plans for side-by-side view with annual savings calculation
- API-not-configured state: shows setup instructions with Brien Welch contact info

### 2. Discovery Kit (MEDIUM)

**5-step wizard** (`/discovery`):
1. **Client Selection** — Search Firestore clients, visual selection card
2. **Financial Goals** — Retirement age, income needs, risk tolerance (conservative/moderate/aggressive), primary goal (income/growth/protection/legacy)
3. **Existing Coverage** — Toggle panels for life/annuity/medicare/investments with detail text areas, estimated total assets
4. **Health Overview** — General health rating, tobacco, medications, conditions
5. **Review + Generate** — Summary of all steps, "Generate Summary" button

**Features:**
- Draft auto-saves to localStorage on every change
- Resumes draft on page load with toast notification
- Step indicator with clickable completed steps
- Client search filters active clients from Firestore
- PDF generation placeholder: "PDF generation will be available when DEX integration is complete"

### 3. Pipeline Depth (MEDIUM)

**Kanban board** (`/pipelines`):
- Pipeline selector dropdown (filters by PRODASHX portal)
- Stage columns from Firestore `flow/config/stages` (falls back to default 4 stages)
- Cards from Firestore `flow/config/instances` (active/open/blocked status)
- Card badges: status + priority with color coding
- Card meta: assigned user, value, due date
- Detail modal on card click: all instance fields + stage change interface
- Stage change: select target stage → confirm → PATCH API call
- URL query param support (`?stage=discovery` from sidebar links)

### 4. Sales Center Shells (LOW)

All three pages follow the same pattern:
- Search input filtering clients from Firestore
- Client table showing contacts with matching account types
- Row click navigates to CLIENT360
- Placeholder section describing planned integrations

**Life** — Filters by `account_types` containing "life"
**Annuity** — Filters by `account_types` containing "annuity"
**Advisory** — Filters by `account_types` containing "bd", "ria", or "bd/ria"

---

## Sidebar Changes

Added to Pipelines section:
1. **Pipeline Board** (`/pipelines`) — Direct link to Kanban view (icon: `view_kanban`)
2. **Discovery Kit** (`/discovery`) — New discovery wizard (icon: `assignment`)

Both added ABOVE the existing stage-filtered links. Builder 31 may also add "Quick Intake" — mine are placed to not conflict.

---

## Build Verification

```
npx turbo run build --filter=@tomachina/prodash
Tasks: 5 successful, 5 total
Time: 29.262s
```

All routes compiled:
- `/discovery` — 4.72 kB
- `/pipelines` — 3.59 kB
- `/sales-centers/medicare` — 4.17 kB
- `/sales-centers/life` — 2.26 kB
- `/sales-centers/annuity` — 2.25 kB
- `/sales-centers/advisory` — 2.27 kB

---

## Self-Verification Checklist

- [x] No `alert()`, `confirm()`, `prompt()`
- [x] All API functions return `{ success: true/false, data/error }`
- [x] No hardcoded colors — CSS variables throughout
- [x] No plain dropdowns for person selection (client search in Discovery uses filtered list, not `<select>`)
- [x] Code follows existing patterns (same hooks, same layout, same Tailwind approach)
- [x] No PHI in logs (API only logs non-PHI: status codes, error types)
- [x] TypeScript strict mode — no `any` types
- [x] Build passes with 0 errors

---

## Dependencies for Full Functionality

| Dependency | Status | Impact |
|------------|--------|--------|
| `CSG_API_KEY` env var | NOT SET | Medicare quoting shows setup instructions (graceful fallback) |
| Firestore `flow/config/stages` | Needs data | Pipelines falls back to default 4 stages |
| Firestore `flow/config/instances` | Needs data | Pipeline board shows empty state |
| Firestore `pipelines` | Needs data | Pipeline selector shows no options |
| DEX integration | Not built | Discovery Kit PDF generation is placeholder |

---

## Merge Notes

- **PortalSidebar.tsx** is a shared file — Builder 31 may also modify it (adding Quick Intake). Merge both additions into the Pipelines section items array.
- **server.ts** — I added one import + one route mount at the end of the existing lists. Should merge cleanly.
- All other files are in directories exclusive to this builder scope.
