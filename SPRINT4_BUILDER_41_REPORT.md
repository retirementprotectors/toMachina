# Sprint 4 — Builder 41 Report: RAPID_COMMS + RAPID_FLOW → toMachina

**Branch:** `sprint4/comms-flow-migration`
**Commit:** `1256a3d`
**Status:** COMPLETE — All 4 checkpoints passed

---

## Part 1: RAPID_COMMS → API Routes

**File:** `services/api/src/routes/comms.ts` (310 lines)

### Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/comms/send-email` | Send email via SendGrid v3 |
| POST | `/api/comms/send-sms` | Send SMS via Twilio |
| POST | `/api/comms/send-voice` | Initiate voice call via Twilio |
| GET | `/api/comms/status/:sid` | Check delivery status (auto-detects SMS vs Call from SID prefix) |

### Key Features
- **Dry run mode**: All send endpoints support `?dryRun=true` — logs to Firestore but does NOT call external API
- **Firestore logging**: Every send (real or dry) creates a record in `communications` collection with channel, recipient, status, message ID, timestamp
- **SendGrid**: Bearer token auth, supports template IDs + dynamic data, HTML/text content, reply-to, categories
- **Twilio SMS**: Basic auth, E.164 format, status callbacks, auto-split at 160 chars
- **Twilio Voice**: TwiML inline or URL, call recording, machine detection
- **Status lookup**: SID prefix detection (`CA` = call, `SM` = message) for correct Twilio endpoint

### Env Vars Required
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (default: +18886208587)
- `TWILIO_SMS_NUMBER` (optional, defaults to TWILIO_PHONE_NUMBER)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` (default: noreply@retireprotected.com), `SENDGRID_FROM_NAME`

---

## Part 2: RAPID_FLOW → packages/core/src/flow/

**8 files, 625 lines total**

| File | Lines | Purpose |
|------|-------|---------|
| `types.ts` | 195 | 20+ interfaces: InstanceStatus, TaskStatus, CheckResult, FlowInstanceData, FlowTaskInstanceData, etc. |
| `constants.ts` | 35 | Status enums, collection names, default values |
| `engine.ts` | 175 | State machine: buildNewInstance, getNextStage, canAdvanceStage, buildActivity, recalcProgress, buildTaskInstance |
| `gates.ts` | 115 | 6 built-in check types (FIELD_PRESENT, FIELD_MATCHES, FIELD_NOT_CONTAINS, NUMERIC_LIMIT, ALL_FORMS_CHECKED, MANUAL) + stage/step gate evaluators |
| `hooks.ts` | 60 | Custom check handler registry: registerCheckHandler, dispatchCheck (registered > built-in > PENDING) |
| `query.ts` | 55 | Kanban board builder, JSON field parser |
| `tasks.ts` | 80 | processTaskCompletion (with system check dispatch), processTaskSkip |
| `index.ts` | 10 | Barrel export |

### Architecture Decision: Pure Logic Layer
The flow package is **pure business logic** — no Firestore imports, no async operations. All Firestore I/O is handled by the API routes. This keeps the package testable and usable from both API routes and future portal-side code.

---

## Part 3: Flow API Routes

**File:** `services/api/src/routes/flow.ts` (450 lines)

### Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/flow/pipelines` | List pipeline definitions (filter by portal, status) |
| GET | `/api/flow/pipelines/:key/stages` | Get stages for pipeline (ordered) |
| GET | `/api/flow/instances` | List instances (filter by pipeline, stage, status, assigned_to, entity_type) |
| GET | `/api/flow/instances/:id` | Instance detail + tasks + recent activity |
| POST | `/api/flow/instances` | Create new instance (auto-detects first stage, generates tasks if workflow) |
| PATCH | `/api/flow/instances/:id` | Multi-action: advance, complete, reassign, priority, move |
| POST | `/api/flow/instances/:id/tasks` | Generate tasks from templates for current stage |
| PATCH | `/api/flow/tasks/:id` | Complete or skip a task |

### PATCH Actions
- `advance` — Gate check → advance to next stage → generate tasks
- `complete` — Mark instance as complete
- `reassign` — Change assigned_to
- `priority` — Change priority
- `move` — Free-form stage jump (for Kanban drag-drop on non-gated pipelines)

### Key Features
- All writes go through bridge service (falls back to direct Firestore)
- Activity logging on every state change
- Batch task generation from templates
- Gate enforcement with blocker details in error response
- Cursor-based pagination on instance list

---

## Checkpoints

| CP | Description | Status |
|----|-------------|--------|
| CP1 | COMMS routes compile, dry-run mode works | PASS |
| CP2 | FLOW package builds clean, all types defined | PASS |
| CP3 | FLOW API routes compile, instance CRUD works | PASS |
| CP4 | Full build passes 9/9 | PASS (9/9 tasks successful) |

---

## Files Owned (12 total)

### Created (10)
- `packages/core/src/flow/types.ts`
- `packages/core/src/flow/constants.ts`
- `packages/core/src/flow/engine.ts`
- `packages/core/src/flow/gates.ts`
- `packages/core/src/flow/hooks.ts`
- `packages/core/src/flow/query.ts`
- `packages/core/src/flow/tasks.ts`
- `packages/core/src/flow/index.ts`
- `services/api/src/routes/comms.ts`
- `services/api/src/routes/flow.ts`

### Modified (2)
- `packages/core/src/index.ts` (added `export * from './flow'`)
- `services/api/src/server.ts` (added comms + flow route imports and mounts)

---

## Not Touched
- `apps/**` — no portal changes
- `packages/ui/**` — no UI changes
- `packages/auth/**`, `packages/db/**` — stable
- `gas/RAPID_COMMS/**`, `gas/RAPID_FLOW/**` — untouched (stay as fallback)
- `services/bridge/**` — Builder 42 scope
- Other existing API routes — untouched
