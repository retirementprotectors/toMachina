# Sprint 7 - Builder 01 Report: Universal Modules

## Summary
Complete rebuild of 3 universal modules shared across all 3 portals (ProDashX, RIIMO, SENTINEL). All modules use CSS variable theming via `var(--portal)` for portal-specific branding. TypeScript strict mode, no `any` types, no external dependencies added.

## Files Modified

| File | Lines | Status |
|------|-------|--------|
| `packages/ui/src/modules/MyRpiProfile.tsx` | 926 (was 571) | Complete rebuild |
| `packages/ui/src/modules/AdminPanel.tsx` | 687 (was 541) | Complete rebuild |
| `packages/ui/src/modules/ConnectPanel.tsx` | 800 (was 583) | Complete rebuild |
| `packages/ui/src/modules/index.ts` | 14 (unchanged) | Verified exports |

**Total: 2,413 lines across 3 modules** (was 1,695)

## Module 1: MyRpiProfile (926 lines)

### Features Implemented
- **Profile Header**: Google avatar (photoURL), name, goes-by alias, status badge, level badge (Owner/Executive/Leader/User), job title, division, location
- **Communication Preferences**: Inline per-field editing (pencil icon, edit on click, save on blur/Enter, success checkmark animation). Fields: phone, email (read-only), personal email, first name, last name, location
- **Quick Links**: HR folder, roadmap doc, team folders -- all open in new tab
- **My Drop Zone**: 4 link rows (Meet Link, Intake Folder, External Booking, Internal Booking) each with copy/open/QR buttons
- **QR Code Generation**: SVG-based, deterministic hash from URL, no external dependencies. QR codes include proper finder patterns and timing patterns
- **Meeting Config**: Read-only list from `employee_profile.calendar_booking_types[]` showing name, duration, category
- **Calendar Config**: Weekly availability grid (Mon-Fri x 19 time slots from 8am-5pm). Toggle meeting types per slot. Save button writes to `employee_profile.calendar_config`
- **Leader+ Profile Switcher**: Dropdown to view any team member's profile (read-only when viewing others). Direct reports list with click-to-view

### Key Changes from Previous
- Removed bulk "Edit Profile" button -- replaced with inline per-field editing
- Added QR code generation (SVG, no deps)
- Added Drop Zone with copy/open/QR actions
- Added meeting config read-only list
- Added calendar config weekly grid
- Restructured into clear sections with headers

## Module 2: AdminPanel (687 lines)

### Features Implemented
- **Two Tabs**: Module Config + Pipeline Config with portal-colored active state
- **Module Config Tab**: Modules organized by 5 sections matching PortalSidebar NAV_SECTIONS:
  1. Workspace (Clients, Accounts, My Cases, MyRPI, Quick Intake)
  2. Sales Centers (Medicare, Life, Annuity, Advisory)
  3. Service Centers (RMD Center, Beni Center)
  4. Pipelines (Pipeline Board, Discovery Kit, Discovery, Data Foundation, Case Building, Close)
  5. Apps (ATLAS, CAM, DEX, C3, Command Center)
- Each module shows VIEW/EDIT/ADD entitlement badges
- Collapsible section headers with module counts
- Leaders see team member access per section with toggle-able entitlement badges
- Non-leaders see read-only view of their own permissions
- **Pipeline Config Tab**: Pipeline cards with name, category, ordered stages
- Leaders can edit stage names and add new stages
- Clean empty states for missing pipelines

### Key Changes from Previous
- Removed Users/Org/Roles tabs entirely
- Replaced with Module Config + Pipeline Config focus
- Section-organized module list mirrors sidebar structure
- Added real entitlement toggle for leaders
- Interior uses `--portal` color (not red)

## Module 3: ConnectPanel (800 lines)

### Features Implemented
- **3-Panel Progressive Disclosure**: Panel 1 (list) -> Panel 2 (conversation) -> Panel 3 (context)
- **Panel 1**: Three sub-tabs (Channels / Chat / Meet) + action button per tab (New Channel, New Message, Start Meet)
- **Channels Tab**: Channel list with icon, name, unread count badge, last message preview
- **Chat Tab**: DM list with avatar initial, person name, last message, timestamp, unread badge
- **Meet Tab**: Meeting room list with status badges, opens meet link in new tab
- **Panel 2**: Conversation thread with message bubbles (own = portal-colored right-aligned, others = card-colored left-aligned). Message input with send button. Info/profile button opens Panel 3
- **Panel 3**: Channel info (icon, name, description, member list) OR user profile (photo, name, title, email, phone, division, status, quick actions)
- **Close Behavior**: Right-to-left (Panel 3 -> Panel 2 -> module closes). Each close is independent
- Clean empty states for all tabs when collections don't exist

### Key Changes from Previous
- Complete paradigm shift from client comms hub to internal team communication
- Removed SMS/Email/Call channel filters, compose panel, template system, DND indicators
- Added 3-panel progressive disclosure UX
- Added Channels, Chat, Meet sub-tabs
- Added message bubble UI with own/other differentiation
- Added Panel 3 context panels (channel info + user profile)

## Firestore Collections Referenced

| Collection | Status | Used By |
|-----------|--------|---------|
| `users` | Exists (29K+ docs) | MyRpiProfile, AdminPanel |
| `pipelines` | Exists | AdminPanel |
| `channels` | Does not exist yet | ConnectPanel |
| `direct_messages` | Does not exist yet | ConnectPanel |
| `messages` | Does not exist yet | ConnectPanel |
| `meet_rooms` | Does not exist yet | ConnectPanel |

## Empty States Provided
- MyRpiProfile: Drop Zone links not configured, no meeting types, profile not found
- AdminPanel: No pipelines configured
- ConnectPanel: No channels, no conversations, no meeting rooms, no messages

## Build Verification
- `@tomachina/ui` build: PASS (tsc clean)
- `@tomachina/ui` type-check: PASS (tsc --noEmit clean)
- All 9 portal page wrappers verified compatible (props unchanged)
- No new npm dependencies added
- No `any` types, no `alert/confirm/prompt`, no hardcoded colors
