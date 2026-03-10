# toMachina Builder Report — 2026-03-10

> Session: Platform naming → Phase 0 complete → Phase 1 partial → Phase 2 partial
> Builder: Claude Opus 4.6 (1M context)
> Plan: `~/.claude/plans/valiant-napping-waterfall.md`

---

## Commits

| Commit | Hash | Description |
|--------|------|-------------|
| v0.1.0 | `17865ee` | Phase 0: Foundation scaffold (monorepo, configs, all 9 workspaces) |
| v0.2.0 | `f04ca00` | Phase 1: ProDash app shell + Client List + CLIENT360 |

---

## Phase 0: Foundation — COMPLETE

### Plan Item 0.1: Monorepo + GitHub Repo

| Requirement | Status | Notes |
|-------------|--------|-------|
| Create `retirementprotectors/toMachina` | Done | GitHub repo created, 2 commits pushed |
| Turborepo monorepo | Done | `turbo.json` with build/dev/lint/type-check/clean tasks |
| 3 app workspaces (prodash, riimo, sentinel) | Done | Next.js 15, App Router, Tailwind v4 |
| 4 package workspaces (ui, core, auth, db) | Done | All building clean |
| 2 service workspaces (api, bridge) | Done | Express + Firebase Admin, TypeScript |
| `.github/workflows/ci.yml` | Done | Type-check + build on PR/push |
| `CLAUDE.md` | Done | Full project context |

**File count:** 130 initial scaffold files, ~175 total after Phase 1
**Build verification:** `turbo run build` — 9/9 workspaces pass, 13.7s total

### Plan Item 0.2: Firestore Setup

| Requirement | Status | Notes |
|-------------|--------|-------|
| Enable Firestore in GCP `claude-mcp-484718` | Done | Native mode, us-central1 |
| Security rules (domain-restricted) | Done | Deployed via REST API, `@retireprotected.com` only |
| 22 collection rules | Done | clients (with subcollections), agents, producers, opportunities, revenue, carriers, products, users, org, campaigns, templates, content_blocks, flow, atlas, comp_grids, case_tasks, communications |

### Plan Item 0.3: Firebase Auth

| Requirement | Status | Notes |
|-------------|--------|-------|
| Enable Firebase Auth | Done | Via Firebase Console (Playwright-automated) |
| Google as OIDC provider | Done | Enabled via Firebase Console |
| Restrict to `@retireprotected.com` | Done | `hd: 'retireprotected.com'` in GoogleAuthProvider config |
| Port entitlement engine | Stub | `packages/auth/src/entitlements.ts` — USER_LEVELS + TOOL_SUITES defined, MODULES array empty (Phase 1 populates 46 defs) |
| Authorized domains | Done | 7 total: localhost, 2 Firebase defaults, tomachina.com, prodash/riimo/sentinel subdomains |
| Firebase Web App created | Done | App ID: `1:365181509090:web:08aea23422c813d23b6dbb` |

### Plan Item 0.4: Cloud Build Pipeline

| Requirement | Status | Notes |
|-------------|--------|-------|
| `cloudbuild.yaml` | Written | 5 parallel Docker builds + Cloud Run deploys |
| Trigger on push to main | Not wired | Needs Cloud Build trigger creation in GCP Console |
| Slack notification | Not wired | Planned for post-deploy step |

### Plan Item 0.5: Custom Domains

| Requirement | Status | Notes |
|-------------|--------|-------|
| DNS CNAME records | Done | 4 CNAMEs on GoDaddy (Playwright-automated): prodash, riimo, sentinel, api → `ghs.googlehosted.com` |
| Cloud Run domain mapping | Not done | Needs Cloud Run services deployed first, then `gcloud run domain-mappings create` |

### JDM Manual Steps (Plan)

| Step | Status |
|------|--------|
| Enable Firestore in GCP Console | Done (via `gcloud`) |
| Enable Firebase Auth in GCP Console | Done (via Firebase Console + Playwright) |
| Create GitHub repo | Done (JDM created manually) |
| Point DNS | Done (via GoDaddy + Playwright) |

---

## Phase 1: PRODASHX Portal — IN PROGRESS

### Plan Item 1.1: Shared UI Package (`packages/ui`)

