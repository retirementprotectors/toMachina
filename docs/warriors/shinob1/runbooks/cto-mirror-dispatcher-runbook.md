# CTO Mirror Dispatcher — Runbook

**Ticket:** TRK-14401
**Sprint:** ZRD-DISP-MIRROR
**Service:** mdj-dispatch-dojo (port 4210)
**Last Updated:** 2026-04-12

---

## Overview

The CTO Mirror Dispatcher mirrors eligible bilateral Slack messages to `#cto-mirror` and injects them into SHINOB1's tmux session for real-time passive awareness. Priority-tagged messages additionally fire a `🚨 PRIORITY` tmux inject. All events are audit-logged to the `cto_mirror_events` Firestore collection.

**Files changed:**
- `/home/jdm/Projects/dojo-warriors/mdj-agent/src/dispatchers/shared.ts` — constants + helpers
- `/home/jdm/Projects/dojo-warriors/mdj-agent/src/dispatchers/dojo.ts` — `mirrorToCTO()` + dispatch wire

---

## Deploy Steps

### 1. Pull latest code on MDJ_SERVER

```bash
cd /home/jdm/Projects/dojo-warriors/mdj-agent
git pull origin main
```

### 2. Build TypeScript

```bash
npm run build
# Expected: zero errors, `dist/` updated
```

### 3. Restart the dojo dispatcher

```bash
# If running as a systemd service:
sudo systemctl restart mdj-dispatch-dojo

# If running in a tmux session (SHINOB1 or MDJ):
# Kill the existing process, then:
node dist/dispatchers/dojo.js
```

### 4. Verify heartbeat within 60 seconds

```bash
# Check Firestore dispatcher_health/dojo document
# last_heartbeat should be < 60s ago
# OR: hit the health endpoint
curl http://localhost:4210/dispatch/health | jq '.dispatchers.dojo'
```

Expected response fields:
```json
{
  "dispatcher": "dojo",
  "status": "running",
  "port": 4210,
  "last_heartbeat": "<recent timestamp>",
  "pid": <process id>,
  "uptime_s": <seconds since start>
}
```

---

## Smoke Tests

### Smoke Test B — Plain bilateral message mirrors to #cto-mirror

1. Post any message (no priority tags) in `#ronin`, `#megazord`, `#musashi`, or another bilateral channel
2. Wait up to 10 seconds
3. Verify `#cto-mirror` receives a message with prefix: `# Mirror from <WARRIOR>: <message text>`
4. Verify SHINOB1 tmux has the message injected (look for the `# Mirror from` line in SHINOB1's Claude Code session)
5. Verify Firestore `cto_mirror_events` has a new document with `is_priority: false` and `mirror_ok: true`

### Smoke Test C — Priority-tagged message escalates

1. Post a message containing one of the 4 priority tags in any eligible bilateral channel:
   - `[CTO-PRIORITY]`
   - `[BLOCKER]`
   - `[CTO-URGENT]`
   - `@shinob1`
2. Wait up to 10 seconds
3. Verify `#cto-mirror` receives the standard mirror: `# Mirror from <WARRIOR>: <text>`
4. Verify SHINOB1 tmux receives **two** injections:
   - `# Mirror from <WARRIOR>: <text>` (standard)
   - `🚨 PRIORITY from <WARRIOR>: <text>` (escalation)
5. Verify Firestore `cto_mirror_events` has a new document with `is_priority: true`

### Smoke Test — Loop guard (CHANNEL_CTO_MIRROR source)

1. Post a message directly in `#cto-mirror` (the channel itself)
2. Wait 30 seconds
3. Verify `#cto-mirror` does NOT receive any re-mirror post
4. Verify Firestore `cto_mirror_events` does NOT have a new document for this post
5. Verify SHINOB1 tmux does NOT receive a new injection from this message

This is the non-negotiable gate. If this fails, disable the mirror immediately (see Revert).

### Smoke Test — DAVID channel isolation

1. Post a message in `#david-001-midwest-medigap` (`CHANNEL_DAVID_001`)
2. Wait 30 seconds
3. Verify `#cto-mirror` does NOT receive a mirror post for this message
4. Verify Firestore `cto_mirror_events` does NOT have a new document

DAVID channels already route direct to SHINOB1 tmux via the standard dispatcher delivery path. Mirroring would cause a double-inject.

### Smoke Test — WAR_ROOM isolation

1. Post any message in `#war-room`
2. Wait 30 seconds
3. Verify `#cto-mirror` does NOT receive a mirror post

WAR_ROOM volume is too high for mirroring — signal collapses. CTO reads war room directly.

---

## Revert Procedure

### Option A — Remove the channel ID (instant disable, zero code change)

Set `CHANNEL_CTO_MIRROR` to an empty string or non-existent channel in `shared.ts`:

```typescript
// Temporary disable — mirror posts will fail silently (postSlack returns false)
export const CHANNEL_CTO_MIRROR = "";
```

Rebuild and restart. All mirror posts fail silently (caught errors, logged only). No crash. Bilateral dispatch continues normally.

### Option B — Remove channels from MIRROR_ELIGIBLE_CHANNELS

Edit `shared.ts` and remove specific channels from the `MIRROR_ELIGIBLE_CHANNELS` set. Useful for scoping the mirror to fewer channels rather than disabling entirely.

### Option C — Full rollback via git

```bash
cd /home/jdm/Projects/dojo-warriors/mdj-agent
git revert HEAD  # or target the specific ZRD-DISP-MIRROR commit
npm run build
sudo systemctl restart mdj-dispatch-dojo
```

### After any revert

1. Verify the health endpoint returns `status: "running"`
2. Confirm `#cto-mirror` stops receiving new mirror posts
3. Confirm bilateral dispatch still delivers to warrior tmux sessions normally

---

## Architecture Reference

```
Bilateral channel message
  → Slack Events API
  → /dojo/slack-event (port 4210)
  → dispatch(event)
    → classifyMessage()
    → deliverToWarrior()       ← primary path, unchanged
    → mirrorToCTO()            ← fire-and-forget, never blocks primary
        ├─ Guard 1: channel === CHANNEL_CTO_MIRROR → return immediately
        ├─ Guard 2: !MIRROR_ELIGIBLE_CHANNELS.has(channel) → return immediately
        ├─ postSlack(CHANNEL_CTO_MIRROR, "# Mirror from WARRIOR: ...")
        ├─ tmux inject SHINOB1 (standard)
        ├─ [if isPriorityMessage()] tmux inject SHINOB1 (🚨 PRIORITY)
        └─ logMirrorEvent() → cto_mirror_events (fire-and-forget)
```

**Eligible channels (8):** `#shinob1`, `#megazord`, `#musashi`, `#voltron`, `#raiden`, `#ronin`, `#exec`, `#the-dojo`
**Excluded:** `#war-room` (noise), `#david-001-midwest-medigap` (direct-routes to SHINOB1 already), `#cto-mirror` (loop guard)

**Priority tags (case-insensitive):** `[CTO-PRIORITY]`, `[BLOCKER]`, `[CTO-URGENT]`, `@shinob1`

**Audit collection:** `cto_mirror_events` in Firestore — fields: `source_channel`, `source_warrior`, `message_ts`, `message_text` (max 1000 chars), `is_priority`, `mirror_ok`, `created_at`, `created_by`

---

## Contacts

- **Owner:** SHINOB1 (CTO) — monitors `#cto-mirror`
- **Builder:** RONIN — ZRD-DISP-MIRROR sprint
- **Deploy path:** MDJ_SERVER → dojo dispatcher process
