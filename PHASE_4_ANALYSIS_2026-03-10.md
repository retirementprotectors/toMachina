# Phase 4: GAS Engine Thinning -- Analysis Report

**Date:** 2026-03-10
**Analyst:** Claude (Research-Only)
**Purpose:** Map every GAS file, function, and dependency to determine what gets archived, thinned, adapted, or kept for the toMachina migration.

---

## Summary

| Metric | Count |
|--------|-------|
| **Total GAS projects analyzed** | 12 |
| **Total .gs files** | 131 |
| **Total .html files** | 56 |
| **Total GS lines** | ~200,591 |
| **Total HTML lines** | ~92,311 |
| **Grand total LOC** | ~292,902 |
| **Projects to ARCHIVE (full)** | 3 (PRODASHX, RIIMO, SENTINEL v2) |
| **Projects to RETIRE** | 1 (RAPID_API) |
| **Projects to THIN** | 1 (RAPID_CORE) |
| **Projects to ADAPT (bridge)** | 1 (RAPID_IMPORT) |
| **Projects that STAY (backend only, UI archived)** | 4 (CAM, DEX, C3, ATLAS) |
| **Projects that STAY unchanged** | 2 (RAPID_COMMS, RAPID_FLOW) |

### LOC Breakdown by Disposition

| Disposition | GS LOC | HTML LOC | Total | % of Codebase |
|-------------|--------|----------|-------|---------------|
| **ARCHIVE** (portals + RAPID_API UI) | 37,056 | 53,580 | 90,636 | 31% |
| **THIN** (RAPID_CORE business logic moves) | ~10,000 | 0 | ~10,000 | 3% |
| **ADAPT** (RAPID_IMPORT bridge writes) | ~170 call sites | 0 | minimal | <1% |
| **STAY** (backends, libraries, triggers) | ~153,535 | 38,731 | ~192,266 | 66% |

---

## Dependency Map

### RAPID_CORE Consumer Map

Every project except RAPID_COMMS depends on RAPID_CORE as a GAS library.

| Consumer | Library Deps | Top RAPID_CORE Functions Used | Call Count |
|----------|-------------|-------------------------------|------------|
| **RAPID_IMPORT** | RAPID_CORE | getTabData (63), getMATRIX_ID (37), normalizeCarrierName (25), getTab (19), matchClient (13), insertRow (11), updateRow (10) | 400+ |
| **RAPID_API** | RAPID_CORE, RAPID_COMMS | getTabData (44), updateRow (40), getRowById (39), insertRow (19), notifyError_ (13) | 200+ |
| **ATLAS** | RAPID_CORE | getTabData (46), updateRow (9), insertRow (7), resolveUser (3), getMATRIX_ID (3) | 72 |
| **RIIMO** | RAPID_CORE | logActivity (15), updateRow (7), getMyProfile (6), resolveUser (4), getUserHierarchy (4) | 70+ |
| **PRODASHX** | RAPID_CORE, RAPID_FLOW, RAPID_COMMS | getMATRIX_ID (22), getTabData (17), getMATRIX_SS (7), insertRow (6), computeModulePermissions (4) | 90+ |
| **SENTINEL v2** | RAPID_CORE | savePipelineConfig (5), getMATRIX_ID (4), computeModulePermissions (2), getAllUsersForPlatform (2) | 30+ |
| **RAPID_FLOW** | RAPID_CORE | updateRow (12), getTabData (10), insertRow (8), invalidateCache (3), getMATRIX_SS (3) | 43 |
| **CAM** | RAPID_CORE | (indirect via own Sheets ops) | minimal |
| **DEX** | RAPID_CORE | getMATRIX_ID (2) | 2 |
| **C3** | RAPID_CORE | (likely minimal, only 6 lines of .gs) | ~0 |

### Critical Dependency: Thinning Order

```
RAPID_CORE thinning MUST happen AFTER:
  1. packages/core has all business logic ported
  2. packages/auth has all entitlement logic ported
  3. services/api/ (Cloud Run) replaces RAPID_API endpoints
  4. services/bridge/ handles dual-write

RAPID_CORE thinning MUST happen BEFORE:
  - RAPID_IMPORT bridge adaptation (it needs thinned RAPID_CORE to still work for Sheets ops)
  - Portal archival (portals are already replaced by toMachina apps)
```

---

## Per-Project Analysis

---

### RAPID_CORE
**Current state:** 19 .gs files, 0 .html files, 17,172 GS LOC
**Disposition:** THIN -- Business logic moves to packages/core and packages/auth; Sheets-only functions stay

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 564 | THIN | Library exports map. Reduce to Sheets-only exports. |
| CORE_Database.gs | 3,231 | STAY | Heart of the MATRIX. TABLE_ROUTING, TAB_SCHEMAS, CRUD, caching, dedup, normalization pipeline. ALL Sheets-specific. |
| CORE_Carriers.gs | 616 | SPLIT | Carrier lookup/alias logic -> packages/core. Sheets reads stay. |
| CORE_Compliance.gs | 363 | MOVE | SSN masking, PHI sanitization -> packages/core (pure functions, no Sheets dependency) |
| CORE_Config.gs | 257 | STAY | Script Properties management. GAS-specific. |
| CORE_DevTools.gs | 354 | STAY | DEBUG/FIX/SETUP functions. GAS-specific. |
| CORE_Drive.gs | 616 | STAY | Google Drive folder ops (LC3/ACF). GAS DriveApp-specific. |
| CORE_Entitlements.gs | 1,798 | MOVE | User levels, modules, tool suites, role templates -> packages/auth. Pure permission logic with Sheets reads for user hierarchy. |
| CORE_Financial.gs | 544 | MOVE | Revenue calculations, FYC, NPV, DCF -> packages/core. Pure math, no Sheets dependency. |
| CORE_Logging.gs | 1,412 | SPLIT | Error/sync/activity log schemas stay (Sheets writes). Slack notification logic could move to services. |
| CORE_Match.gs | 565 | SPLIT | Fuzzy matching, Levenshtein -> packages/core (pure algorithms). matchClient/matchAgent stay (they call getTabData). |
| CORE_Normalize.gs | 1,738 | MOVE | All normalizer functions are pure string transforms -> packages/core. No Sheets dependency. |
| CORE_OrgAdmin.gs | 674 | SPLIT | getAllUsersForPlatform, getCompanyStructure read from Sheets. Business logic (scope filtering, enrichment) -> packages/auth. |
| CORE_Reconcile.gs | 1,911 | STAY | Heavy Sheets I/O (batch reads, FK updates, merge operations). Stays GAS until MATRIX decommissioned. |
| CORE_Validation_API.gs | 717 | MOVE | External API wrappers (phone, email, address validation) -> packages/core or services/api. Uses UrlFetchApp but logic is portable. |
| CORE_Api.gs | 233 | STAY (short-term) | Unified UrlFetchApp caller. GAS-specific. Dies when RAPID_API dies. |
| SETUP_DataFoundation.gs | 581 | STAY | One-time MATRIX setup scripts. GAS-specific. |
| SETUP_DRIVE.gs | 154 | STAY | Drive root folder config. GAS-specific. |
| SETUP_MATRIX.gs | 844 | STAY | MATRIX tab creation. GAS-specific. |