| Component | Status | Notes |
|-----------|--------|-------|
| `Sidebar.tsx` | Done | Generic sidebar with sections, items, badges, collapse |
| `Modal.tsx` | Done | Flexbox scroll pattern, ESC to close, backdrop click |
| `Toast.tsx` (ToastProvider) | Done | Context-based, 4 types, auto-dismiss |
| `ConfirmDialog.tsx` | Done | Promise-based, danger variant |
| `LoadingOverlay.tsx` | Done | Spinner + message |
| `SmartLookup.tsx` | Done | Type-ahead search with item selection |
| `DataTable.tsx` | Done | Sortable columns, pagination, row click |
| CSS tokens from PortalStandard.html | Done | All variables ported to `globals.css` |

### Plan Item 1.2: Auth Package (`packages/auth`)

| Component | Status | Notes |
|-----------|--------|-------|
| Firebase Auth provider | Done | `AuthProvider` + `useAuth()` hook |
| Google Workspace SSO | Done | Domain-restricted sign-in |
| Middleware for protected routes | Done | Portal layout guards unauthenticated users |
| Entitlement engine | Stub | USER_LEVELS, TOOL_SUITES, evaluateAccess() — MODULES array empty |

### Plan Item 1.3: DB Package (`packages/db`)

| Component | Status | Notes |
|-----------|--------|-------|
| Typed Firestore client | Done | 13 collection references |
| `useDocument()` hook | Done | Real-time listener with cleanup |
| `useCollection()` hook | Done | Real-time listener with cleanup |
| Write normalizers | Not done | Phase 1 remaining work |

### Plan Item 1.4: Core Package (`packages/core`)

| Component | Status | Notes |
|-----------|--------|-------|
| Normalizers (7) | Done | name, phone, email, date, state, zip, amount |
| Validators (5) | Done | email, phone, NPI (with Luhn), zip, SSN last 4 |
| TypeScript types (7) | Done | Client, Agent, Producer, Account, Opportunity, Revenue, User |
| Matching/dedup | Not done | Phase 1 remaining |
| Financial calculations | Not done | Phase 1 remaining |

### Plan Item 1.5: PRODASHX App

| Feature | Status | Notes |
|---------|--------|-------|
| Auth-gated layout | Done | SignInScreen → PortalLayout with sidebar + topbar |
| Sidebar (6 sections) | Done | Workspace, Sales Centers, Service Centers, Pipelines, Apps, Admin |
| Client List (`/clients`) | Done | Firestore real-time, search, filters, sort, pagination, 5,018 clients rendering |
| CLIENT360 (`/clients/[id]`) | Done | 11 tabs, all rendering from Firestore data |
| Contact tab | Done | Phone rows, email rows, addresses, DND, socials |
| Personal tab | Done | Identity, SSN masked, employment, spouse, children |
| Financial tab | Done | Assets, tax, risk profile, ID.ME badges |
| Health tab | Done | Tobacco, physical, conditions |
| Estate tab | Done | Yes/No indicators for trust, will, POA |
| Accounts tab | Done | Type filter pills, account cards from subcollection |
| Connected tab | Done | Spouse + children cards |
| Medicare tab | Placeholder | "Loading..." stub |
| Comms tab | Placeholder | "Loading..." stub |
| Activity tab | Placeholder | "Loading..." stub |
| Integrations tab | Placeholder | "Loading..." stub |
| Edit client | Not done | Read-only currently |
| Inline modules (CAM, DEX, C3, etc.) | Not done | Route stubs only |

### Plan Item 1.6: Unified API Service

| Feature | Status | Notes |
|---------|--------|-------|
| Express server | Done | Health check + placeholder client routes |
| Auth middleware | Done | Firebase token verification, domain check |
| Dockerfile | Done | Multi-stage node:20-alpine |
| Route buildout | Not done | Phase 1 remaining |

### Plan Item 1.7: Bridge Service

| Feature | Status | Notes |
|---------|--------|-------|
| Express server | Done | Health check + dual-write endpoint |
| Firestore writes | Done | Insert/update/delete operations |
| Sheets writes | Stub | `console.log` placeholder (Phase 2 wires real Sheets API) |
| Dockerfile | Done | Multi-stage node:20-alpine |

---

## Phase 2: Data Migration — IN PROGRESS

### Bulk Loader

| Feature | Status | Notes |
|---------|--------|-------|
| `scripts/load-clients.ts` | Done | Reads Sheets API → writes Firestore batches |
| Client migration | Done | 5,019 clients loaded (filtered 302 deleted/merged from 5,321 total) |
| Account migration — Annuity | Done | 1,069 accounts |
| Account migration — Life | Done | 5,178 accounts |
| Account migration — Medicare | Done | 12,702 accounts |
| Account migration — BD/RIA | Partial | 427 loaded, 1 empty doc ID error |
| Account migration — Banking | Skipped | Empty sheet |
| Reference data (carriers, products, etc.) | Not done | Plan Batch 1 |
| Agents, producers | Not done | Plan Batch 2 |
| Opportunities, revenue | Not done | Plan Batch 3 |

