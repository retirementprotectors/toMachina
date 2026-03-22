# toMachina — The Machine

> **to** (Greek: "the") + **Machina** (Latin: "machine") = **The Machine**
> The enterprise platform for Retirement Protectors, Inc.
> Updated: 2026-03-13

---

## Domains

| Domain | Purpose |
|--------|---------|
| `tomachina.com` | Primary platform |
| `tomachina.ai` | AI/intelligence features |
| `tomachina.io` | Developer docs / API |

## Architecture

**Monorepo** (Turborepo) with three portal apps, four shared packages, and four backend services.

```
toMachina/
├── apps/
│   ├── prodash/     → prodash.tomachina.com (B2C)
│   ├── riimo/       → riimo.tomachina.com (B2E)
│   └── sentinel/    → sentinel.tomachina.com (B2B)
├── packages/
│   ├── ui/          → Shared React components + modules
│   ├── core/        → Business logic, normalizers, flow engine
│   ├── auth/        → Firebase Auth + entitlements
│   └── db/          → Typed Firestore client
├── services/
│   ├── api/         → Cloud Run API (tm-api, 38+ routes, proxied via portal /api/*)
│   ├── bridge/      → Dual-write Firestore + Sheets
│   ├── intake/      → Cloud Functions (intake channels)
│   └── bigquery-stream/ → Real-time BigQuery sink
└── firebase.json / firestore.rules
```

### Module vs App Architecture

| Type | Branding | Examples |
|------|----------|---------|
| **Modules** | Portal-branded via `var(--portal)` CSS vars. Same component, different color per portal. | Admin, MyRPI, Communications, RPI Connect |
| **Apps** | Own brand identity. Same look in every portal. | ATLAS, CAM, DEX, C3, Command Center, Pipeline Studio (teal) |

### Key Subsystems

- **Flow Engine** (`packages/core/flow/`): Invisible skeleton behind all pipelines. Change engine → all pipelines inherit.
- **Pipeline Studio**: Teal-branded App. Full-screen pipeline builder + admin CRUD API.
- **Communications Module**: Portal-branded slide-out. Feed + compose + dialer. (Mockup — wiring in Sprint 10)
- **RPI Connect**: Portal-branded slide-out. Channels + People + Meet. (Mockup — wiring in Sprint 10)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4, shadcn/ui, @base-ui/react |
| Auth | Firebase Auth (Google Workspace SSO, @retireprotected.com only) |
| Database | Firestore (Native mode), 29K+ docs |
| Analytics | BigQuery (feed-forward via Cloud Functions) |
| Backend | Cloud Run (Express/TypeScript), 38+ route files |
| Build | Turborepo |
| Hosting | Firebase App Hosting (auto-deploy from main when CI passes) |
| GCP Project | `claude-mcp-484718` |

## Portal Themes

| Portal | CSS Variable `--portal` | Port (dev) |
|--------|------------------------|------------|
| ProDashX | `#4a7ab5` (RPI Blue) | 3001 |
| RIIMO | `#a78bfa` (Electric Purple) | 3002 |
| SENTINEL | `#40bc58` (DAVID Green) | 3003 |

## Dev Commands

```bash
# All apps
npm run dev          # Start all apps + services
npm run build        # Build everything (incremental)
npm run type-check   # TypeScript check all workspaces (must pass 13/13 for CI)
npm run build        # Full production build — must pass before pushing (catches webpack/bundler issues type-check misses)

# Single app
npx turbo run dev --filter=@tomachina/prodash

# Single package
npx turbo run build --filter=@tomachina/core
```

**CI requirement**: `npm run type-check` (13/13) AND `npm run build` (11/11) must both pass before pushing. Type-check catches type errors fast (~10s). Build catches webpack/bundler issues that type-check misses (~1-4min). Both run in CI — if either fails, deploy is blocked. The API tsconfig excludes `src/scripts/` (seed scripts import from core source, outside rootDir).

**Security scanning (automated, free):**
- **Dependabot** — monitors `package-lock.json` weekly (Mondays), auto-opens PRs for vulnerable deps, groups minor/patch updates
- **CodeQL** — static analysis on every PR + weekly (Sundays), catches security bugs (injection, XSS, etc.) in TypeScript/JavaScript

