# toMachina — The Machine

> **to** (Greek: "the") + **Machina** (Latin: "machine") = **The Machine**
> The enterprise platform for Retirement Protectors, Inc.

---

## Domains

| Domain | Purpose |
|--------|---------|
| `tomachina.com` | Primary platform |
| `tomachina.ai` | AI/intelligence features |
| `tomachina.io` | Developer docs / API |

## Architecture

**Monorepo** (Turborepo) with three portal apps, four shared packages, and two backend services.

```
toMachina/
├── apps/
│   ├── prodash/     → prodash.tomachina.com (B2C)
│   ├── riimo/       → riimo.tomachina.com (B2E)
│   └── sentinel/    → sentinel.tomachina.com (B2B)
├── packages/
│   ├── ui/          → Shared React components
│   ├── core/        → Business logic + normalizers
│   ├── auth/        → Firebase Auth + entitlements
│   └── db/          → Typed Firestore client
├── services/
│   ├── api/         → api.tomachina.com (Cloud Run)
│   └── bridge/      → Dual-write Firestore + Sheets
└── cloudbuild.yaml
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS v4 |
| Auth | Firebase Auth (Google Workspace SSO, @retireprotected.com only) |
| Database | Firestore (Native mode) |
| Analytics | BigQuery (feed-forward from Firestore) |
| Backend | Cloud Run (Express/TypeScript) |
| Build | Turborepo, Cloud Build |
| Hosting | Cloud Run (custom domains) |
| GCP Project | `claude-mcp-484718` |

## Portal Themes

| Portal | CSS Variable `--portal` | Port (dev) |
|--------|------------------------|------------|
| ProDash | `#3d8a8f` (teal) | 3001 |
| RIIMO | `#276749` (dark green) | 3002 |
| SENTINEL | `#3CB371` (green) | 3003 |

## Dev Commands

```bash
# All apps
npm run dev          # Start all apps + services
npm run build        # Build everything (incremental)
npm run type-check   # TypeScript check all workspaces
npm run lint         # Lint all workspaces

# Single app
npx turbo run dev --filter=@tomachina/prodash

# Single package
npx turbo run build --filter=@tomachina/core
```

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

## GAS Bridge

During transition, GAS engines (RAPID_IMPORT, RAPID_FLOW, RAPID_COMMS, CAM, DEX, C3, ATLAS) continue running. They write through `CORE_Bridge.gs` which hits the bridge service, keeping Firestore + Sheets in sync.

**GAS reads Sheets. toMachina reads Firestore. Bridge keeps them in sync.**

## Session URLs

| Resource | URL |
|----------|-----|
| GCP Console | https://console.cloud.google.com/home/dashboard?project=claude-mcp-484718 |
| GitHub | https://github.com/retirementprotectors/toMachina |
| ProDash (prod) | https://prodash.tomachina.com |
| RIIMO (prod) | https://riimo.tomachina.com |
| SENTINEL (prod) | https://sentinel.tomachina.com |
| API (prod) | https://api.tomachina.com |
