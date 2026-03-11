# Sprint 5 — Builder 52 Report: RAPID_IMPORT Intake Channels + Import Functions

**Branch:** `sprint5/intake-import-migration`
**Builder:** 52 (Intake Channels + Import Functions)
**Status:** COMPLETE

---

## Summary

Rebuilt RAPID_IMPORT's intake system and import functions as modern Cloud Functions + API routes:

1. **Part 1**: `services/intake/` — 4 Cloud Functions for intake channel scanning (SPC, Meet, Mail, Email)
2. **Part 2**: Expanded `services/api/src/routes/import.ts` — Agent, Revenue, Case Task, BoB import, enhanced validation
3. **Part 3**: `scripts/load-email-config.ts` — Email inbox config migration script

---

## Checkpoint Verification

| Checkpoint | Status | Evidence |
|------------|--------|----------|
| CP1: Cloud Functions directory, 4 scanners compile | PASS | `npx tsc --noEmit` — 0 errors |
| CP2: Shared queue management (create, read, update) | PASS | `queue.ts` — 9 exported functions |
| CP3: Import routes expanded (agent, account, revenue, case task, validate, bob) | PASS | 8 new endpoints added |
| CP4: Email config migration script ready | PASS | `scripts/load-email-config.ts` with dry-run mode |
| CP5: Full build passes | PASS | `turbo run build --filter=@tomachina/api` — 2/2 success |

---

## Files Created

| File | Purpose | Lines |
|------|---------|-------|
| `services/intake/package.json` | Cloud Functions package config | 18 |
| `services/intake/tsconfig.json` | TypeScript config for intake service | 17 |
| `services/intake/deploy.sh` | GCP deploy script (Cloud Functions + Scheduler) | 70 |
| `services/intake/src/index.ts` | Cloud Function exports (4 channels × 2 variants + queue status) | 110 |
| `services/intake/src/queue.ts` | Shared queue management — Firestore `intake_queue` | 175 |
| `services/intake/src/spc-intake.ts` | SPC specialist folder scanner | 75 |
| `services/intake/src/meet-intake.ts` | Meet recording scanner | 95 |
| `services/intake/src/mail-intake.ts` | Physical mail scanner with folder moves | 100 |
| `services/intake/src/email-intake.ts` | Gmail inbox scanner with attachment extraction | 115 |
| `services/intake/src/lib/drive-scanner.ts` | Google Drive API adapter (replaces DriveApp) | 115 |
| `services/intake/src/lib/gmail-scanner.ts` | Gmail API adapter (replaces GmailApp) | 110 |
| `services/intake/src/lib/file-processor.ts` | File classification and metadata extraction | 125 |
| `scripts/load-email-config.ts` | Email inbox config migration to Firestore | 85 |

## Files Modified

| File | Change |
|------|--------|
| `services/api/src/routes/import.ts` | Added 8 new endpoints: agent, agents, revenue, revenues, case-task, validate-full, bob, queue/status. Added status/type normalization helpers. |

## Files NOT Touched (scope boundaries respected)

- `packages/core/src/approval/` — Builder 51
- `services/api/src/routes/approval.ts` — Builder 51
- Infrastructure/deploy configs — Builder 53
- `apps/**` — no portal changes
- `gas/**` — GAS source untouched

---

## Part 1: Cloud Functions — Intake Channels

### Architecture

```
Cloud Scheduler (5-min) → Cloud Function (HTTP trigger)
                              ├── Drive API scan (SPC, Meet, Mail)
                              └── Gmail API scan (Email)
                                    ↓
                              Firestore `intake_queue`
                                    ↓
                              Watcher/processor (existing)
```

### Channel Details

| Channel | Source | Trigger | Folder ID | Special Behavior |
|---------|--------|---------|-----------|-----------------|
| SPC_INTAKE | Specialist folders | 5-min scheduler | `1NczjcEifjXuc2uMBN70lHE_ZbtmeFOaU` | Scans subfolders (1 per specialist) |
| MEET_TRANSCRIPT | Meet recordings | 5-min scheduler | env `MEET_RECORDINGS_FOLDER_ID` | Detects audio + transcript files |
| MAIL | Physical mail scans | 5-min scheduler | `1LV32r7w1k98B0S_zfJoavzpLQgsAB1Dg` | Moves to Processed/Errors after queue |
| EMAIL | Gmail inboxes | 5-min scheduler | Configured in Firestore | Extracts attachments, marks read |

### Shared Queue (`intake_queue` collection)

**Status flow:** `QUEUED → EXTRACTING → REVIEWING → APPROVED/PARTIAL/REJECTED → WRITING → COMPLETE/ERROR/SKIPPED`

