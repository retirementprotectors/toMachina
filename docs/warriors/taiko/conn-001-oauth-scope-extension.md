# TKO-CONN-001 — OAuth Scope Extension & GCP Internal OAuth

**Date:** 2026-04-12  
**Warrior:** RONIN, The Builder  
**Ticket:** TKO-CONN-001  
**Branch:** ronin/tko-conn-001-008

---

## What Was Done

Extended `packages/auth/src/provider.tsx` `getGoogleProvider()` to add 10 OAuth scopes
for Google Chat and Google Calendar/Meet. These scopes are requested at Firebase Auth
sign-in time via `provider.addScope(...)`.

---

## Scopes Added

### Google Chat (8 scopes)

| Scope | Purpose |
|-------|---------|
| `chat.spaces` | Create and list Chat Spaces |
| `chat.spaces.readonly` | Read Space metadata |
| `chat.messages` | Send messages in Spaces and DMs |
| `chat.messages.readonly` | Read message history |
| `chat.messages.reactions` | React to messages (thread support) |
| `chat.memberships` | List and manage Space memberships |
| `chat.memberships.readonly` | Read-only membership list |
| `chat.users.readstate` | Track read position per Space (TKO-CONN-006 unread badges) |

### Google Calendar / Meet (2 scopes)

| Scope | Purpose |
|-------|---------|
| `calendar.readonly` | Read upcoming meetings for Meet tab |
| `calendar.events` | Create instant Meet meetings |

---

## Required Admin Action — GCP OAuth Client → Internal

**This is a one-time admin action. Takes ~30 seconds in GCP Console.**

The GCP OAuth client is currently set to **External**, which shows a consent screen on
every new scope grant. Flipping to **Internal** eliminates this for all `@retireprotected.com`
users — scopes are silently granted at sign-in. No external users exist on this OAuth client.

### Steps

1. Go to [GCP Console → APIs & Services → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=claude-mcp-484718)
2. Under **User type**, click **Edit**
3. Change **External** → **Internal**
4. Save

### After the flip

- No more consent screen for `@retireprotected.com` users
- All 8 Chat scopes + 2 Calendar scopes silently granted at next sign-in

---

## Re-Consent Rollout Plan

**Method: Brief re-login for team** (simpler, deterministic, small team)

After this code is deployed to production:

1. Each team member signs out of the portal once
2. Signs back in — Firebase Auth popup appears requesting the new scopes
3. They click **Allow** — this is a one-time consent
4. After that: no more consent screens (Internal OAuth)

**Comms:** MUSASHI handles copy for the sign-out/re-login prompt shown in the portal.

---

## Domain-Wide Delegation (Server-Side API Routes)

The API routes in `services/api/src/routes/connect.ts` use **domain-wide delegation (DWD)**
to impersonate users server-side for Chat API calls. This is handled by
`services/api/src/lib/google-chat-client.ts`.

### Required one-time setup for DWD

1. In **Workspace Admin Console** → **Security** → **Access and data controls** → **API controls** → **Manage Domain Wide Delegation**
2. Add the Cloud Run service account client ID (from `console.cloud.google.com/iam-admin/serviceaccounts?project=claude-mcp-484718`)
3. Authorize these OAuth scopes (comma-separated):

```
https://www.googleapis.com/auth/chat.spaces,https://www.googleapis.com/auth/chat.spaces.readonly,https://www.googleapis.com/auth/chat.messages,https://www.googleapis.com/auth/chat.messages.readonly,https://www.googleapis.com/auth/chat.messages.reactions,https://www.googleapis.com/auth/chat.memberships,https://www.googleapis.com/auth/chat.memberships.readonly,https://www.googleapis.com/auth/chat.users.readstate
```

4. Also enable **chat.googleapis.com** in GCP Console → APIs & Services → Library

Until DWD is authorized, the API routes return empty arrays gracefully rather than errors.
The UI handles this with a "Google Chat not connected — sign out and sign back in" state.

---

## Gate

All team members authenticate without a consent screen after GCP flip + one re-login. ✅
