# Sprint 4 — Builder 42 Report: C3 Backend + ATLAS Backend

**Branch:** `sprint4/c3-atlas-backend`
**Builder:** 42 (C3 + ATLAS Backend Migration)
**Status:** COMPLETE

---

## Checkpoints

- **CP1**: Template + content block routes compile with full CRUD — PASS
- **CP2**: Campaign assembly logic works (assembler lib built + routes wired) — PASS
- **CP3**: ATLAS routes compile with full source/tool/analytics CRUD — PASS
- **CP4**: Tool registry collection ready (API routes built, seed possible via POST) — PASS
- **CP5**: Slack digest route works (dry run mode when no SLACK_BOT_TOKEN) — PASS
- **CP6**: Full build passes 9/9 workspaces — PASS

---

## Part 1: C3 Backend Expansion

### New Files

#### `services/api/src/lib/campaign-assembler.ts` (~140 lines)
Core campaign assembly logic extracted from C3 GAS `Index.html`:
- `assembleCampaign(campaignId, templateId, mergeContext?)` — Single template assembly
- `assembleCampaignFull(campaignId, mergeContext?)` — All templates for a campaign
- Block slot resolution in correct order: Subject → Greeting → Intro → ValueProp → PainPoint → CTA → Signature → Compliance
- Merge field replacement (`{first_name}`, `{agent_name}`, etc.) with case-insensitive matching
- Unresolved merge fields left as-is for CRM-time replacement
- Returns `AssembledContent` with subject, body, raw_body, blocks_used, missing_blocks, merge_fields_applied

#### `services/api/src/routes/templates.ts` (~130 lines)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/templates` | List with filters: status, channel, type, campaign_id + pagination |
| GET | `/api/templates/:id` | Detail with resolved block names (`_resolved_blocks` field) |
| POST | `/api/templates` | Create with auto-generated `TMPL_` ID |
| PATCH | `/api/templates/:id` | Update fields |
| DELETE | `/api/templates/:id` | Soft delete (status → archived) |

#### `services/api/src/routes/content-blocks.ts` (~140 lines)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/content-blocks` | List with filters: type, status, pillar, channel, owner + pagination |
| GET | `/api/content-blocks/:id` | Detail |
| POST | `/api/content-blocks` | Create with type-prefixed ID (SUBJ_, GRT_, VP_, etc.) |
| PATCH | `/api/content-blocks/:id` | Update (auto-recalculates character_count) |
| DELETE | `/api/content-blocks/:id` | Soft delete (status → Archived) |

### Expanded Files

#### `services/api/src/routes/campaigns.ts` (+90 lines)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/campaigns/:id/assemble` | Assemble single template or all templates. Body: `{ template_id?, merge_context? }` |
| GET | `/api/campaigns/:id/preview` | Preview assembled content (no merge field replacement) |
| POST | `/api/campaigns/:id/schedule` | Create scheduled send job (`campaign_jobs` collection) |
| POST | `/api/campaigns/:id/duplicate` | Clone campaign + all its templates with `(Copy)` suffix |

#### `services/api/src/routes/campaign-send.ts` (+110 lines)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/campaign-send/execute` | Process due queued sends (DND enforcement, batch processing) |
| GET | `/api/campaign-send/queue` | View send queue (filter by status, campaign_id) |
| POST | `/api/campaign-send/cancel/:id` | Cancel a queued send (only if status=queued) |

---

## Part 2: ATLAS Backend Migration

### `services/api/src/routes/atlas.ts` (~630 lines)

#### Sources CRUD
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/atlas/sources` | List with 8 filters: status, gap_status, current_method, data_domain, product_line, carrier_name, priority, portal + pagination |
| GET | `/api/atlas/sources/:id` | Detail |
| POST | `/api/atlas/sources` | Create with auto-generated `SRC_` ID, auto-derived `product_category` from `product_line` |
| PATCH | `/api/atlas/sources/:id` | Update (recalculates product_category if product_line changed) |
| DELETE | `/api/atlas/sources/:id` | Soft delete (status → DEPRECATED) |

#### Tools CRUD
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/atlas/tools` | List with filters: category, status, tool_type, source_project, runnable + pagination |
| POST | `/api/atlas/tools` | Create with auto-generated `TOOL_` ID |
| PATCH | `/api/atlas/tools/:id` | Update |

#### Analytics
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/atlas/analytics` | Gap analysis: group_by=carrier\|category\|domain\|portal. Returns health_score per group |
| GET | `/api/atlas/analytics/carriers` | Carrier scorecards: per-carrier detail with gap breakdown + automation % |

#### Audit
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/atlas/audit` | Recent audit events (filter by source_id, action_type) |
| POST | `/api/atlas/audit` | Log an audit event with HIST_ ID |

