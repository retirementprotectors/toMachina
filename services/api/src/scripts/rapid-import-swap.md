# RAPID_IMPORT URL Swap — GAS to Cloud Run Migration Map

> Which GAS functions have been migrated, which still need swapping, and which stay in GAS.

---

## Already on Cloud Run (Complete)

These functions have been fully migrated to `api.tomachina.com` routes. GAS callers should be updated to point here.

| GAS Function | Cloud Run Endpoint | Notes |
|---|---|---|
| `importClientRecord` | `POST /api/import/client` | Single client import |
| `batchImportClients` | `POST /api/import/clients/batch` | Batch client import |
| `importAccountRecord` | `POST /api/import/account` | Single account (auto-routes by type) |
| `importLifeAccount` | `POST /api/import/account` | Set `account_type: 'life'` |
| `importAnnuityAccount` | `POST /api/import/account` | Set `account_type: 'annuity'` |
| `importMedicareAccount` | `POST /api/import/account` | Set `account_type: 'medicare'` |
| `importBDRIAAccounts` | `POST /api/import/bdria-accounts` | BD/RIA batch import |
| `importRevenueRecord` | `POST /api/import/revenue` | Single revenue record |
| `batchImportRevenue` | `POST /api/import/revenue/batch` | Batch revenue import |
| `importAgentRecord` | `POST /api/import/agent` | Single agent import |
| `batchImportAgents` | `POST /api/import/agents/batch` | Batch agent import |
| `importCaseTask` | `POST /api/import/case-task` | Case task creation |
| `processApproval` | `POST /api/import/approval` | Approval workflow |
| `getIntakeQueueStatus` | `GET /api/import/queue/status` | Queue depth by status/source |
| `backfillClientDemos` | `POST /api/import/backfill-clients` | Client demographic enrichment (NEW) |

## Still on GAS — Need URL Swap

These functions are still called via GAS `google.script.run` or `UrlFetchApp.fetch` to the GAS web app. They should be swapped to Cloud Run once migrated.

| GAS Function | File | Priority | Migration Notes |
|---|---|---|---|
| `importSignalStatement` | `IMPORT_Signal.gs` | LOW | Signal being replaced by Gradient. Migrate only if Gradient needs same format. |
| `importDTCCFeed` | `IMPORT_DTCC.gs` | MEDIUM | Structured carrier feed — straightforward to migrate. |
| `importDSTVisionFeed` | `IMPORT_DSTVision.gs` | MEDIUM | BD/RIA account aggregator feed. |
| `processIntakeQueue` | `IMPORT_Intake.gs` | HIGH | Core intake processor — drives all inbound data. Migrate when intake Cloud Function is ready. |
| `enrichFromBoB` | `IMPORT_BoBEnrich.gs` | LOW | Book-of-business enrichment. Runs infrequently. |

## Retained in GAS (No Migration Planned)

These stay in GAS permanently — they use GAS-specific APIs or serve M&A intake from GHL.

| GAS Function | File | Reason |
|---|---|---|
| `IMPORT_GHL.*` | `IMPORT_GHL.gs` | GHL integration for M&A acquisitions via DAVID/SENTINEL. Uses GAS triggers + GHL webhooks. |
| `IMPORT_Intake.*` (trigger) | `IMPORT_Intake.gs` | Time-based GAS trigger for queue processing. The _processing logic_ migrates; the trigger stays. |
| `IMPORT_BoBEnrich.*` | `IMPORT_BoBEnrich.gs` | Deep enrichment using GAS DriveApp for document scanning. |
| `IMPORT_DriveHygiene.*` | `IMPORT_DriveHygiene.gs` | Drive cleanup using GAS DriveApp APIs. |

---

## URL Swap Pattern

When updating a GAS function to call Cloud Run instead of the GAS web app:

### Before (GAS → GAS Web App)

```javascript
function importClientRecord(data) {
  // Direct GAS call — no HTTP needed
  return RAPID_API.importClient(data);
}
```

### After (GAS → Cloud Run)

```javascript
function importClientRecord(data) {
  const API_BASE = 'https://api.tomachina.com';
  const token = ScriptApp.getIdentityToken();

  const response = UrlFetchApp.fetch(`${API_BASE}/api/import/client`, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());

  if (!result.success) {
    throw new Error(result.error || 'Import failed');
  }

  return result.data;
}
```

### Key Notes

- `ScriptApp.getIdentityToken()` generates an OIDC identity token scoped to the GAS project's Cloud Project. The Cloud Run service validates `@retireprotected.com` domain.
- `muteHttpExceptions: true` prevents GAS from throwing on 4xx/5xx — lets us handle errors in the response body.
- All Cloud Run endpoints return `{ success: boolean, data?: T, error?: string }` — same structure GAS expects.

---

## Testing Checklist

Before swapping each function:

- [ ] Cloud Run endpoint exists and is deployed
- [ ] Endpoint accepts the same payload shape as GAS function
- [ ] Response shape matches what callers expect
- [ ] Auth works — `ScriptApp.getIdentityToken()` is accepted by Cloud Run
- [ ] Bridge dual-write is working (Firestore + Sheets stay in sync)
- [ ] Run bridge verification: `npx tsx services/api/src/scripts/bridge-verify.ts`
- [ ] Test with a single record in dry-run mode (if available)
- [ ] Test with a real record — verify data appears in both Firestore and Sheets
- [ ] Monitor Cloud Run logs for errors after swap
- [ ] Verify GAS trigger/caller updated (not still calling old endpoint)
- [ ] Update ATLAS source registry if data source routing changed

## Rollback

If a swap causes issues:

1. Revert the GAS function to call RAPID_API directly (pre-swap version)
2. `clasp push --force` to deploy the revert
3. Investigate Cloud Run logs
4. No data loss expected — Bridge writes to both Firestore and Sheets
