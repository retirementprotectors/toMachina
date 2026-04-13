# Shared File Protocol — Parallel RONIN Builds

> **Read this before writing ANY Discovery Doc that will be built by parallel RONINs.**

## The Problem

When 3+ RONINs build in parallel on isolated worktrees, they ALL touch the same shared files. This creates merge conflicts that the CTO has to resolve manually at PR time. Every conflict wastes time and risks introducing bugs.

## Shared Files (NEVER edit directly from a RONIN track)

| File | What It Does | Why It Conflicts |
|------|-------------|-----------------|
| `services/api/src/server.ts` | Route registration (imports + `app.use()`) | Every CXO adds routes |
| `firestore.rules` | Collection security rules | Every CXO adds collections |
| `packages/core/src/index.ts` | Core barrel exports | Every CXO adds types |
| `packages/ui/src/modules/index.ts` | UI module exports | Every CXO adds components |
| `packages/ui/src/apps/brands.ts` | App key + branding registry | Every CXO adds their app |

## The Belt — Discovery Doc Template Rule

When writing a Track Discovery Doc that includes new API routes, Firestore collections, or module exports:

1. **Create your own route file** (e.g., `routes/cmo-wires.ts`) — do NOT add routes to `server.ts`
2. **Create your own barrel** (e.g., `cmo/index.ts`) — do NOT edit `core/src/index.ts`
3. **Document in a SHARED_FILES section** of your Discovery Doc exactly what needs to be added to each shared file
4. **The CTO resolves shared file edits at merge time** — not the RONIN builder

### Example in a Discovery Doc:

```
## SHARED FILES (CTO resolves at merge)

### server.ts
Add after CMO route block:
- import { myNewRoutes } from './routes/my-new-routes.js'
- app.use('/api/my-domain', normalizeBody, myNewRoutes)

### firestore.rules  
Add inside isRPIUser() block:
- match /my_new_collection/{docId} { allow read: if isRPIUser(); allow write: if isRPIUser(); }
```

## The Suspenders — Auto-Discovery (Architecture Enforcement)

Route files in `services/api/src/routes/` should self-register. When the auto-discovery pattern is implemented (RON-XXX), dropping a new route file in the directory is sufficient — no `server.ts` edit needed.

Until auto-discovery ships, the Belt (template rule) is the enforcement layer.

---

*Created: 2026-04-05 by SHINOB1, CTO. Born from 3 waves of parallel RONIN builds that produced 131 tickets and 22K LOC — and 6 merge conflicts in shared files.*