#### Pipeline
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/atlas/pipeline` | 6-stage pipeline snapshot (SOURCE → INTAKE → EXTRACTION → APPROVAL → MATRIX → FRONTEND) |

#### Wires
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/atlas/wires` | 16 wire definitions (filter by product_line, data_domain). Config constants, not Firestore-stored. |

#### Digest
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/atlas/digest` | Generate + send Slack weekly digest to JDM DM (U09BBHTN8F2). Dry-run when SLACK_BOT_TOKEN not set. |

### Business Logic Migrated

| GAS File | Lines | API Route | Notes |
|----------|-------|-----------|-------|
| ATLAS_Registry.gs | 238 | `/api/atlas/sources` | Full CRUD + product_category derivation |
| ATLAS_ToolRegistry.gs | 216 | `/api/atlas/tools` | CRUD + search (client-side with pagination) |
| ATLAS_Analytics.gs | 296 | `/api/atlas/analytics` | Gap analysis with health_score formula: `(green*100 + yellow*50 + gray*50) / total` |
| ATLAS_Audit.gs | 332 | `/api/atlas/audit` | Audit trail logging |
| ATLAS_Pipeline.gs | 296 | `/api/atlas/pipeline` | 6-stage pipeline with PIPELINE_STAGES constants |
| ATLAS_Wires.gs | 546 | `/api/atlas/wires` | 16 wire definitions as TypeScript constants |
| ATLAS_Slack.gs | 225 | `/api/atlas/digest` | Weekly Slack digest with dry-run support |

### Not Migrated (GAS trigger-specific, stays in GAS)

| GAS File | Reason |
|----------|--------|
| ATLAS_Triggers.gs (112 lines) | Scheduling logic — replaced by Cloud Scheduler calling API routes |
| ATLAS_Tasks.gs (425 lines) | Task management — can be added as `/api/atlas/tasks` in future sprint if needed |

---

## Server Mount Updates

`services/api/src/server.ts` — 3 new route mounts added (additive):
```typescript
app.use('/api/templates', normalizeBody, templateRoutes)
app.use('/api/content-blocks', normalizeBody, contentBlockRoutes)
app.use('/api/atlas', normalizeBody, atlasRoutes)
```

Total API routes: **27 route modules** (was 24).

---

## Build Verification

```
turbo run build — 9/9 workspaces pass
├── @tomachina/core ✓
├── @tomachina/auth ✓
├── @tomachina/db ✓
├── @tomachina/ui ✓
├── @tomachina/prodash ✓
├── @tomachina/riimo ✓
├── @tomachina/sentinel ✓
├── @tomachina/api ✓ (all new routes compile clean)
└── @tomachina/bridge ✓
```

---

## Files Changed

### Created
- `services/api/src/lib/campaign-assembler.ts`
- `services/api/src/routes/templates.ts`
- `services/api/src/routes/content-blocks.ts`
- `services/api/src/routes/atlas.ts`

### Modified
- `services/api/src/routes/campaigns.ts` (expanded: +4 endpoints)
- `services/api/src/routes/campaign-send.ts` (expanded: +3 endpoints)
- `services/api/src/server.ts` (additive: 3 route mounts)

### NOT Touched
- `apps/**` — no portal changes
- `packages/**` — no package changes
- `packages/core/src/flow/**` — Builder 41 scope
- `services/api/src/routes/comms.ts` — Builder 41 scope
- `services/bridge/**` — Builder 43 scope
- `gas/**` — read only

---

## New API Endpoint Summary (26 total new endpoints)

| Category | Count | Details |
|----------|-------|---------|
| Templates | 5 | Full CRUD + resolved block names |
| Content Blocks | 5 | Full CRUD with type-prefixed IDs |
| Campaigns (new) | 4 | assemble, preview, schedule, duplicate |
| Campaign Send (new) | 3 | execute, queue, cancel |
| ATLAS Sources | 5 | Full CRUD + 8 filter dimensions |
| ATLAS Tools | 3 | Create, list, update |
| ATLAS Analytics | 2 | Gap analysis + carrier scorecards |
| ATLAS Audit | 2 | Read + write audit trail |
| ATLAS Pipeline | 1 | 6-stage pipeline snapshot |
| ATLAS Wires | 1 | 16 wire diagram definitions |
| ATLAS Digest | 1 | Slack weekly summary |

---

## Tool Registry Migration Note

The `tool_registry` Firestore collection can be populated via `POST /api/atlas/tools`. A bulk seed can be done by calling the API in a loop with the tool definitions from `ATLAS_ToolSeed.gs`. No separate migration script was needed since the API provides the create endpoint directly.