#### What Moves to packages/core

| Module | Functions | Est. Lines | Complexity |
|--------|-----------|------------|------------|
| Normalizers | normalizeCarrierName, normalizePhone, normalizeDate, normalizeEmail, normalizeState, normalizeZip, normalizeAmount, normalizeBoB, normalizeStatus, normalizeAddress, normalizeCity, normalizeSingleName, parseFullName, normalizeProductType, normalizeProductName, normalizePlanName, normalizeIMOName, phoneDigits | ~1,200 | Low -- pure string transforms |
| Financial | calculateFYC, calculateRenewal, calculateOverride, projectRevenue, projectCashFlow, calculateNPV, calculateIRR, calculateBookValue, calculateDCF | ~500 | Low -- pure math |
| Compliance | maskSSN, ssnLast4, maskDOB, calculateAge, maskPhone, maskMBI, sanitizeForLog | ~300 | Low -- pure transforms |
| Match algorithms | levenshteinDistance, fuzzyMatch, isSimilar, calculateNameScore, calculateMatchScore | ~200 | Low -- pure algorithms |
| Carrier aliases | CARRIER_ALIASES constant, PARENT_CARRIER_MAP | ~300 | Low -- data constant |
| Validation API | validatePhoneAPI, validateEmailAPI, validateAddressAPI, scoreContactQuality | ~700 | Medium -- HTTP calls need adaptation from UrlFetchApp to fetch() |

**Total moving to packages/core: ~3,200 lines**

#### What Moves to packages/auth

| Module | Functions | Est. Lines | Complexity |
|--------|-----------|------------|------------|
| Entitlements | USER_LEVELS, TOOL_SUITES, MODULES, MODULE_ACTIONS, HIERARCHY_LEVELS, PRODASH_ROLE_TEMPLATES, UNIT_MODULE_DEFAULTS | ~800 | Low -- constants + evaluation logic |
| Permission evaluation | userHasModuleAccess, getUserAccessibleModules, getToolSuitesForUser, getUserEntitlements, getEntitlementsForPlatform, computeModulePermissions, validateScopedAdmin | ~600 | Medium -- needs Firestore user reads instead of Sheets |
| resolveUser | Universal person resolver | ~150 | Medium -- needs Firestore user collection |

**Total moving to packages/auth: ~1,550 lines**

#### What Stays in GAS RAPID_CORE

| Category | Functions | Est. Lines | Why |
|----------|-----------|------------|-----|
| MATRIX CRUD | getTabData, insertRow, updateRow, deleteRow, bulkInsert, getRowById, getRowsWhere | ~800 | Direct SpreadsheetApp ops |
| TABLE_ROUTING + TAB_SCHEMAS | All routing constants + schema definitions | ~1,200 | MATRIX-specific config |
| Caching | getCached, setCached, invalidateCache, _memCache | ~100 | CacheService-specific |
| Drive ops | All LC3/ACF folder functions | ~600 | DriveApp-specific |
| Reconciliation | reconcileClients, reconcileAccounts, mergeRecords, FK_MAP | ~1,900 | Heavy Sheets I/O, stays until MATRIX decommissioned |
| Dedup pipeline | dedupCheck_, mergeData_, normalizeData_ | ~500 | Wired into insertRow/updateRow |
| Logging | Error/sync/activity log writers | ~800 | Sheets-based logging |
| Config | Script Properties management | ~250 | GAS-specific |
| SETUP/DEBUG/FIX | All utility functions | ~1,400 | GAS editor tools |

**Total staying: ~7,550 lines (down from 17,172)**

#### Risk Areas

1. **CORE_Database.gs normalizeData_() pipeline** -- This function is called on every insertRow/updateRow. It calls normalizer functions that are moving to packages/core. After thinning, RAPID_CORE must either: (a) keep its own copy of normalizers, or (b) lose auto-normalization on Sheets writes. **Recommendation:** Keep a thin copy in RAPID_CORE that calls the same logic, or accept that bridge writes from toMachina will arrive pre-normalized.

2. **matchClient/matchAgent** -- These call getTabData() (Sheets) AND normalization functions. They are used by dedupCheck_() which is called by insertRow(). The matching algorithms (pure) move, but the orchestration layer (Sheets reads + match + dedup) stays.

3. **CORE_Entitlements.gs getUserHierarchy()** -- Reads _USER_HIERARCHY from Sheets. In toMachina, this comes from Firestore. The thinned RAPID_CORE version must still read from Sheets for GAS consumers (RAPID_IMPORT, RAPID_FLOW, etc.) while the toMachina version reads from Firestore.

---

