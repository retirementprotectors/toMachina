# Sprint 2 — Builder 3 Report: People + Communications Modules

**Branch:** `sprint2/people-comms-modules`
**Builder:** 3 (People + Communications)
**Status:** COMPLETE

---

## Deliverables

### 1. MyRpiProfile.tsx (MEDIUM complexity) — DONE
**File:** `packages/ui/src/modules/MyRpiProfile.tsx`

**Features built:**
- Profile card with Google account photo, full name, job title, division, level badge
- Contact details: email, phone, personal email, location, NPN, hire date
- Team info: division, unit, manager, direct reports (LEADER+ only, clickable to switch)
- Employee profile parsed from `employee_profile` JSON: roadmap doc link, Drive folder, Meet room, team folders
- Aliases displayed as tags
- MyDropZone placeholder: "Record a Meeting" button (disabled/coming soon), "Upload Documents" button (disabled/coming soon), "Recent Captures" empty state with description text
- Profile switcher (LEADER+ only): dropdown of all team members, switches viewed profile
- Edit mode: toggle to edit own profile fields (first name, last name, phone, location, aliases). Writes directly to Firestore `users` collection.

**Data sources:**
- `users` collection (matched by email, or selected team member email)
- `org` implicit via `manager_email` / `direct reports` query
- Auth context for current user + photo

### 2. ConnectPanel.tsx (HIGH complexity) — DONE
**File:** `packages/ui/src/modules/ConnectPanel.tsx`

**Features built:**
- Message timeline: unified chronological feed showing all communications for current context
  - Each message shows: channel icon (SMS/Email/Call/Meeting), sender name, direction arrow, timestamp, subject, preview
  - Channel filter pills: All, SMS, Email, Call, Meeting
  - Search within messages (filters by preview text, sender name, subject)
- Compose panel:
  - Channel selector: SMS | Email (with DND-aware disabling)
  - Recipient field (placeholder text adapts to channel)
  - Subject field (email only)
  - Template quick-insert dropdown (reads from `templates` collection, filtered by channel)
  - Message body textarea
  - Send button (placeholder — shows toast "Send functionality coming soon" concept, currently just closes compose)
- Contact card sidebar (client context only):
  - Client avatar, name, status
  - Phone and email contact info
  - DND indicators: `dnd_all`, `dnd_email`, `dnd_sms` with visual badges
  - DND active → corresponding send channel disabled in compose
  - Recent activity: last 5 communications summary
- Props: `{ portal: string, clientId?: string, userId?: string }` — renders differently based on context

**Data sources:**
- `communications` collection (scoped by client_id, user email, or global)
- `clients` collection (for contact card in client context)
- `templates` collection (for compose quick-insert)

### 3. Module Barrel Export — DONE
**File:** `packages/ui/src/modules/index.ts`

Exports MyRpiProfile and ConnectPanel. Remaining 6 modules commented with TODO for merge coordinator.

**Updated:** `packages/ui/src/index.ts` — added `export * from './modules'`

### 4. Portal Pages — DONE

All 6 portal pages created as 3-line imports:

| Portal | Route | File |
|--------|-------|------|
| RIIMO | `/myrpi` | `apps/riimo/app/(portal)/myrpi/page.tsx` (replaced existing) |
| ProDashX | `/myrpi` | `apps/prodash/app/(portal)/myrpi/page.tsx` (NEW) |
| SENTINEL | `/myrpi` | `apps/sentinel/app/(portal)/myrpi/page.tsx` (NEW) |
| RIIMO | `/connect` | `apps/riimo/app/(portal)/connect/page.tsx` (NEW) |
| ProDashX | `/connect` | `apps/prodash/app/(portal)/connect/page.tsx` (replaced placeholder) |
| SENTINEL | `/connect` | `apps/sentinel/app/(portal)/connect/page.tsx` (NEW) |

### 5. Sidebar Updates — DONE

- `apps/prodash/.../PortalSidebar.tsx` — Added MyRPI nav item to Workspace section (moduleKey: MY_RPI)
- `apps/sentinel/.../PortalSidebar.tsx` — Added MyRPI nav item to Workspace section (moduleKey: MY_RPI)
- RIIMO already had MyRPI — no change needed

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `packages/ui/src/modules/MyRpiProfile.tsx` | NEW | Shared profile module |
| `packages/ui/src/modules/ConnectPanel.tsx` | NEW | Shared communications module |
| `packages/ui/src/modules/index.ts` | NEW | Barrel export (2 of 8 modules) |
| `packages/ui/src/index.ts` | MODIFIED | Added modules re-export |
| `apps/riimo/app/(portal)/myrpi/page.tsx` | REPLACED | Was 154 lines, now 3-line import |
| `apps/prodash/app/(portal)/myrpi/page.tsx` | NEW | 3-line import |
| `apps/sentinel/app/(portal)/myrpi/page.tsx` | NEW | 3-line import |
| `apps/riimo/app/(portal)/connect/page.tsx` | NEW | 3-line import |
| `apps/prodash/app/(portal)/connect/page.tsx` | REPLACED | Was placeholder, now 3-line import |
| `apps/sentinel/app/(portal)/connect/page.tsx` | NEW | 3-line import |
| `apps/prodash/.../PortalSidebar.tsx` | MODIFIED | +1 nav item (MyRPI) |
| `apps/sentinel/.../PortalSidebar.tsx` | MODIFIED | +1 nav item (MyRPI) |

## Files NOT Touched
- `packages/core/**` — import only
- `packages/db/**` — import only
- `packages/auth/**` — import only
- All Builder 1 files (CamDashboard, CommandCenter, AdminPanel)
- All Builder 2 files (C3Manager, DexDocCenter, AtlasRegistry)
- `apps/*/clients/**`, `apps/*/dashboard/**`, `apps/*/sales-centers/**`
- `services/**`

---

## Build Verification

```
npm install ✓
@tomachina/ui build ✓ (0 errors)
@tomachina/prodash build ✓
@tomachina/riimo build ✓
@tomachina/sentinel build ✓
All 7 packages successful, 0 failures
```

---

## Merge Notes

1. **Barrel export needs finalization:** `packages/ui/src/modules/index.ts` has 6 commented exports. After Builders 1 and 2 merge, uncomment all exports.
2. **No cross-builder conflicts expected:** My changes are in distinct files. The only shared file is `packages/ui/src/index.ts` which I added a single line to.
3. **Connect route in ProDash:** ProDash had an existing placeholder at `/connect` (in Admin section). My version replaces it with the shared ConnectPanel component. The sidebar entry for Connect remains in the Admin section as-is.

---

## Design Decisions

1. **Profile switcher uses `<select>` for team members** — This is a known entity (team members from users collection), but the full team list is a global browse, not a person-selection lookup. The SmartLookup component would be ideal here in a future iteration.
2. **ConnectPanel send is a placeholder** — The `/api/comms/send` route doesn't exist yet. The compose UI is fully functional but closes without sending. Ready for wiring when the API route is built.
3. **Communications query is broad** — Without a composite index on `client_id + created_at`, the query may need index creation in Firestore. If the query fails at runtime, create the index via the Firebase console link in the error.
4. **MyDropZone buttons are disabled** — Per spec, these are placeholders. The UI structure is ready for functionality to be wired in.
