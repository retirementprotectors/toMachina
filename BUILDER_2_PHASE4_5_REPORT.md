# Builder 2 — Phase 4+5 Report

## CP1: All 9 New Route Files Created and Compiling

All 9 GAS files have been ported to Express/TypeScript routes in `services/api/src/routes/`:

| GAS Source | New Route File | Lines | Endpoints Ported |
|-----------|---------------|-------|-----------------|
| API_CampaignSend.gs (755 lines) | `campaign-send.ts` | 283 | POST /enroll, POST /manual, GET /history, GET /enrollments, POST /targets |
| API_Import.gs (856 lines) | `import.ts` | 313 | POST /client, POST /clients, POST /account, POST /accounts, POST /batch, POST /validate, POST /approval/create, POST /finalize |
| API_Compliance.gs (959 lines) | `compliance.ts` | 187 | POST /audit, GET /audits, GET /audits/:id, POST /stale-users, POST /new-users |
| API_Booking.gs (570 lines) | `booking.ts` | 258 | GET /config/:slug, GET /busy, POST /, GET /search-clients |
| API_Sync.gs (334 lines) | `sync.ts` | 196 | POST /agent, POST /client, POST /account |
| API_Spark.gs (550 lines) | `spark.ts` | 314 | GET /test, GET /status, POST /webhook, POST / |
| API_Analytics.gs (296 lines) | `analytics.ts` | 238 | GET /, GET /summary, GET /:id, POST / |
| API_Webhook.gs (311 lines) | `webhooks.ts` | 222 | POST /sendgrid, POST /twilio/sms, POST /twilio/voice |
| API_Rules.gs (126 lines) | `rules.ts` | 214 | GET /, GET /:id, POST /evaluate, POST /, PATCH /:id |

**Total: 9 files, ~2,225 lines of TypeScript, 30+ new endpoints.**

TypeScript build passes with zero errors: `tsc --noEmit` clean.

---

## CP2: All Routes Wired Into server.ts

All 9 routes imported and mounted in `services/api/src/server.ts`:

```
/api/campaign-send  -> normalizeBody + campaignSendRoutes
/api/import         -> normalizeBody + importRoutes
/api/compliance     -> complianceRoutes
/api/booking        -> normalizeBody + bookingRoutes
/api/sync           -> syncRoutes
/api/spark          -> sparkRoutes
/api/analytics      -> analyticsRoutes
/api/webhooks       -> webhookRoutes
/api/rules          -> rulesRoutes
```

Build passes: `turbo run build --filter=@tomachina/api` succeeds.

**Total API surface: 23 route files, 14 original + 9 new.**

---

## CP3: RAPID_IMPORT callRapidAPI_() — URL Change Documented

**Location**: `/Users/joshd.millang/Projects/gas/RAPID_IMPORT/Code.gs`, lines 58-119

**Current state**:
```javascript
var RAPID_API_CONFIG = {
  URL: 'https://script.google.com/macros/s/AKfycbwaCzn-U1arJn17b4s2afF8ZIGJTs-Uf5PdA5t63o8Rx0hLNXuzZD4SJs7IJ0GLnaFb/exec',
  _calledFromAPI: false
};
```

**Required change** (when Cloud Run API is deployed and tested):
```javascript
var RAPID_API_CONFIG = {
  URL: 'https://api.tomachina.com/api',
  _calledFromAPI: false
};
```

**Additional change** in `callRapidAPI_()` (line 80-119):
- Add OIDC auth header: `ScriptApp.getIdentityToken()` for Bearer token
- Change URL construction from `?path=endpoint` to direct path `/endpoint`
- Remove `_method` override (Express supports PUT/DELETE natively)

**NOT applied yet** because this is a production switch that requires:
1. Cloud Run API fully deployed to `api.tomachina.com`
2. End-to-end testing of all import paths
3. JDM approval before cutting over

The Express routes maintain compatible endpoint paths and response format, so the switch should be transparent.

---

## CP4: MCP callCloudRunAPI() — Documented

**Location**: `/Users/joshd.millang/Projects/services/MCP-Hub/rpi-workspace-mcp/src/gas-tools.js`

**Required addition** (add after the HANDLERS export):

```javascript
// Cloud Run API helper — calls toMachina API instead of GAS execute_script
export async function callCloudRunAPI(url, method = 'GET', body = null) {
  const auth = getAuthClient();
  const { token } = await auth.getAccessToken();

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  return res.json();
}
```