### RAPID_API
**Current state:** 23 .gs files, 2 .html files, 15,871 GS LOC, 1,665 HTML LOC
**Disposition:** RETIRE -- Replaced by services/api/ (Cloud Run Express)

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 1,858 | ARCHIVE | doGet/doPost router, Prodash direct helpers, SETUP functions. Contains hardcoded PRODASH_MATRIX_ID. |
| API_Account.gs | 377 | PORT to services/api | Account CRUD. Uses RAPID_CORE getTabData/updateRow/insertRow/deleteRow. |
| API_Activity.gs | 199 | PORT to services/api | Activity logging endpoints. |
| API_Agent.gs | 346 | PORT to services/api | Agent CRUD. |
| API_Analytics.gs | 296 | PORT to services/api | AI analytics push/query. |
| API_Booking.gs | 570 | PORT to services/api | Booking engine. Has direct Sheets writes (3). |
| API_Campaign.gs | 1,206 | PORT to services/api | Campaign management. Has direct Sheets writes (5). |
| API_CampaignSend.gs | 755 | PORT to services/api | Campaign send execution. |
| API_Client.gs | 369 | PORT to services/api | Client CRUD. |
| API_Comms.gs | 239 | PORT to services/api | Communications endpoints. |
| API_Compliance.gs | 959 | PORT to services/api | Quarterly compliance audit, offboarding. |
| API_GHL_Sync.gs | 1,661 | ARCHIVE (M&A only) | GHL sync -- retained for M&A intake but not actively used. |
| API_Import.gs | 856 | PORT to services/api | Import endpoints. |
| API_Opportunity.gs | 501 | PORT to services/api | Opportunity CRUD. |
| API_Pipeline.gs | 400 | PORT to services/api | Pipeline management. |
| API_Producer.gs | 265 | PORT to services/api | Producer CRUD. |
| API_Reference.gs | 147 | PORT to services/api | Reference data endpoints. |
| API_Relationship.gs | 305 | PORT to services/api | Client relationship CRUD. Has direct Sheets writes (2). |
| API_Revenue.gs | 359 | PORT to services/api | Revenue CRUD. |
| API_Rules.gs | 126 | PORT to services/api | Automation rules. |
| API_Spark.gs | 550 | PORT to services/api | SPARK webhook handler (carrier data inbound). |
| API_Sync.gs | 334 | PORT to services/api | Sync/reconciliation endpoints. |
| API_Task.gs | 413 | PORT to services/api | Task management. |
| API_User.gs | 453 | PORT to services/api | User/org endpoints. Has direct Sheets writes (8). |
| API_Webhook.gs | 311 | PORT to services/api | Generic webhook handler. |
| BOOKING_UI.html | 680 | ARCHIVE | Booking test UI. |
| RAPID_API_UI.html | 985 | ARCHIVE | API test UI. |
| DIAGNOSTIC.gs | 652 | ARCHIVE | Diagnostic utilities. |
| LIBRARY_ACCESS_FIX.gs | 162 | ARCHIVE | One-time fix. |
| SETUP_CHECK.gs | 119 | ARCHIVE | Setup verification. |
| TEST_API_DIRECT.gs | 743 | ARCHIVE | Direct API tests. |
| TEST_API.gs | 340 | ARCHIVE | API tests. |

#### Bridge Adaptations Needed
None -- RAPID_API is fully retired. services/api/ replaces it. The key work is porting all 20 API endpoint files to Express routes in services/api/, which reads/writes Firestore instead of Sheets (with bridge dual-write during transition).

#### Risk Areas
1. **Code.gs has 6 direct Prodash helper functions** (getProdashSheet_, getProdashData_, appendProdashRow_, updateProdashRow_, getProdashRowById_, deleteRowFromProdash_) with hardcoded PRODASH_MATRIX_ID. These bypass RAPID_CORE entirely. Any consumers of these must be identified and redirected.
2. **API_GHL_Sync.gs (1,661 lines)** is retained for M&A intake. It should stay accessible even after RAPID_API retirement -- either as a standalone GAS project or ported to a Cloud Function triggered by webhook.
3. **API_Compliance.gs (959 lines)** has GAS triggers (quarterly audit). These need equivalent Cloud Scheduler jobs.

---

### RAPID_IMPORT
**Current state:** 36 .gs files, 8 .html files, 106,641 GS LOC, 5,984 HTML LOC
**Disposition:** STAYS GAS -- Calls bridge for writes instead of direct Sheets

**Note:** This is by far the largest GAS project (112,625 total LOC). ~24,000 lines are archived enrichment functions (IMPORT_BoBEnrich_Archive.gs).

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 5,954 | ADAPT | Entry point. callRapidAPI_() must be redirected from GAS Web App to Cloud Run services/api/. |
| IMPORT_Approval.gs | 21,921 | ADAPT | The approval pipeline engine. 61 direct Sheets writes. Heaviest bridge adaptation target. |
| IMPORT_BoBEnrich_Archive.gs | 23,987 | STAY (frozen) | Archived enrichment. Already executed. No changes needed. |
| IMPORT_BoBEnrich.gs | 3,924 | STAY | Active data quality helpers. Uses bobReadSheet_/bobWriteEnrichment_ (direct Sheets). |
| IMPORT_BoBImport.gs | 5,822 | STAY | Carrier BoB batch import. Direct Sheets writes. |
| IMPORT_Intake.gs | 2,599 | STAY | 4-channel intake scanning (Drive, Gmail, Meet). GAS-native triggers. |
| IMPORT_Client.gs | 2,332 | ADAPT | Client import. Calls RAPID_CORE insertRow/updateRow (will go through bridge). |
| IMPORT_Account.gs | 1,179 | ADAPT | Account import. Similar pattern. |
| IMPORT_Agent.gs | 518 | ADAPT | Agent import. |
| IMPORT_Revenue.gs | 787 | ADAPT | Revenue import. |
| IMPORT_CaseTasks.gs | 1,594 | ADAPT | Case task management. 18 direct Sheets writes. |
| IMPORT_Comms.gs | 1,124 | STAY | Communications data intake. |
| IMPORT_GHL.gs | 4,394 | STAY | GHL import (retained for M&A). |
| IMPORT_Approval.gs | 21,921 | ADAPT | (see above) |
| IMPORT_RateDetection.gs | 1,589 | STAY | SERFF rate detection. |
| IMPORT_Reconcile.gs | 321 | STAY | Weekly reconciliation trigger wrapper. |
| IMPORT_BulkValidation.gs | 1,219 | STAY | Quarterly data hygiene. |
| IMPORT_Validation.gs | 965 | STAY | Data validation framework. |
| IMPORT_IntegrationStatus.gs | 411 | STAY | Integration health tracking. |
| IMPORT_DriveHygiene.gs | 529 | STAY | Drive dedup scanning. |
| IMPORT_Testing.gs | 2,416 | STAY | Test suite. |
| FIX_*.gs (10 files) | ~22,095 | STAY (frozen) | One-time data fix scripts. Already executed. |
| _CSS_VARS.html | 27 | ARCHIVE (when UI moves) | CSS variables. |
| _SHARED_UI.html | 374 | ARCHIVE (when UI moves) | Shared UI components. |
| APPROVAL_UI.html | 1,708 | ARCHIVE (when UI moves) | Approval web UI. |
| CASE_TASKS_UI.html | 649 | ARCHIVE (when UI moves) | Case task UI. |
| COMMS_VIEWER.html | 350 | ARCHIVE (when UI moves) | Communications viewer. |
| INTEGRATION_DASHBOARD.html | 133 | ARCHIVE (when UI moves) | Integration status dashboard. |
| RECONCILE_UI.html | 2,187 | ARCHIVE (when UI moves) | Duplicate review UI. |
| TRAINING_DASHBOARD.html | 556 | ARCHIVE (when UI moves) | Training batch triage UI. |

