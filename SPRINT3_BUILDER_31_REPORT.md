# Sprint 3 — Builder 31 Report: ProDashX Client Experience

**Branch:** `sprint3/prodashx-client-experience`
**Date:** 2026-03-11
**Status:** COMPLETE

---

## What Was Built

### 1. RMD Center (HIGH priority) — COMPLETE
**Files:** `apps/prodash/app/(portal)/service-centers/rmd/page.tsx`, `packages/core/src/financial/rmd.ts`

- **IRS RMD Calculation Engine** (`packages/core/src/financial/rmd.ts`):
  - Full IRS Uniform Lifetime Table (ages 72-120)
  - SECURE Act 2.0 rules: age 73 (born 1951-1959), age 75 (born 1960+)
  - `calculateRmd()` — single-year RMD with urgency tracking
  - `generateRmdSchedule()` — 15-year projection with configurable growth rate
  - `isRmdEligible()` — account type classifier (excludes Roth, life, medicare)
  - `getRmdStartAge()` — birth-year-based start age
  - `getDistributionPeriod()` — Uniform Lifetime Table lookup
  - All functions exported via `@tomachina/core` barrel

- **RMD Center Page**:
  - Scan button loads all client accounts, filters RMD-eligible
  - Summary cards: Total, Pending (with $ amount), Completed, Overdue
  - Status filter pills: All / Pending / Completed / Overdue
  - Search by client name or carrier
  - List/detail layout: click a record → detail panel + 15-year projection table
  - Urgency indicators: color-coded (overdue=red, urgent=orange, soon=amber, normal=blue, completed=green)
  - Projection table shows year, age, projected balance, RMD amount

### 2. Beni Center (MEDIUM priority) — COMPLETE
**File:** `apps/prodash/app/(portal)/service-centers/beni/page.tsx`

- Scans all client accounts (excludes Medicare) for beneficiary status
- **6-tier classification** (ported from archive `PRODASH_BENI_CENTER.gs`):
  - `empty` — no beneficiary at all
  - `conflict` — JSON vs flat fields disagree
  - `reactive` — primary is divorced/deceased spouse
  - `under` — primary allocation < 100%
  - `partial` — has primary, no contingent
  - `ok` — complete
- Completeness score with progress bar
- Issue stat cards: No Beneficiary, Incomplete, Needs Review
- Filter by issue type + search
- Each row shows client, carrier, issue badge, and beneficiary details

### 3. Quick Intake (MEDIUM priority) — COMPLETE
**Files:** `apps/prodash/app/(portal)/intake/page.tsx`, sidebar updated

- One-screen client creation form
- Required: first_name, last_name + phone OR email
- Optional: dob, source (dropdown), address/city/state/zip
- **Auto-dedup check**: searches by last_name, phone digits, email before creating
  - Shows matching records with links to existing CLIENT360
  - "Create Anyway" to proceed if intentional
- On success: writes to Firestore `clients` collection, redirects to CLIENT360
- Added "Quick Intake" to PortalSidebar → Workspace section

### 4. Casework Depth (MEDIUM priority) — COMPLETE
**File:** `apps/prodash/app/(portal)/casework/page.tsx`

- Full case management replacing the "coming soon" stub
- Case list with status filters: All / Open / In Progress / Blocked / Completed
- List/detail layout with task management:
  - Click checkboxes to toggle tasks complete/open
  - Add new tasks inline (Enter to submit)
  - Priority dots (low=blue, medium=amber, high=orange, urgent=red)
  - Progress bar showing task completion %
- Status workflow: buttons to move case between states
- Notes system: add timestamped notes, displayed newest-first
- New Case modal: title, description, client name, priority
- Real-time Firestore updates on all mutations

### 5. CLIENT360 Rich Tab Enrichments (HIGH priority) — COMPLETE