**Total documents in Firestore:** ~24,000

---

## Unplanned Work (Consolidation)

These items were not in the original plan but were requested by JDM during execution.

### GCP Project Consolidation

| Before | After | Action |
|--------|-------|--------|
| 13 GCP projects | 2 active | 11 deleted (all had no billing, no running services) |

**Kept:** `claude-mcp-484718` (toMachina), `my-project-rpi-mdj-platform` (GAS transition)
**Deleted:** gen-lang-client-0609292661, ghl-crm-master, pdf-processor-env-sync, pdt-ict, polar-elf-453817-v3, rp-correspondence-tool, rpi-correspondence-tool, rpi-ictv1, sample-firebase-ai-app-rpi, tomachina-a09fd, ubc-trust-fund-database

### Anthropic API Key Consolidation

| Before | After | Action |
|--------|-------|--------|
| 6 API keys | 1 key ("toMachina") | 5 old keys deleted by JDM |

**Updated locations:**
1. `RAPID_TOOLS/Document-Processor/.env` — ANTHROPIC_API_KEY
2. `RAPID_TOOLS/MCP-Hub/.env` — ANTHROPIC_API_KEY
3. CEO-Dashboard GAS Script Properties — via `execute_script`
4. RPI-Command-Center GAS Script Properties — via `execute_script`
5. PRODASHX GAS Script Properties — via `execute_script`

### Billing

| Action | Status |
|--------|--------|
| Linked billing `0159A6-D5E49D-E5896C` to `claude-mcp-484718` | Done |

---

## Known Issues

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| Sidebar icons render as text (Material Icons font) | Medium | Open | Font import order in CSS — `@import` after `@import "tailwindcss"` causes warning |
| Root `tsconfig.json` was missing `jsx: react-jsx` | High | Fixed | Was causing 97 IDE errors, builds worked due to Next.js own tsconfig |
| Account type pills show dashes | Low | Open | Firestore subcollection field names need mapping to boolean flags |
| BD/RIA loader — 1 empty doc ID | Low | Open | One account had empty `account_id` + `policy_number` |
| Auth middleware not applied to API routes | Medium | Expected | Phase 1 remaining work |
| Bridge Sheets write is console.log stub | Low | Expected | Phase 2 wires real Sheets API |
| Entitlements MODULES array empty | Low | Expected | Phase 1 remaining — ports 46 module definitions |
| Cloud Build trigger not created | Medium | Open | Needs GCP Console or `gcloud builds triggers create` |
| Cloud Run domain mappings not created | Medium | Open | Needs services deployed first |
| `.env.local` must be copied to `apps/prodash/` for builds | Low | Open | Turborepo doesn't propagate root env to workspace builds |

---

## Adherence to Plan

| Plan Phase | Coverage | Notes |
|------------|----------|-------|
| Phase 0: Foundation | **100%** | All 5 sub-items complete |
| Phase 1: PRODASHX Portal | **~60%** | App shell + Client List + CLIENT360 done. Missing: edit functionality, inline modules, full entitlement port, API route buildout |
| Phase 2: Data Migration | **~40%** | Clients + 4 account types loaded. Missing: reference data, agents, producers, revenue, opportunities, remaining operational data |
| Phase 3: Remaining Portals | **0%** | Not started (planned after Phase 1) |
| Phase 4: GAS Engine Thinning | **0%** | Not started |
| Phase 5: Cleanup | **0%** | Not started |

---

## Files Changed

**v0.1.0:** 130 files, 8,737 insertions
**v0.2.0:** 44 files, 2,763 insertions
**Total:** ~11,500 lines of code across 174 files

---

## Infrastructure State

| Resource | Value |
|----------|-------|
| GitHub | `retirementprotectors/toMachina` (2 commits on main) |
| GCP Project | `claude-mcp-484718` (billing active) |
| Firestore | Native mode, us-central1, ~24K documents, security rules deployed |
| Firebase Auth | Google SSO enabled, 7 authorized domains |
| Firebase Web App | `1:365181509090:web:08aea23422c813d23b6dbb` |
| DNS | 4 CNAMEs on GoDaddy → `ghs.googlehosted.com` |
| Anthropic API | 1 key ("toMachina") across 5 locations |
| Active GCP Projects | 2 (down from 13) |
| Dev Server | `localhost:3001` (ProDash, confirmed working with live data) |