#### Bridge Adaptations Needed

The main adaptation: RAPID_IMPORT currently calls `callRapidAPI_()` which hits the GAS Web App RAPID_API. This needs to point to the Cloud Run services/api/ instead.

**Primary adaptation point:** Change `RAPID_API_CONFIG.URL` in Code.gs from the GAS Web App URL to the Cloud Run URL. Since callRapidAPI_() uses UrlFetchApp with JSON, the switch is nearly transparent if the Cloud Run API maintains the same endpoint paths and response format.

**Secondary adaptation:** ~170 sites use RAPID_CORE.insertRow/updateRow/getTabData directly (not through RAPID_API). These are the GAS-native operations that will eventually route through the bridge. However, per the plan, RAPID_IMPORT "calls bridge for writes instead of direct Sheets." The bridge service would need to be callable from GAS (via UrlFetchApp), which means it needs to accept the same request format as RAPID_API.

**Direct Sheets write sites (non-RAPID_CORE):**
- IMPORT_Approval.gs: 61 (heaviest -- manages _APPROVAL_QUEUE in RAPID_MATRIX)
- IMPORT_CaseTasks.gs: 18
- Code.gs: 14
- IMPORT_BoBEnrich.gs: 10
- IMPORT_GHL.gs: 10
- IMPORT_Intake.gs: 8

#### Risk Areas

1. **IMPORT_Approval.gs (21,921 lines)** is the most complex file. It manages the approval queue, batch creation, field-level approval, and post-approval writes. The 61 direct Sheets writes here are critical path -- they manage `_APPROVAL_QUEUE` in RAPID_MATRIX. Bridge adaptation here is medium-high risk.

2. **GAS Triggers** -- RAPID_IMPORT has multiple time-driven triggers (5-min intake scans, 4-hour pipeline validation, quarterly hygiene, weekly reconciliation). These STAY as GAS triggers even after bridge adaptation.

3. **MCP-Hub watcher.js dependency** -- The watcher reads from _INTAKE_QUEUE and writes to _APPROVAL_QUEUE. This is a Node.js process, not GAS. It could be adapted to call the bridge directly, bypassing GAS entirely for the extraction step.

---

### RAPID_FLOW
**Current state:** 7 .gs files, 0 .html files, 1,723 GS LOC
**Disposition:** STAYS GAS short-term. Long-term candidate for packages/core/flow.

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| FLOW_Config.gs | 189 | STAY | Pipeline/stage/workflow constants. |
| FLOW_DevTools.gs | 442 | STAY | Debug utilities. |
| FLOW_Engine.gs | 314 | STAY (port later) | Core workflow engine. Uses RAPID_CORE getTabData/updateRow/insertRow. |
| FLOW_Gates.gs | 148 | STAY (port later) | Gate enforcement logic. |
| FLOW_Hooks.gs | 60 | STAY (port later) | Lifecycle hooks. |
| FLOW_Query.gs | 230 | STAY (port later) | Workflow query functions. |
| FLOW_Tasks.gs | 340 | STAY (port later) | Task management within workflows. |

#### Bridge Adaptations Needed
None short-term. RAPID_FLOW uses RAPID_CORE CRUD exclusively (43 calls). When RAPID_CORE thins, RAPID_FLOW still calls the thinned Sheets-only version. Long-term, the workflow engine logic (pure state machines) moves to packages/core/flow.

#### Risk Areas
PRODASHX is the only project that declares RAPID_FLOW as a library dependency. Once PRODASHX is archived, RAPID_FLOW's only consumers are other GAS projects using it through RAPID_CORE, which simplifies eventual porting.

---

### RAPID_COMMS
**Current state:** 7 .gs files, 0 .html files, 954 GS LOC
**Disposition:** STAYS GAS short-term. Long-term -> Cloud Functions.

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 63 | STAY | Library entry point + exports. |
| COMMS_Config.gs | 85 | STAY | Credential management (Script Properties). |
| COMMS_DevTools.gs | 123 | STAY | DEBUG/SETUP/TEST functions. |
| COMMS_Email.gs | 288 | STAY (port later) | SendGrid email via UrlFetchApp. Easily portable to fetch(). |
| COMMS_Helpers.gs | 148 | STAY (port later) | Shared HTTP layer. |
| COMMS_SMS.gs | 122 | STAY (port later) | Twilio SMS via UrlFetchApp. |
| COMMS_Voice.gs | 125 | STAY (port later) | Twilio Voice via UrlFetchApp. |

#### Bridge Adaptations Needed
None. RAPID_COMMS is standalone (no RAPID_CORE dependency). When it moves to Cloud Functions, UrlFetchApp calls become node-fetch calls -- straightforward port.

---