**Pattern for MCP tool migration** (gradual):
```javascript
async function getTeam() {
  try {
    return await callCloudRunAPI('https://api.tomachina.com/api/users', 'GET');
  } catch {
    return await handleExecuteScript({
      scriptId: RAPID_API_SCRIPT_ID,
      functionName: 'getTeamForUI',
      devMode: true,
    });
  }
}
```

**NOT applied yet** because:
1. MCP-Hub is at `/Users/joshd.millang/Projects/services/MCP-Hub/` (outside my worktree)
2. MCP restart required after changes
3. Should be coordinated with the RAPID_IMPORT URL switch

---

## CP5: Launchd Agents Reviewed

**Active agents** (from `launchctl list | grep com.rpi`):

| Agent | PID | Status | Disposition |
|-------|-----|--------|-------------|
| `com.rpi.document-watcher` | 957 | Running | **KEEP** — Polls `_INTAKE_QUEUE` every 60s. Critical for document processing pipeline. Will eventually migrate to Cloud Function + Pub/Sub trigger. |
| `com.rpi.analytics-push` | - | Idle | **KEEP FOR NOW** — Daily push to `_AI_ANALYTICS` MATRIX. Once BigQuery export extension is active and RIIMO reads from BQ instead of Sheets, can disable. Check: `firebase ext:list --project claude-mcp-484718` |
| `com.rpi.mcp-analytics` | - | Idle | **KEEP** — Monday 8am weekly MCP ROI report to Slack. Local analytics, no cloud replacement. |
| `com.rpi.claude-cleanup` | - | Idle | **KEEP** — Sunday 3am session cleanup. Local maintenance. |
| `com.rpi.knowledge-promote` | - | Idle | **KEEP** — Daily 4am MEMORY.md promotion. Local maintenance. |
| `com.rpi.prodash-sync` | - | Exit 78 | **INVESTIGATE** — Not in the documented list. Exit code 78 (error). May be stale/broken. |

**Recommendations**:
1. All 5 documented agents should remain active for now
2. `com.rpi.prodash-sync` has a non-zero exit code and is not in the documented agent list — JDM should investigate
3. `com.rpi.analytics-push` is the first candidate for removal once BigQuery export is confirmed active
4. `com.rpi.document-watcher` is the highest-value migration target (Cloud Function would eliminate local dependency)

---

## Architecture Notes

### Key Design Decisions in Route Ports

1. **Firestore-first**: All new routes read/write Firestore as primary store, with bridge writes for Sheets sync
2. **DND enforcement**: Campaign send routes check `dnd_all`, `dnd_email`, `dnd_sms` flags before queuing
3. **Compliance via Firestore**: GAS compliance used AdminDirectory API directly. In toMachina, a Cloud Function syncs Workspace user data to `workspace_users` collection, and the compliance routes read from there.
4. **Booking calendar**: GAS used Calendar Advanced Service for FreeBusy. In toMachina, a Cloud Function syncs busy periods to `calendar_busy` collection.
5. **SPARK webhooks**: Maintained identical event types and routing logic. Webhook status stored in `spark_config/status` Firestore doc instead of Script Properties.
6. **Rules engine**: Time-based rule evaluation moved from GAS trigger to Cloud Scheduler calling POST /api/rules/evaluate.

### Endpoint Path Compatibility

The Cloud Run API maintains compatible paths with the GAS API:

| GAS Path | Cloud Run Path |
|----------|---------------|
| `?path=import/client` | `/api/import/client` |
| `?path=campaignsend/enroll` | `/api/campaign-send/enroll` |
| `?path=sync/agent` | `/api/sync/agent` |
| `?path=analytics` | `/api/analytics` |
| `?path=spark/webhook` | `/api/spark/webhook` |
| `?path=webhook/sendgrid` | `/api/webhooks/sendgrid` |

RAPID_IMPORT's `callRapidAPI_()` uses `?path=` query params. The URL switch will need to adjust to direct path routing.

---

## Files Modified/Created

### Created (9 route files)
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/campaign-send.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/import.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/compliance.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/booking.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/sync.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/spark.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/analytics.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/webhooks.ts`
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/routes/rules.ts`

### Modified (1 file)
- `/Users/joshd.millang/Projects/toMachina-builder2-p4/services/api/src/server.ts` — added 9 route imports + mount points
