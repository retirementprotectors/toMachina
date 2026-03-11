# Sprint 6 — Builder 62 Report: C3 Campaign Engine Refresh

**Branch:** `sprint6/c3-campaign-refresh`
**Builder:** 62 (C3 Campaign Engine Refresh)
**Status:** COMPLETE

---

## Part 1: Campaign Engine Core Library

**Created:** `packages/core/src/campaigns/` (5 files, ~400 lines)

### types.ts
- `AudienceFilter` — 8 filter dimensions (status, product, state, zip, age, source, tags, BOB)
- `AudienceResult` — eligible count + DND filtered count + audience IDs
- `SendSchedule`, `SendJob`, `SendResult` — full send lifecycle types
- `CampaignMetrics` — delivery/open/click/bounce rates
- `DeliveryEvent` — webhook-compatible event tracking
- `AEP_BLACKOUT` — Oct 1-Dec 7 blackout config for Medicare campaigns
- `BATCH_SIZE` — 50 recipients per batch

### audience.ts
- `buildAudience(clients, filter, channel)` — Pure function, filters clients by 8 dimensions
- DND enforcement: always filters `dnd_all`, channel-specific `dnd_email`/`dnd_sms`
- Returns structured result with DND breakdown

### scheduler.ts
- `isBlackoutPeriod(date, campaignType)` — AEP blackout check (Oct 1-Dec 7 for Medicare types)
- `getNextSendWindow(date, campaignType)` — Skips blackout, returns Dec 8 if blocked
- `createSchedule()` / `validateSchedule()` — Schedule creation with blackout validation

### orchestrator.ts
- `prepareSendPlan()` — Full orchestration: audience → jobs → batches
- `buildSendJobs()` — Creates SendJob objects with `SJ_` prefixed IDs
- `chunkIntoBatches()` — Splits into batches of 50
- `initSendResult()` / `finalizeSendResult()` — Result tracking lifecycle

### analytics.ts
- `calculateMetrics()` — Campaign metrics from delivery events (rates to 2 decimal places)
- `buildTimeline()` — Daily counts (sent/delivered/opened/clicked/bounced)
- `trackDeliveryEvent()` — Creates formatted delivery event with `EVT_` prefixed ID

**Export added** to `packages/core/src/index.ts`:
```typescript
export * as campaigns from './campaigns'
```

---

## Part 2: Scheduling API

**Expanded:** `services/api/src/routes/campaign-send.ts` (+4 endpoints)

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/campaign-send/schedule` | Schedule future send. Validates date, AEP blackout for Medicare campaigns. Creates `SCHED_` record in `campaign_schedules` collection. |
| GET | `/api/campaign-send/scheduled` | List scheduled sends. Filter by status, campaign_id. |
| PATCH | `/api/campaign-send/scheduled/:id` | Reschedule, update audience filter, or cancel. Only modifiable when status=scheduled. |
| POST | `/api/campaign-send/execute-due` | Process all due schedules. Builds audience (DND filtered), queues sends for first template, marks schedule completed. Called by Cloud Scheduler. |

---

## Part 3: Campaign Analytics API

**Created:** `services/api/src/routes/campaign-analytics.ts` (~250 lines, 5 endpoints)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/:campaignId` | Full performance summary: sent/delivered/bounced/opened/clicked, rates, channel breakdown, schedules |
| GET | `/:campaignId/timeline` | Daily send activity (combines send_log + delivery_events) |
| GET | `/:campaignId/recipients` | Per-recipient delivery status (last 500) |
| POST | `/webhook/sendgrid` | SendGrid delivery webhook. Maps events: delivered, open, click, bounce, unsubscribe. Batch processing. |
| POST | `/webhook/twilio` | Twilio SMS status webhook. Maps: delivered, sent, failed/undelivered. |

**Mounted** in server.ts:
```typescript
app.use('/api/campaign-analytics', campaignAnalyticsRoutes)
```

---

## Part 4: C3Manager Shared Module Rewrite

**Rewritten:** `packages/ui/src/modules/C3Manager.tsx` (~700 lines)

### Tab 1: Campaigns (Enhanced)
- Filterable list with expandable detail cards
- Campaign detail shows metadata grid (type, division, pillar, target count, dates, trigger)
- **AEP blackout warning** shown inline when Medicare campaign during Oct-Dec
- **Send actions**: "Send Now", "Schedule", "Duplicate" buttons in detail view
- Status pills auto-filter campaign list on click