### CAM (Commission Accounting)
**Current state:** 14 .gs files, 7 .html files, 8,452 GS LOC, 12,027 HTML LOC
**Disposition:** Backend stays GAS. UI -> portal modules (apps/riimo/ and apps/prodash/).

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 547 | STAY (backend) | doGet/doPost router. Backend stays. |
| CAM_Analytics.gs | 1,978 | STAY | Revenue analytics. |
| CAM_API.gs | 155 | STAY | API helpers. |
| CAM_Commission.gs | 1,340 | STAY | Commission calculation engine. 5 direct Sheets writes. |
| CAM_CompGrid.gs | 688 | STAY | Compensation grid management. 5 direct Sheets writes. |
| CAM_Config.gs | 383 | STAY | Configuration. |
| CAM_Database.gs | 174 | STAY | Database helpers. |
| CAM_DevTools.gs | 6 | STAY | Ping only. |
| CAM_HYPO.gs | 683 | STAY | Hypothetical projections. |
| CAM_Pipeline.gs | 930 | STAY | Pipeline tracking. 5 direct Sheets writes. |
| CAM_Revenue.gs | 1,373 | STAY | Revenue tracking. 5 direct Sheets writes. |
| CAM_Utils.gs | 192 | STAY | Utilities. |
| debug-frame.gs | 1 | STAY | Placeholder. |
| debug-page.gs | 1 | STAY | Placeholder. |
| screenshot-all.gs | 1 | STAY | Placeholder. |
| Index.html | 2,017 | ARCHIVE | Main UI -> apps/riimo module. |
| Scripts.html | 2,860 | ARCHIVE | Client-side JS -> apps/riimo module. |
| Styles.html | 4,424 | ARCHIVE | CSS -> apps/riimo module. |
| Docs/*.html (6) | 3,726 | ARCHIVE | User guides -> docs site or help center. |

#### Bridge Adaptations Needed
20 direct Sheets writes across 4 backend files. These are CAM's own MATRIX operations (comp grids, revenue, pipeline). Short-term they stay as-is. Long-term they call the bridge.

#### Risk Areas
CAM reads from RAPID_CORE minimally (library dependency exists but actual calls are sparse). The main risk is that CAM manages its own Sheets tabs (comp grids) that aren't in TABLE_ROUTING. These custom tabs need explicit bridge handling.

---

### DEX (Document Efficiency)
**Current state:** 13 .gs files, 3 .html files, 7,926 GS LOC, 5,320 HTML LOC
**Disposition:** Backend stays GAS (PDF/Drive ops). UI -> portal modules.

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 442 | STAY (backend) | doGet + UI wrappers. |
| DEX_ClientData.gs | 545 | STAY | Client data resolution for form filling. |
| DEX_Config.gs | 186 | STAY | Configuration. |
| DEX_DevTools.gs | 1,919 | STAY | Debug/setup utilities. 18 direct Sheets writes. |
| DEX_DocuSign.gs | 650 | STAY | DocuSign integration. |
| DEX_FieldMappings.gs | 735 | STAY | 300+ field mappings. 8 direct Sheets writes. |
| DEX_FormLibrary.gs | 677 | STAY | Form CRUD. 10 direct Sheets writes. |
| DEX_KitBuilder.gs | 566 | STAY | Kit generation. 4 direct Sheets writes. |
| DEX_PDFFiller.gs | 996 | STAY | PDF population. 5 direct Sheets writes. |
| DEX_Pipeline.gs | 451 | STAY | Document package tracking. 10 direct Sheets writes. |
| DEX_Rules.gs | 314 | STAY | Matrix rule engine. |
| DEX_Setup.gs | 45 | STAY | Setup. |
| DEX_Taxonomy.gs | 400 | STAY | Form categorization. |
| Index.html | 744 | ARCHIVE | Main UI -> portal module. |
| Scripts.html | 2,989 | ARCHIVE | Client-side JS -> portal module. |
| Styles.html | 1,587 | ARCHIVE | CSS -> portal module. |

#### Bridge Adaptations Needed
55 direct Sheets writes across 6 backend files. These manage DEX-specific tabs (_FORM_LIBRARY, _FORM_RULES, _CARRIER_FORMS, _KIT_TEMPLATES, _KIT_LOG, _FIELD_MAPPINGS). Bridge adaptation needed long-term.

#### Risk Areas
DEX is deeply tied to Google Drive (PDF generation, form filing, DocuSign). These GAS-native operations (DriveApp, Blob handling) are the reason DEX backend stays GAS longest. The PDF filling + Drive filing workflow is not easily portable.

---

### C3 (Content Command Center)
**Current state:** 1 .gs file (6 lines), 7 .html files, 6 GS LOC, 13,412 HTML LOC
**Disposition:** Backend stays GAS (campaign assembly). UI -> portal modules.

**Note:** C3 is unusual -- almost all logic is in HTML files (embedded JS in Index.html at ~10,337 lines) and a separate backend spreadsheet (not RAPID_CORE managed). The .gs file is just DEBUG_Ping.

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| C3_DevTools.gs | 6 | STAY | Ping only. |
| Index.html | 10,337 | ARCHIVE | Full app (UI + embedded backend calls). Massive single-file app. |
| docs/*.html (5) | 3,075 | ARCHIVE | User guides. |

#### Bridge Adaptations Needed
Minimal from GAS side. C3's backend is primarily Spreadsheet-direct calls embedded in the HTML. The real work is porting the campaign logic to a proper backend (services/api or a dedicated campaign service).

#### Risk Areas
C3's architecture is monolithic -- 10K+ lines in a single HTML file with embedded google.script.run calls to a separate GAS backend (Code.js in the C3 spreadsheet). The campaign engine logic (46 campaigns, 661 templates, content block assembly) needs careful extraction.

---

### ATLAS
**Current state:** 16 .gs files, 7 .html files, 4,789 GS LOC, 1,988 HTML LOC
**Disposition:** Backend stays GAS (registry CRUD). UI -> portal modules (apps/riimo).

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 291 | STAY (backend) | doGet + request router. |
| ATLAS_Analytics.gs | 296 | STAY | Gap analysis, carrier scorecards. |
| ATLAS_Audit.gs | 332 | STAY | Audit report generation. |
| ATLAS_Automation.gs | 340 | STAY | Automation health dashboard data. |
| ATLAS_Calendar.gs | 137 | STAY | Google Calendar sync. |
| ATLAS_Config.gs | 168 | STAY | Constants and enums. |
| ATLAS_DevTools.gs | 381 | STAY | Debug/setup. 6 direct Sheets writes. |
| ATLAS_History.gs | 119 | STAY | Audit trail logging. |
| ATLAS_Pipeline.gs | 296 | STAY | Pipeline flow map data. |
| ATLAS_Registry.gs | 238 | STAY | Source registry CRUD. |
| ATLAS_Seed.gs | 278 | STAY | Initial data seeding. |
| ATLAS_Slack.gs | 225 | STAY | Slack digests. |
| ATLAS_Tasks.gs | 425 | STAY | Task management. |
| ATLAS_ToolRegistry.gs | 216 | STAY | Tool registry CRUD. |
| ATLAS_ToolSeed.gs | 389 | STAY | Tool data seeding. |
| ATLAS_Triggers.gs | 112 | STAY | Scheduled functions. |
| ATLAS_Wires.gs | 546 | STAY | Wire diagram definitions. |
| Index.html | 305 | ARCHIVE | Main UI shell. |
| _VIEW_*.html (5) | 990 | ARCHIVE | View partials. |
| _CSS_VARS.html | 68 | ARCHIVE | CSS variables. |
| _SHARED_UI.html | 625 | ARCHIVE | Shared UI components. |

#### Bridge Adaptations Needed
6 direct Sheets writes (all in DevTools -- SETUP functions). ATLAS primarily uses RAPID_CORE CRUD (72 calls). When RAPID_CORE thins, ATLAS continues using the Sheets-only thinned version. No urgent bridge work.

#### Risk Areas
ATLAS has GAS triggers (daily digest, weekly summary, auto-complete) and Calendar API integration. These stay GAS. Low risk overall -- ATLAS backend is clean and well-structured.

---

### PRODASHX (B2C Portal)
**Current state:** 32 .gs files, 5 .html files, 19,411 GS LOC, 27,288 HTML LOC
**Disposition:** ARCHIVE -- Replaced by apps/prodash/

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 2,778 | ARCHIVE | Portal entry point. |
| PRODASH_Accounts.gs | 1,107 | ARCHIVE | Account module. |
| PRODASH_BENI_CENTER.gs | 219 | ARCHIVE | Beneficiary module. |
| PRODASH_BQ_API.gs | 229 | ARCHIVE | BigQuery API caller. |
| PRODASH_Campaigns.gs | 1,020 | ARCHIVE | Campaign viewer. |
| PRODASH_CASE_CENTRAL.gs | 910 | ARCHIVE | Case management. |
| PRODASH_CASEWORK.gs | 745 | ARCHIVE | Casework module. |
| PRODASH_CLIENT360.gs | 1,736 | ARCHIVE | 360-degree client view. |
| PRODASH_Clients.gs | 793 | ARCHIVE | Client list module. |
| PRODASH_Communications.gs | 314 | ARCHIVE | Communications module. |
| PRODASH_DISCOVERY_KIT.gs | 1,166 | ARCHIVE | Discovery kit builder. |
| PRODASH_DISCOVERY_PDF.gs | 734 | ARCHIVE | Discovery PDF generator. |
| PRODASH_FlowBridge.gs | 138 | ARCHIVE | RAPID_FLOW bridge. |
| PRODASH_FlowSetup.gs | 259 | ARCHIVE | Flow setup. |
| PRODASH_MatrixCache.gs | 450 | ARCHIVE | Matrix caching layer. |
| PRODASH_MEDICARE_API.gs | 363 | ARCHIVE | Medicare API caller. |
| PRODASH_MEDICARE_REC.gs | 637 | ARCHIVE | Medicare recommendation. |
| PRODASH_Messenger.gs | 558 | ARCHIVE | Messaging module. |
| PRODASH_Migration.gs | 925 | ARCHIVE | Data migration utilities. |
| PRODASH_OrgAdmin.gs | 132 | ARCHIVE | Org admin wrapper. |
| PRODASH_Profile.gs | 451 | ARCHIVE | User profile. |
| PRODASH_QUE_MEDICARE.gs | 421 | ARCHIVE | QUE Medicare integration. |
| PRODASH_QuickIntake.gs | 524 | ARCHIVE | Quick intake form. |
| PRODASH_REPORT_ORDER.gs | 573 | ARCHIVE | Report ordering. |
| PRODASH_RMD_CENTER.gs | 381 | ARCHIVE | RMD tracking module. |
| PRODASH_SALES_CENTERS.gs | 178 | ARCHIVE | Sales centers nav. |
| PRODASH_SERVICE_CENTERS.gs | 347 | ARCHIVE | Service centers nav. |
| PRODASH_STAGE_STUBS.gs | 186 | ARCHIVE | Stage stubs for RAPID_FLOW. |
| PRODASH_Testing.gs | 545 | ARCHIVE | Test suite. |
| PRODASH_YELLOW_STAGE.gs | 232 | ARCHIVE | Yellow stage logic. |
| DEBUG_API.gs | 360 | ARCHIVE | API debug functions. |
| Index.html | 4,279 | ARCHIVE | Main UI shell. |
| Scripts.html | 15,488 | ARCHIVE | Client-side JS (massive). |
| Styles.html | 4,101 | ARCHIVE | CSS. |
| PortalStandard.html | 1,078 | ARCHIVE | Portal standard framework. |
| C3-Evolution.html | 182 | ARCHIVE | C3 integration. |
| RPI_Connect.html | 1,396 | ARCHIVE | Messaging UI. |
| Docs/RPI_MESSENGER_MOCKUP.html | 764 | ARCHIVE | Messenger mockup. |

#### Bridge Adaptations Needed
None -- entire project archived. The business logic embedded in PRODASH_*.gs files has already been accounted for in the toMachina apps/prodash design.

#### Key Intelligence for Porting
- **PRODASH_CLIENT360.gs** (1,736 lines) -- the richest single-client view. Lazy-loads tabs. Reference implementation for apps/prodash client detail page.
- **PRODASH_RMD_CENTER.gs** (381 lines) -- RMD calculation logic (IRS rules). Must be precisely ported to packages/core.
- **PRODASH_MEDICARE_REC.gs** (637 lines) -- Medicare recommendation doc generator. Uses DriveApp -- may need GAS backend or Cloud Function.
- **Scripts.html** (15,488 lines) -- Contains all client-side UI logic. Reference for React component design in apps/prodash.

---

### RIIMO (Operations Hub)
**Current state:** 16 .gs files, 7 .html files, 11,510 GS LOC, 16,228 HTML LOC
**Disposition:** ARCHIVE -- Replaced by apps/riimo/

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 1,894 | ARCHIVE | Portal entry + UI data endpoints (ui* functions). |
| RIIMO_Core.gs | 372 | ARCHIVE | Version, hierarchy functions, MATRIX connections. |
| RIIMO_Dashboard.gs | 1,268 | ARCHIVE | Dashboard card data (reads all 3 MATRIXes). |
| RIIMO_Actions.gs | 614 | ARCHIVE | Quick actions. |
| RIIMO_OrgAdmin.gs | 278 | ARCHIVE | Company structure CRUD wrapper. |
| RIIMO_Pipelines.gs | 1,785 | ARCHIVE | Pipeline definitions, stage execution. |
| RIIMO_Tasks.gs | 748 | ARCHIVE | Task system. |
| RIIMO_JobTemplates.gs | 631 | ARCHIVE | Job description templates. |
| RIIMO_Intelligence.gs | 162 | ARCHIVE | AI analytics dashboard data. |
| RIIMO_MyRPI.gs | 1,587 | ARCHIVE | My RPI profile (meet room, team profiles). |
| RIIMO_Messenger.gs | 560 | ARCHIVE | Messaging module. |
| RIIMO_Rules.gs | 166 | ARCHIVE | Automation rules. |
| RIIMO_MATRIX_Setup.gs | 960 | ARCHIVE | Admin tab creation. |
| RIIMO_DevTools.gs | 485 | ARCHIVE | Debug functions. |
| Index.html | 5,832 | ARCHIVE | Full dark-theme UI. |
| DashboardWidgets.html | 1,560 | ARCHIVE | Dashboard v3 widgets. |
| JobTemplates.html | 2,068 | ARCHIVE | Job template editor. |
| MyRPI.html | 3,416 | ARCHIVE | My RPI page. |
| PortalStandard.html | 901 | ARCHIVE | Portal framework. |
| RPI_Connect.html | 1,430 | ARCHIVE | Messaging UI. |
| TaskManager.html | 1,021 | ARCHIVE | Task system UI. |

#### Bridge Adaptations Needed
None -- entire project archived.

#### Key Intelligence for Porting
- **RIIMO_Dashboard.gs** (1,268 lines) -- Reads all 3 MATRIXes for health metrics. Reference for apps/riimo dashboard that will read from Firestore instead.
- **RIIMO_Pipelines.gs** (1,785 lines) -- 5 pipeline definitions with stage execution. Port to packages/core/flow or services/api.
- **RIIMO_MyRPI.gs** (1,587 lines) -- Employee profile aggregation with LEADER+ profile switcher. Port to packages/auth + apps/riimo.
- **Dynamic sidebar** renders from user entitlements. This pattern directly maps to the toMachina entitlement-gated navigation.

---

### SENTINEL v2 (B2B Portal)
**Current state:** 17 .gs files, 4 .html files, 6,135 GS LOC, 8,399 HTML LOC
**Disposition:** ARCHIVE -- Replaced by apps/sentinel/

#### Files

| File | Lines | Disposition | Notes |
|------|-------|-------------|-------|
| Code.gs | 158 | ARCHIVE | Portal entry. |
| SENTINEL_Analysis.gs | 403 | ARCHIVE | Product analysis display. |
| SENTINEL_Core.gs | 237 | ARCHIVE | Version, utilities. |
| SENTINEL_Database.gs | 644 | ARCHIVE | MATRIX connections. |
| SENTINEL_DealManagement.gs | 398 | ARCHIVE | Deal CRUD. |
| SENTINEL_DevTools.gs | 19 | ARCHIVE | Ping only. |
| SENTINEL_Integration.gs | 349 | ARCHIVE | Embedded module coordination. |
| SENTINEL_MarketIntelligence.gs | 1,463 | ARCHIVE | Market intelligence module. |
| SENTINEL_Messenger.gs | 558 | ARCHIVE | Messaging. |
| SENTINEL_MyRPI.gs | 236 | ARCHIVE | My RPI wrapper. |
| SENTINEL_OrgAdmin.gs | 298 | ARCHIVE | Org admin wrapper. |
| SENTINEL_Permissions.gs | 98 | ARCHIVE | Permission helpers. |
| SENTINEL_Pipeline.gs | 334 | ARCHIVE | Pipeline management. |
| SENTINEL_Setup.gs | 363 | ARCHIVE | Setup utilities. |
| SENTINEL_Valuation.gs | 507 | ARCHIVE | IMO comparison + M-A-P reports. |
| SETUP_Pipelines.gs | 70 | ARCHIVE | Pipeline setup. |
| Index.html | 6,068 | ARCHIVE | Full UI. |
| PortalStandard.html | 901 | ARCHIVE | Portal framework. |
| RPI_Connect.html | 1,430 | ARCHIVE | Messaging UI (shared with RIIMO/PRODASH). |

#### Bridge Adaptations Needed
None -- entire project archived.

#### Key Intelligence for Porting
- **SENTINEL_MarketIntelligence.gs** (1,463 lines) -- Market intelligence module. Port to apps/sentinel module.
- **SENTINEL_Valuation.gs** (507 lines) -- IMO comparison and M-A-P report logic. Port to packages/core or apps/sentinel.
- **SENTINEL_Database.gs** (644 lines) -- Custom MATRIX connection layer. Shows how SENTINEL manages its own Sheets reads.

---

## Recommended Thinning Order

### Phase 4a: Archive Portals (Zero Risk -- New Apps Already Running)
1. **PRODASHX** -- Archive. apps/prodash is the replacement.
2. **RIIMO** -- Archive. apps/riimo is the replacement.
3. **SENTINEL v2** -- Archive. apps/sentinel is the replacement.
4. **Effort:** Tag repos `pre-migration-archive`, disable web app deployments.

### Phase 4b: Port RAPID_API to Cloud Run (services/api/)
1. Port all 20 API endpoint files to Express routes
2. Each route calls Firestore (primary) + bridge Sheets write (transitional)
3. Update RAPID_IMPORT's `callRapidAPI_()` URL from GAS Web App to Cloud Run
4. Verify MCP tools still work (URL change in config)
5. **Effort:** LARGE -- 15,871 lines of endpoint logic to port. But the patterns are repetitive (CRUD with RAPID_CORE calls).

### Phase 4c: Extract Business Logic from RAPID_CORE
1. Port normalizers to packages/core (pure functions, ~1,200 lines)
2. Port financial calculations to packages/core (~500 lines)
3. Port compliance/masking to packages/core (~300 lines)
4. Port match algorithms to packages/core (~200 lines)
5. Port entitlements to packages/auth (~1,550 lines)
6. **Effort:** MEDIUM -- Functions are mostly pure, just need TypeScript wrappers.

### Phase 4d: Thin RAPID_CORE
1. Remove functions that now live in packages/core and packages/auth
2. Update Code.gs exports to only expose Sheets-only functions
3. Verify all remaining GAS consumers still work (RAPID_IMPORT, RAPID_FLOW, ATLAS, CAM, DEX, C3)
4. **Effort:** SMALL -- Deletion + verification.

### Phase 4e: Archive App UIs (CAM, DEX, C3, ATLAS)
1. Remove Index.html, Scripts.html, Styles.html from each project
2. Keep all .gs backend files
3. These backends become "headless" GAS services called by toMachina portals
4. **Effort:** SMALL -- Delete UI files, update doGet() to return JSON-only or status page.

### Phase 4f: RAPID_IMPORT Bridge Adaptation
1. Update callRapidAPI_() to point to Cloud Run services/api/
2. Verify 4-channel intake scanning still works
3. Verify approval pipeline still works with bridge writes
4. **Effort:** SMALL for the URL change. MEDIUM for end-to-end verification.

---

## Estimated Effort

| Phase | Project(s) | Size | What's Involved |
|-------|-----------|------|-----------------|
| **4a** | PRODASHX, RIIMO, SENTINEL v2 | **Small** | Git tag, disable deployments. No code changes. |
| **4b** | RAPID_API -> services/api | **Large** | Port 20 endpoint files to Express. Each needs Firestore adapter + bridge dual-write. ~2-3 weeks. |
| **4c** | RAPID_CORE -> packages/core + packages/auth | **Medium** | Extract pure functions to TypeScript packages. ~1 week. |
| **4d** | RAPID_CORE thinning | **Small** | Delete moved functions, update exports. ~1 day. |
| **4e** | CAM, DEX, C3, ATLAS UI archival | **Small** | Delete HTML files, update entry points. ~1 day. |
| **4f** | RAPID_IMPORT bridge | **Small-Medium** | URL change + verification. ~2-3 days. |

**Total estimated Phase 4 effort: ~4-5 weeks**

---

## Appendix: Full File Inventory by Project

### RAPID_CORE (17,172 GS LOC)
```
Code.gs                    564
CORE_Api.gs                233
CORE_Carriers.gs           616
CORE_Compliance.gs         363
CORE_Config.gs             257
CORE_Database.gs         3,231
CORE_DevTools.gs           354
CORE_Drive.gs              616
CORE_Entitlements.gs     1,798
CORE_Financial.gs          544
CORE_Logging.gs          1,412
CORE_Match.gs              565
CORE_Normalize.gs        1,738
CORE_OrgAdmin.gs           674
CORE_Reconcile.gs        1,911
CORE_Validation_API.gs     717
SETUP_DataFoundation.gs    581
SETUP_DRIVE.gs             154
SETUP_MATRIX.gs            844
```

### RAPID_API (15,871 GS + 1,665 HTML)
```
Code.gs                  1,858    API_Revenue.gs        359
API_Account.gs             377    API_Rules.gs          126
API_Activity.gs            199    API_Spark.gs          550
API_Agent.gs               346    API_Sync.gs           334
API_Analytics.gs           296    API_Task.gs           413
API_Booking.gs             570    API_User.gs           453
API_Campaign.gs          1,206    API_Webhook.gs        311
API_CampaignSend.gs        755    DIAGNOSTIC.gs         652
API_Client.gs              369    LIBRARY_ACCESS_FIX.gs 162
API_Comms.gs               239    SETUP_CHECK.gs        119
API_Compliance.gs          959    TEST_API_DIRECT.gs    743
API_GHL_Sync.gs          1,661    TEST_API.gs           340
API_Import.gs              856    BOOKING_UI.html       680
API_Opportunity.gs         501    RAPID_API_UI.html     985
API_Pipeline.gs            400
API_Producer.gs            265
API_Reference.gs           147
API_Relationship.gs        305
```

### RAPID_IMPORT (106,641 GS + 5,984 HTML)
```
Code.gs                  5,954    IMPORT_Revenue.gs         787
IMPORT_Approval.gs      21,921    IMPORT_Testing.gs       2,416
IMPORT_BoBEnrich.gs      3,924    IMPORT_Validation.gs      965
IMPORT_BoBEnrich_Archive 23,987    FIX_AI3Import.gs       5,917
IMPORT_BoBImport.gs      5,822    FIX_AnnuityBob.gs      1,115
IMPORT_Intake.gs         2,599    FIX_BdriaBob.gs          254
IMPORT_Client.gs         2,332    FIX_CarrierInference.gs   262
IMPORT_Account.gs        1,179    FIX_CarrierXlsxImport  5,043
IMPORT_Agent.gs            518    FIX_CofClientImport.gs  1,563
IMPORT_CaseTasks.gs      1,594    FIX_CommissionReconcile   373
IMPORT_Comms.gs          1,124    FIX_LifeBob.gs          1,214
IMPORT_GHL.gs            4,394    FIX_MedicareBob.gs      4,793
IMPORT_RateDetection.gs  1,589    FIX_SignalRevenue.gs    2,522
IMPORT_Reconcile.gs        321    IMPORT_BulkValidation   1,219
IMPORT_IntegrationStatus   411    IMPORT_DriveHygiene.gs    529
```

### RAPID_FLOW (1,723 GS)
```
FLOW_Config.gs    189    FLOW_Hooks.gs    60
FLOW_DevTools.gs  442    FLOW_Query.gs   230
FLOW_Engine.gs    314    FLOW_Tasks.gs   340
FLOW_Gates.gs     148
```

### RAPID_COMMS (954 GS)
```
Code.gs           63    COMMS_SMS.gs     122
COMMS_Config.gs   85    COMMS_Voice.gs   125
COMMS_DevTools.gs 123
COMMS_Email.gs    288
COMMS_Helpers.gs  148
```
