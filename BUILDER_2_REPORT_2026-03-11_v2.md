# Builder 2 Report — 2026-03-11 v2 (Round 3)

> Scope: Deploy All Three Portals + API + Bridge + BigQuery
> Builder: Claude Opus 4.6 (worktree)
> Plan: `~/.claude/plans/valiant-napping-waterfall.md`
> Branch: `builder-2/deploy-all-portals`
> Note: Agent hit API rate limit twice — this report compiled from infrastructure state inspection

## Status: PARTIALLY COMPLETE (infrastructure up, auth issue blocking)

## What Was Accomplished

### Infrastructure Created
| Resource | Status | Details |
|----------|--------|---------|
| Cloud Run: `tm-prodash` | Healthy | Image: `tm-prodash:latest` |
| Cloud Run: `tm-riimo` | Healthy | Image: `tm-riimo:v0.5.0-b2r3` |
| Cloud Run: `tm-sentinel` | Healthy | Image: `tm-sentinel:v0.5.0-b2r3` |
| Firebase Hosting: `tomachina-prodash` | Created + deployed | `https://tomachina-prodash.web.app` |
| Firebase Hosting: `tomachina-riimo` | Created + deployed | `https://tomachina-riimo.web.app` |
| Firebase Hosting: `tomachina-sentinel` | Created + deployed | `https://tomachina-sentinel.web.app` |
| Firebase Hosting: `tomachina-api` | Created | `https://tomachina-api.web.app` |
| IAM: invoker roles | Granted | All 3 portal services have firebase-rules, firebase-adminsdk, gcp-sa-firebase, serverless-robot, compute, and domain:retireprotected.com |

### Files Modified (uncommitted in worktree)
| File | Changes |
|------|---------|
| `apps/riimo/Dockerfile` | Added Firebase env ARGs (matches prodash pattern) |
| `apps/sentinel/Dockerfile` | Added Firebase env ARGs (matches prodash pattern) |
| `cloudbuild.yaml` | Added Firebase build-arg substitutions for all 3 portals, added substitutions block |
| `firebase.json` | Multi-site hosting: prodash, riimo, sentinel, api — each with Cloud Run rewrite |
| `services/api/Dockerfile` | Updated for monorepo build |
| `services/bridge/Dockerfile` | Updated for monorepo build |
| `services/api/package.json` | +1 dep |
| `services/bridge/package.json` | +1 dep |

## Blocking Issue: 403 on All Portals

**All three portal URLs return 403: "The request was not authenticated."**

| URL | HTTP Status |
|-----|------------|
| `https://tomachina-prodash.web.app` | 403 |
| `https://tomachina-riimo.web.app` | 403 |
| `https://tomachina-sentinel.web.app` | 403 |
| `https://claude-mcp-484718.web.app` | 403 (was working before) |

**Root Cause Analysis:**
- Cloud Run services are healthy (all return `True` for readiness)
- IAM bindings look correct (firebase-rules service account has run.invoker on all 3)
- Cloud Run logs: `"The request was not authenticated. Either allow unauthenticated invocations or set the proper Authorization header."`
- The Firebase Hosting → Cloud Run rewrite proxy isn't passing auth headers correctly

**Possible Fixes (in order of likelihood):**
1. **Re-deploy Firebase Hosting** — The multi-site deploy may need `firebase deploy --only hosting:tomachina-prodash,hosting:tomachina-riimo,hosting:tomachina-sentinel` syntax
2. **Add `pinTag: true`** to firebase.json rewrites — forces Firebase to use IAM-authenticated proxy
3. **Org policy interference** — The org policy that blocks `allUsers` may also be blocking the Firebase service account's requests at the ingress level
4. **Cloud Run ingress setting** — Check if services are set to `internal-and-cloud-load-balancing` (which would block Firebase Hosting)

**Note:** The original `claude-mcp-484718.web.app` URL also returns 403 now. This may be because the multi-site firebase.json no longer includes the default site — the `firebase deploy --only hosting` may have wiped the original site's config.

## Not Started (agent died before reaching these)
- API + Bridge service deploy to Cloud Run (tm-api, tm-bridge)
- Custom domain mapping (prodash/riimo/sentinel.tomachina.com)
- BigQuery feed-forward setup

## Checkpoint Status
| Checkpoint | Status |
|-----------|--------|
| CP1: All three Cloud Builds succeed | PARTIAL — images built + deployed, but auth issue |
| CP2: All three portals accessible via URLs | BLOCKED — 403 auth issue |
| CP3: API + Bridge deployed to Cloud Run | NOT STARTED |
| CP4: BigQuery export configured | NOT STARTED |

## Architecture Decisions
| Decision | Rationale |
|----------|-----------|
| Multi-site firebase.json (array format) | Firebase requires array format for multiple hosting sites pointing to different Cloud Run services |
| Cloud Build substitutions for Firebase env | Keeps secrets out of Dockerfile, uses GCP substitution pattern |
| Separate Firebase Hosting sites per portal | Each portal gets its own URL and independent deploy |

## Known Issues
| Issue | Severity | Notes |
|-------|----------|-------|
| 403 on all portal URLs | HIGH | Firebase Hosting → Cloud Run auth not working. See fix analysis above. |
| Original prodash URL broken | HIGH | `claude-mcp-484718.web.app` also 403 — multi-site deploy likely overwrote it |
| Worktree changes not committed | MEDIUM | 9 files modified, need commit + push |
| tm-api and tm-bridge not deployed | MEDIUM | Round 3 scope, agent died before starting |
