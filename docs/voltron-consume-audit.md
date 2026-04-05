# VOLTRON CONSUME — Phase 1 Audit Report

> VOL-C01 + VOL-C05 | Date: 2026-04-05 | Author: RONIN

---

## VOL-C01: CommandCenter Module Audit

### Current State
- **File**: `packages/ui/src/modules/CommandCenter.tsx` — 377 lines, complete
- **What it is**: Business operations metrics dashboard (clients, revenue, pipeline, tasks)
- **What it is NOT**: A VOLTRON Command Center. Zero awareness of registry, wires, specialists, or sessions.

### Collections Referenced (direct client-side queries)
`clients`, `opportunities`, `revenue`, `campaigns`, `case_tasks`, `users`, `agents`

### Issues Found
1. Full-collection loads with no `where` filters or `limit` — expensive at scale
2. Quick Actions hardcode ProDash-specific routes (`/clients`, `/pipelines`) — wrong on SENTINEL
3. Renders `t._id` as task label instead of human-readable name

### Portal Pages Using It
- `apps/prodash/app/(portal)/modules/command-center/page.tsx` (10 lines, thin wrapper)
- `apps/sentinel/app/(portal)/modules/command-center/page.tsx` (10 lines, thin wrapper)

### Recommendation: REPLACE
Create new directory-based module `packages/ui/src/modules/CommandCenter/`. The existing `CommandCenter.tsx` serves a completely different purpose (business metrics vs VOLTRON ops). Extending it would create one component serving two unrelated surfaces.

### VOLTRON API Surface (Available for Command Center)

| Route File | Endpoints | Collection |
|---|---|---|
| `voltron-registry.ts` (254 lines) | `GET /api/voltron/registry` (role-filtered), `POST /api/voltron/registry/regenerate` (VP+) | `voltron_registry` |
| `voltron-wire.ts` (274 lines) | `POST /api/voltron/wire/execute`, `GET /api/voltron/wire/:id/status`, `GET /api/voltron/wire/:id/stream` (SSE), `POST /api/voltron/wire/:id/approve` | `wire_executions` |
| `specialist-configs.ts` (118 lines) | CRUD: `GET/POST/PATCH /api/specialist-configs` | `specialist_configs` |
| `voltron-deploy.ts` (566 lines) | `POST /api/voltron/deploy`, `GET /api/voltron/deploy/stream/:sessionId` (SSE), approve/reject | `voltron_sessions` |

---

## VOL-C05: voltron_registry Firestore Audit

### Registry Schema (VoltronRegistryEntry)
```typescript
interface VoltronRegistryEntry {
  tool_id: string
  name: string
  description: string
  type: 'ATOMIC' | 'SUPER' | 'WIRE'
  source: 'API_ROUTE' | 'MCP' | 'VOLTRON' | 'FIRESTORE'
  entitlement_min: 'COORDINATOR' | 'SPECIALIST' | 'DIRECTOR' | 'VP' | 'ADMIN'
  parameters: Record<string, unknown>
  server_only: boolean
  generated_at: string
}
```

### Key Finding: NO `domain` FIELD EXISTS
- The `domain` field does not exist in VoltronRegistryEntry
- 723 entries are undifferentiated — no Lion domain tagging
- VOL-C06 must add `domain` field to both the TypeScript interface AND the Firestore documents

### Entry Count: 723
- Bulk are ATOMIC / API_ROUTE type (auto-generated from API route scanning)
- SUPER tools and WIRE definitions from in-memory constants
- Generated snapshot: `packages/core/src/voltron/generated/voltron-registry.json` (11,100 lines)

### Collections Comparison

| Collection | Purpose | Schema |
|---|---|---|
| `voltron_registry` | VOLTRON tool registry (723 entries) | VoltronRegistryEntry — no domain field |
| `specialist_configs` | ProZone field scheduling (territories, tiers, slots) | config_id, territory_id, tier_map, slot_templates, etc. |
| `mdj_specialist_configs` | VOLTRON Lions routing (the 5 specialists) | specialist_name, display_name, icon, routing_keywords, required_level, status |

**CRITICAL**: `specialist_configs` and `mdj_specialist_configs` are COMPLETELY DIFFERENT collections despite similar names. The former is field ops scheduling, the latter is VOLTRON AI routing.

### QUE Registry (Separate System)
- 59 entries in `packages/core/src/que/registry.ts`
- Has a `domain` field but hardcoded to `'que'`
- NOT stored in `voltron_registry` — parallel registry with different schema
- 25 calc tools, 8 lookup tools, 5 generators, 10 super tools, 10 wires

### Recommendation for VOL-C06 (Domain Tagging Migration)
1. Add `domain` field to `VoltronRegistryEntry` interface in `packages/core/src/voltron/types.ts`
2. Write migration script to classify 723 entries by tool name keywords
3. Valid domains: `medicare`, `annuity`, `investment`, `life-estate`, `legacy-ltc`, `general`
4. Classification will be keyword-based using tool names and descriptions
5. Script must be idempotent — safe to run multiple times

### mdj_specialist_configs (No TypeScript Type)
- No DTO or interface exists — schema is implicit in `mdj.ts` line 304-312
- VOL-C07 should create a proper TypeScript type for this collection