**Queue entry schema:**
```typescript
{
  queue_id: string,          // UUID
  source: IntakeSource,      // SPC_INTAKE | MEET_TRANSCRIPT | MAIL | EMAIL
  file_id: string,           // Drive file ID or email composite ID
  file_name: string,
  file_type: string,
  status: QueueStatus,
  specialist_name?: string,  // SPC only
  document_type?: string,    // Classified category
  email_from?: string,       // EMAIL only
  email_subject?: string,    // EMAIL only
  email_priority?: string,   // EMAIL only: high|normal|low
  created_at: string,
  updated_at: string,
}
```

### Dedup Prevention

- Every file checked against `intake_queue` before queueing
- Uses `file_id` (Drive ID) or composite `email:{messageId}:{attachmentId}`
- Skips files already in queue with non-terminal status

### File Classification

The `file-processor.ts` classifies files into categories:
- `application_form`, `id_document`, `financial_statement`, `insurance_policy`
- `medical_record`, `correspondence`, `recording`, `transcript`, `photo`, `spreadsheet`

Uses extension mapping + filename pattern matching (regex).

---

## Part 2: Import Routes Expansion

### New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/import/agent` | POST | Single agent import with NPN dedup |
| `/api/import/agents` | POST | Batch agent import (pre-loads NPNs for fast dedup) |
| `/api/import/revenue` | POST | Single revenue import with auto-linking |
| `/api/import/revenues` | POST | Batch revenue import |
| `/api/import/case-task` | POST | Create case task with user validation |
| `/api/import/validate-full` | POST | Enhanced dry-run validation for client/account/agent/revenue |
| `/api/import/bob` | POST | Bulk Book of Business import (full pipeline) |
| `/api/import/queue/status` | GET | Intake queue depth by status + source |

### Agent Import Highlights

- NPN validation: 8-10 digits, cleaned of non-digits
- Dedup: checks by NPN first, then by email
- Batch mode pre-loads all existing NPNs into a Set for O(1) lookups
- Intra-batch dedup prevents importing the same NPN twice in one call

### Revenue Import Highlights

- Auto-links to agent via NPN (`agent_npn` field → Firestore `agents` lookup)
- Auto-links to account via policy number (collectionGroup query across all clients)
- Dedup via `stateable_id` (Stateable API external identifier)
- Type normalization: FYC/REN/OVR with fuzzy aliases

### BoB Import Highlights

- Full pipeline: normalize → validate → dedup → import
- Pre-loads all existing client emails + phones for O(1) dedup
- Handles mixed client + account records (if policy_number present, creates account subcollection)
- Processes in Firestore batch chunks of 400 (under 500 limit)
- Fill-blanks-only merge for existing clients
- Returns detailed summary: imported, skipped, duplicates, errors

### Enhanced Validation (`validate-full`)

Supports 4 entity types with:
- Required field checks
- Format validation (email, phone, NPN, state)
- Typo detection (gmial.com, etc.)
- Normalization preview (returns `normalized_data`)
- Warnings vs errors distinction

---

## Part 3: Email Config Migration

Script at `scripts/load-email-config.ts`:
- Loads 4 known inbox configs to Firestore `email_inbox_config`
- Supports `--dry-run` flag for preview
- Doc IDs derived from email address (deterministic)
- Adds `migrated_at` and `migrated_from` metadata

---

## Build Verification

```
# Intake service
cd services/intake && npx tsc --noEmit → 0 errors

# API service
npx turbo run build --filter=@tomachina/api → 2/2 success, 2.001s
```

---

## Self-Verification Checklist

- [x] No `alert()`, `confirm()`, `prompt()`
- [x] All API functions return `{ success: true/false, data/error }`
- [x] No hardcoded credentials — uses env vars (`CSG_API_KEY`, `MEET_RECORDINGS_FOLDER_ID`)
- [x] No PHI in logs — only log counts, statuses, error types
- [x] TypeScript strict mode — no `any` types (used `unknown` + type narrowing)
- [x] Build passes with 0 errors
- [x] Folder IDs from GAS constants preserved exactly
- [x] Status flow matches GAS: QUEUED → EXTRACTING → REVIEWING → APPROVED → WRITING → COMPLETE

---

## Dependencies for Full Functionality

| Dependency | Status | Impact |
|------------|--------|--------|
| Google Cloud project service account | Needs Drive + Gmail scopes | Cloud Functions can't scan without auth |
| `MEET_RECORDINGS_FOLDER_ID` env var | Not set | Meet intake shows config error |
| `email_inbox_config` collection | Script ready, not run | Email intake returns empty config |
| Cloud Scheduler jobs | deploy.sh ready, not run | Functions won't trigger without scheduler |
| Firestore indexes | May need composite indexes | Queue queries with multiple `where` clauses |

---

## Merge Notes

- `services/api/src/routes/import.ts` is the only shared file — I only appended new routes after the existing `finalize` endpoint. Should merge cleanly with Builder 51's approval routes.
- `services/intake/` is entirely new — no conflicts possible.
- `scripts/load-email-config.ts` is new — no conflicts.
