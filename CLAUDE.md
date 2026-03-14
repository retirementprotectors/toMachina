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
│   ├── api/         → api.tomachina.com (Cloud Run, 38+ routes)
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

# Single app
npx turbo run dev --filter=@tomachina/prodash

# Single package
npx turbo run build --filter=@tomachina/core
```

**CI requirement**: `npm run type-check` must pass 13/13 workspaces before Firebase App Hosting will deploy. The API tsconfig excludes `src/scripts/` (seed scripts import from core source, outside rootDir).

## Code Standards

### Required
- TypeScript strict mode everywhere
- All API responses: `{ success: boolean, data?: T, error?: string }`
- Firebase Auth required for all routes (middleware)
- `@retireprotected.com` domain restriction enforced at auth + Firestore rules
- PHI rules from global CLAUDE.md apply — NEVER log PHI

### Forbidden
- No `any` types (use `unknown` + type narrowing)
- No inline styles for colors (use CSS variables or Tailwind)
- No direct Sheets writes from portal apps (use bridge service)
- No hardcoded credentials (use env vars)
- No `alert()`, `confirm()`, `prompt()`

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
| API (prod) | https://api.tomachina.com |