### Tab 2: Templates (Enhanced)
- Grid/list toggle with search
- **Template detail panel** with block slot assignments resolved to names
- **Assembled preview** — concatenates block content in slot order
- **"Test Send" button** in template detail header

### Tab 3: Content Blocks (Kept)
- Type/status/pillar/search filters
- Block cards with content preview, metadata badges, owner

### Tab 4: Builder (Enhanced)
- 4-step workflow: Campaign → Template → Blocks → Preview
- **AEP blackout warning** inline when Medicare campaign selected during blackout
- **DND info panel** explaining automatic DND filtering
- **Send actions**: "Send Now" (disabled during blackout), "Schedule Send", "Test Send"

### Tab 5: Analytics (NEW)
- **7 metric cards**: Sent, Delivered, Opened, Clicked, Bounced, Open Rate, Click Rate
- **Per-campaign performance table** with open rate progress bars (green/yellow/red)
- **Delivery funnel visualization** — bar chart (Sent → Delivered → Opened → Clicked)
- Empty state with guidance when no sends yet

### Shared UI Components (Extracted)
- `StatCard`, `MetricCard`, `EmptyState`, `FilterBar`, `SearchInput`, `SelectFilter`

---

## Build Verification

```
turbo run build — 11/11 workspaces pass
├── @tomachina/core ✓ (campaigns module compiles)
├── @tomachina/auth ✓
├── @tomachina/db ✓
├── @tomachina/ui ✓ (C3Manager rewrite compiles)
├── @tomachina/intake ✓
├── @tomachina/prodash ✓
├── @tomachina/riimo ✓
├── @tomachina/sentinel ✓
├── @tomachina/api ✓ (new routes + expanded routes compile)
├── @tomachina/bridge ✓
└── bigquery-stream ✓
```

---

## Files Changed

### Created (8 files)
- `packages/core/src/campaigns/types.ts`
- `packages/core/src/campaigns/audience.ts`
- `packages/core/src/campaigns/scheduler.ts`
- `packages/core/src/campaigns/orchestrator.ts`
- `packages/core/src/campaigns/analytics.ts`
- `packages/core/src/campaigns/index.ts`
- `services/api/src/routes/campaign-analytics.ts`
- `SPRINT6_BUILDER_62_REPORT.md`

### Modified (4 files)
- `packages/core/src/index.ts` (additive: campaigns export)
- `packages/ui/src/modules/C3Manager.tsx` (rewrite: 5 tabs, send actions, analytics)
- `services/api/src/routes/campaign-send.ts` (expanded: +4 scheduling endpoints)
- `services/api/src/server.ts` (additive: campaign-analytics mount)

### NOT Touched
- `services/api/src/routes/campaigns.ts` — existing CRUD untouched
- `services/api/src/routes/templates.ts` — existing CRUD untouched
- `services/api/src/routes/content-blocks.ts` — existing CRUD untouched
- `services/api/src/lib/campaign-assembler.ts` — used as-is
- `apps/**` — portal pages stay as 3-line imports

---

## New API Endpoint Summary (9 new endpoints)

| Category | Count | Details |
|----------|-------|---------|
| Scheduling | 4 | schedule, list, update/cancel, execute-due |
| Analytics | 3 | summary, timeline, recipients |
| Webhooks | 2 | SendGrid + Twilio delivery status |

**Total campaign-related endpoints now: 22** (was 13 before Sprint 6)

---

## Firestore Collections (New)

| Collection | Purpose |
|------------|---------|
| `campaign_schedules` | Scheduled send records (SCHED_ IDs) |
| `campaign_delivery_events` | Delivery webhook events (EVT_ IDs) |
| `campaign_send_log` | Existing — now also used by analytics |

---

## Part 5: Drip Sequences (Stretch — Not Built)

The drip sequence infrastructure (`packages/core/src/campaigns/drip.ts`) was not built in this sprint. The existing enrollment + queued_sends + touchpoint_day system already provides basic multi-touch sequencing. A dedicated drip engine would add: conditional branching (skip if responded), channel fallback (email fails → try SMS), and response tracking. Recommend as Sprint 7 scope.