| Tab | Enrichment |
|-----|-----------|
| **Contact** | Added Communication Preferences section (preferred contact, best call time, last contact date) |
| **Financial** | Added Net Worth Summary card (3-column visual cards for investable assets, net worth, household income) |
| **Health** | Added Health Risk Summary (risk level indicator based on tobacco + conditions + family history, last physical date) |
| **Estate** | Added Completeness Score (progress bar, percentage, missing items alert) |
| **Accounts** | Added Account Summary cards (total accounts, total value, active count, pending count) |
| **Activity** | Added type filter pills (All/Create/Update/Email/Call/Note/Import) |
| **Connected** | Added "View Record" link button when spouse has their own client_id |
| **Integrations** | Added copy-to-clipboard buttons on all ID fields (Platform IDs, GHL, External Systems) |
| **Comms** | Already had channel grouping and timeline — unchanged |
| **Medicare** | Already had plan comparison and type breakdown — unchanged |
| **Personal** | Already had two-column layout with age calc — unchanged |

---

## Files Changed

### New Files
| File | Lines | Purpose |
|------|-------|---------|
| `packages/core/src/financial/rmd.ts` | ~170 | IRS RMD calculation engine |
| `apps/prodash/app/(portal)/intake/page.tsx` | ~280 | Quick Intake form |

### Modified Files
| File | Change |
|------|--------|
| `packages/core/src/financial/index.ts` | Added RMD exports to barrel |
| `apps/prodash/app/(portal)/service-centers/rmd/page.tsx` | Full rebuild from stub |
| `apps/prodash/app/(portal)/service-centers/beni/page.tsx` | Full rebuild from stub |
| `apps/prodash/app/(portal)/casework/page.tsx` | Full rebuild from stub |
| `apps/prodash/app/(portal)/components/PortalSidebar.tsx` | Added Quick Intake nav item |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/ContactTab.tsx` | Added comm prefs section |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/FinancialTab.tsx` | Added net worth cards |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/HealthTab.tsx` | Added risk summary |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/EstateTab.tsx` | Added completeness score |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/AccountsTab.tsx` | Added summary cards |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/ActivityTab.tsx` | Added type filter |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/ConnectedTab.tsx` | Added spouse record link |
| `apps/prodash/app/(portal)/clients/[id]/components/tabs/IntegrationsTab.tsx` | Added copy buttons |

### Files NOT Touched (per scope boundaries)
- `packages/ui/src/modules/**` — Sprint 2 territory
- `apps/prodash/app/(portal)/modules/**` — Sprint 2 territory
- `apps/prodash/app/(portal)/sales-centers/**` — Builder 32 territory
- `apps/prodash/app/(portal)/pipelines/**` — Builder 32 territory
- `apps/riimo/**` — Builder 33 territory
- `apps/sentinel/**` — Builder 33 territory
- `services/**` — out of scope

---

## Architecture Decisions

1. **RMD calc in `packages/core`**: Placed in `src/financial/rmd.ts` alongside existing financial modules (fyc, npv, dcf, revenue). This is pure business logic with no UI dependency — can be used by API routes, background jobs, or any portal.

2. **Firestore direct reads for scan operations**: RMD Center and Beni Center scan all clients + accounts on demand rather than maintaining a separate index. This is correct for MVP — the scan runs once per session and results are cached in component state. For production scale (10K+ clients), should add a Cloud Function that pre-computes RMD/beni status.

3. **Casework uses `case_tasks` collection**: Matches the existing Firestore structure from Sprint 1 data integrity work. Tasks and notes stored as arrays within the case document (not subcollections) — simpler CRUD, adequate for typical case sizes (< 50 tasks/notes per case).

4. **Quick Intake dedup uses 3 queries**: Searches by last_name, phone, and email independently. Could be optimized with a composite index or full-text search, but for MVP this handles the common duplicate scenarios.

---

## Verification Checklist

- [x] `packages/core` type-checks clean (`tsc --noEmit` passes)
- [x] No `alert()`, `confirm()`, `prompt()` used
- [x] All components use CSS variables, no hardcoded colors
- [x] No direct Sheets writes — all through Firestore
- [x] No PHI logged to console
- [x] Structured response patterns followed (success/error states)
- [x] No plain dropdowns for known-entity person selection
- [x] Quick Intake added to sidebar navigation
- [x] RMD calculation matches IRS Uniform Lifetime Table
- [x] Beni analysis matches 6-tier classification from archive
- [x] 15 files changed, 2 new files created
- [x] All changes within declared file ownership scope