**Deploy pipeline**: Branch protection ON. Push to branch → open PR with `gh pr merge --auto --squash --delete-branch` → CI passes → auto-merges to main → deploy-api (Docker build + Artifact Registry + Cloud Run for tm-api + tm-bridge) → Firebase App Hosting auto-deploys portals. Direct push to main is blocked. No manual merge step — `--auto` queues merge for when CI passes. No Cloud Build — Docker runs directly on the GitHub Actions runner.

## Code Standards

### Required
- TypeScript strict mode everywhere
- All API responses: `{ success: boolean, data?: T, error?: string }`
- Firebase Auth required for all routes (middleware)
- `@retireprotected.com` domain restriction enforced at auth + Firestore rules
- PHI rules from global CLAUDE.md apply — NEVER log PHI

### Firestore Query Rules
- **Firestore string queries are CASE-SENSITIVE.** There is no case-insensitive option.
- ALL name searches must title-case the input before querying: `str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()`
- Reference pattern: `apps/prodash/app/(portal)/service-centers/access/page.tsx` line 100
- NEVER query `where('last_name', '>=', rawUserInput)` — always normalize case first
- Long-term: `search_tokens` array field on client records (Sprint 11+)

### API Contract Verification (MANDATORY) [Hook-enforced: warn-untyped-api-response]
- Before writing ANY API route handler: **read the frontend component that consumes it**. Verify field names and types match.
- Before writing ANY frontend fetch call: **read the API route that serves it**. Verify the response shape matches your interface.
- NEVER return a count where the frontend expects an array. NEVER return a flat value where the frontend expects an object.
- When shared types exist in `@tomachina/core/api-types/`, both sides MUST import the same type. (Sprint 10: create DTOs for all 54 route files)
- Root cause: ForgeAudit crash (2026-03-20) — API returned `{ pending: 3 }`, frontend expected `{ pending: TrackerItem[] }`. TypeScript can't check across HTTP boundaries.

### Forbidden
- No `any` types (use `unknown` + type narrowing)
- No inline styles for colors (use CSS variables or Tailwind)
- No direct Sheets writes from portal apps (use bridge service)
- No hardcoded credentials (use env vars)
- No `alert()`, `confirm()`, `prompt()`
- No raw case-sensitive Firestore string queries on name fields (see Firestore Query Rules above)

## Firestore Rules

Collections gated behind `isRPIUser()` (@retireprotected.com domain check):
- `clients`, `accounts` (+ subcollections), `users`, `carriers`, `products`
- `campaigns`, `templates`, `content_blocks`, `org_structure`
- `communications`, `opportunities`, `revenue`, `case_tasks`
- `flow_pipelines`, `flow_stages`, `flow_workflows`, `flow_steps`, `flow_task_templates`, `flow_instances`

## GAS Bridge

Only 3 GAS engines remain: RAPID_IMPORT, DEX, RAPID_CORE. The rest (RAPID_COMMS, RAPID_FLOW, RAPID_API, C3, ATLAS, CAM) were migrated to Cloud Run API routes and archived in Sprint 4-5.

Bridge Sheets writes can be disabled via `SHEETS_WRITE_ENABLED=false` env var on the Bridge Cloud Run service. Firestore is the primary data store.

**GAS reads Sheets. toMachina reads Firestore. Bridge keeps them in sync (when enabled).**

## Sprint Status

Sprints 1-8 COMPLETE. Sprint 9 IN PROGRESS. See `ROADMAP.md` for full details.

## Session URLs

| Resource | URL |
|----------|-----|
| GCP Console | https://console.cloud.google.com/home/dashboard?project=claude-mcp-484718 |
| GitHub | https://github.com/retirementprotectors/toMachina |
| ProDashX (prod) | https://prodash.tomachina.com |
| RIIMO (prod) | https://riimo.tomachina.com |
| SENTINEL (prod) | https://sentinel.tomachina.com |
| API (Cloud Run) | Proxied via portal `/api/*` routes (no public URL — IAM protected) |
