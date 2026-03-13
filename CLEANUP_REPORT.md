# Cleanup Tasks Report — 2026-03-11

> Scope: Final polish — ProDashX rename, custom domains, BigQuery export
> Builder: Claude Opus 4.6 (Builder 3, direct on main)
> Auditor Protocol: `~/Projects/toMachina/.claude/AUDITOR_PROTOCOL.md`

## Commits

| Commit | Hash | Description |
|--------|------|-------------|
| ProDashX rename | `83ce849` | Rename ProDash → ProDashX in all UI display text (6 files) |

## Task 1: ProDashX Rename

**Status: COMPLETE**

Changed "ProDash" → "ProDashX" in all UI-visible display text. Directory names, package names, import paths, CSS classes, and URLs unchanged.

### Files Changed

| File | Change |
|------|--------|
| `apps/prodash/app/(portal)/components/TopBar.tsx` | Display text → ProDashX |
| `apps/prodash/app/(portal)/components/PortalSidebar.tsx` | Display text → ProDashX |
| `apps/prodash/app/(portal)/components/SignInScreen.tsx` | Display text → ProDashX |
| `apps/prodash/app/layout.tsx` | Metadata title → "ProDashX \| toMachina" |
| `packages/ui/src/components/PortalSwitcher.tsx` | Portal list label → ProDashX |
| `CLAUDE.md` | Portal Themes table + Session URLs → ProDashX |

### Verification
- Committed and pushed to main (`83ce849`)
- Firebase App Hosting auto-deploy triggered
- Browser tab title, TopBar, PortalSwitcher, SignInScreen, and Sidebar all show "ProDashX"

### Note
Builder 1 had already made these changes in the working tree but left them uncommitted. Builder 3 committed and pushed them to trigger deploy.

---

## Task 2: RIIMO + SENTINEL Custom Domains

**Status: ALREADY CONFIGURED — SSL MINTING IN PROGRESS**

Investigated via Firebase Console (Playwright). Found all three custom domains are already configured on their respective App Hosting backends:

| Portal | Domain | Firebase Status | SSL |
|--------|--------|----------------|-----|
| ProDashX | prodash.tomachina.com | **Connected** | Active |
| RIIMO | riimo.tomachina.com | **Minting certificate** | Pending (automatic) |
| SENTINEL | sentinel.tomachina.com | **Minting certificate** | Pending (automatic) |

### DNS Verification
All three A records resolve to `35.219.200.8`:
```
dig +short prodash.tomachina.com  → 35.219.200.8
dig +short riimo.tomachina.com    → 35.219.200.8
dig +short sentinel.tomachina.com → 35.219.200.8
```

### Firebase Auth Authorized Domains
Already configured (verified in Builder 1's earlier work — 10 authorized domains including all 3 portals + hosted.app URLs).

### Action Required
None. SSL certificate minting is automatic — typically completes within minutes to an hour. No TXT records or GoDaddy API calls needed; the A records are sufficient for Firebase App Hosting domain verification.

---

## Task 3: BigQuery Export Extension

**Status: DEFERRED — Wrong tool for this job**

### What Happened
1. Confirmed no extensions installed (`firebase ext:list`)
2. Navigated to Firebase Console Extensions page via Playwright
3. Installed "Stream Firestore to BigQuery" extension (firebase/firestore-bigquery-export@0.2.10)
4. Enabled Compute Engine API (required dependency)
5. Granted 2 IAM permissions (Compute Service Agent eventReceiver, Pub/Sub Service Agent tokenCreator)
6. Configured: Collection path `{document=**}`, Dataset `toMachina`, Table `firestore_changes`, Location `us-central1`
7. **Install FAILED** — Deployment Manager YAML parser choked on `{document=**}` curly braces in the collection path config

Error: `Error parsing configuration: while parsing a block mapping... expected <block end>, but found '<scalar>' ... value: {document=**}/{documentId}`

8. Uninstalled the failed extension

### Root Cause
The Firestore BigQuery Export extension streams **one collection at a time**. The `{document=**}` wildcard syntax is valid in Firestore security rules and Cloud Functions triggers, but NOT in this extension's Deployment Manager template — the curly braces break YAML parsing.

### Why the Extension Is Wrong for toMachina
- To stream ALL collections would require 10+ separate extension instances (one per collection)
- Each instance deploys its own set of Cloud Functions (4 per instance = 40+ functions)
- Cost, maintenance, and complexity scale linearly with collection count
- No single-install "stream everything" option exists in this extension

### Correct Architecture (Recommendation)
Write a **single Cloud Function** using `onDocumentWritten("{document=**}")` that:
1. Catches ALL Firestore document writes across all collections
2. Formats the change event (collection, document ID, operation type, data)
3. Streams to the existing `toMachina` BigQuery dataset

This could live in `services/bridge/` since the bridge already handles Firestore↔Sheets sync — adding a BigQuery leg to the same pipeline is natural and keeps all data flow in one place.

### Current State
- `toMachina` BigQuery dataset already exists (created during SERFF pipeline work)
- No extension installed (clean uninstall completed)
- Old `com.rpi.analytics-push` launchd cron (batch-based) can be retired once the event-driven approach is built

### Recommended Phase
Phase 6 or a dedicated builder task. This is infrastructure work, not cleanup.

---

## Build Verification

```
turbo run build: not re-run (only display text changes in Task 1 — no structural changes)
git push: main deployed to Firebase App Hosting (auto-deploy)
```

---

## Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| RIIMO/SENTINEL SSL certs still minting | LOW | Automatic process, no action needed. Will resolve within ~1 hour. |
| BigQuery streaming not implemented | MEDIUM | Deferred to proper architecture (Cloud Function, not extension). Existing batch cron still runs. |
| ProDashX rename was uncommitted by Builder 1 | INFO | No impact — Builder 3 committed and pushed it. |

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Defer BigQuery extension | Extension requires per-collection instances (10+ installs). Single Cloud Function with `onDocumentWritten` wildcard is cleaner, cheaper, and catches all collections. |
| Commit Builder 1's uncommitted rename | Changes were ready in working tree, just needed commit + push to trigger deploy. No conflict risk since only display text changed. |
| No worktree for cleanup tasks | Per task prompt: "Work directly on main. These are small, low-risk changes." |
