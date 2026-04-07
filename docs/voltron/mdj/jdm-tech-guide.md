# JDM Technology Translation Guide

> **You don't need to learn to code. You need to know what things ARE so you can make decisions.**
> This guide maps everything in toMachina back to the Sheets/GAS world you already understand.
> Keep this open during sessions. Ctrl+F when something comes up.

---

## Section 1: The Big Picture

Here's the entire platform in one flow:

```
 YOU (or a team member)
   |
   | open a browser
   v
 NEXT.JS PORTAL (ProDashX / RIIMO / SENTINEL)
   |
   | "I want to see my clients" or "Send a campaign"
   v
 CLOUD RUN API (the new RAPID_API)
   |
   | talks to the database
   v
 FIRESTORE (the new MATRIX)
   |
   | copies data for reporting
   v
 BIGQUERY (same BigQuery you already know)
```

**That's it.** Five layers. Every single thing in toMachina follows this path.

**The Sheets World equivalent was:**

```
 YOU
   |
   | open a browser
   v
 GAS WEB APP (PRODASHX / RIIMO / SENTINEL sidebar)
   |
   | ran a script
   v
 RAPID_API / RAPID_CORE (GAS functions)
   |
   | read/wrote cells
   v
 GOOGLE SHEETS (PRODASH_MATRIX / RAPID_MATRIX)
```

Same shape. Faster engine. No more "the script timed out" or "too many simultaneous users."

---

## Section 2: Data -- Where Stuff Lives

### The Core Translation

| Sheets World | Firebase World | Plain English |
|---|---|---|
| A spreadsheet (PRODASH_MATRIX) | Firestore database | **The whole database** -- all the data for one system |
| A tab (Clients, Accounts, Users) | A **collection** | **A group of similar records** -- all clients, all accounts, etc. |
| A row | A **document** | **One record** -- one client, one account, one user |
| A column header (first_name, phone) | A **field** | **One piece of info** about that record |
| A cell value ("Josh", "515-707-0207") | A **field value** | **The actual data** sitting in that spot |
| The row number (Row 47) | A **document ID** (a unique string like `abc123`) | **How you find a specific record** -- except IDs never change even if you sort |
| VLOOKUP to another tab | A **reference** (foreign key) | **"Go look up this person in that other tab"** |
| Conditional formatting (red if overdue) | **Firestore rules** | **Who can see/edit what** (but enforced by the system, not just colors) |
| Sheet protection / sharing settings | **Auth + entitlements** | **Who has access at all** |
| A filter view | A **query** | **Narrowing down what you see** -- "show me only Active clients in Iowa" |
| A pivot table | A **BigQuery query** or **aggregation** | **Summarizing data** -- totals, counts, averages |

### Subcollections -- The One New Concept

This is the only thing Firestore does that Sheets literally cannot.

**Sheets World:** Accounts are a separate tab. Each account row has a `client_id` column that points back to the Clients tab. To see all accounts for Client #47, you filter the Accounts tab by `client_id = 47`.

**Firestore World:** Accounts literally live INSIDE the client document. Like a folder inside a folder:

```
clients/
  abc123/                    <-- This IS client Josh Millang
    first_name: "Josh"
    last_name: "Millang"
    accounts/                <-- A folder of accounts INSIDE Josh's record
      def456/                <-- One specific account
        carrier: "Athene"
        product: "FIA"
      ghi789/                <-- Another account
        carrier: "Nationwide"
        product: "MYGA"
```

The path `clients/abc123/accounts/def456` is like saying "Clients tab, row for Josh, then Accounts tab filtered to Josh, row for the Athene FIA."

**Why this matters to you:** When someone says "subcollection," they mean "data that lives inside another record." Accounts live inside clients. Communications live inside clients. Activities live inside clients. It's cleaner than VLOOKUPs and it's instant -- no script running to connect the dots.

### What 29,000+ Documents Means

In Sheets, you had maybe 5,000 rows across all your MATRIX tabs. In Firestore, every client, every account, every user, every pipeline card, every communication, every revenue record -- they're all individual documents. 29,000+ just means there's a lot of data in there, and unlike Sheets, it doesn't slow down when you add more.

---

## Section 3: Code -- Who Does What

| Sheets World | GAS World | Firebase/Next World | Plain English |
|---|---|---|---|
| You type in a cell | A trigger fires a function | User fills a form, clicks Save, API route runs | **Data gets created/updated** |
| A formula (`=SUM`, `=IF`, `=VLOOKUP`) | A GAS function in RAPID_CORE | A TypeScript function in `packages/core` | **Business logic / calculations** -- the math and rules |
| An `onEdit` trigger | `ScriptApp.newTrigger()` | A Cloud Function trigger | **"When X happens, do Y automatically"** -- like when a new file lands in a folder |
| A custom menu item ("RPI Tools > Import") | A GAS web app (HTML service) | A page/route in Next.js (`/admin`, `/intake`) | **A screen the user clicks on** |
| A button with an assigned script | An HTML form with a submit handler | A React component with an `onClick` | **User clicks a button, something happens** |
| The GAS editor (script.google.com) | Same | VS Code / Claude Code | **Where code gets written** -- you never touch this |
| `clasp push` | Same | `git push` to main -> auto-deploy | **How code gets to production** -- push = live |
| Waiting 6 minutes for the script to finish | Same | It just... happens. Instantly. | **Speed** -- Cloud Run doesn't have GAS execution limits |
| "Exceeded maximum execution time" | Same | Doesn't happen | **No timeouts** -- Cloud Run can run for as long as it needs |
| "Too many simultaneous executions" | Same | Doesn't happen | **No user limits** -- 100 people can use the portal at the same time |

### The Key Upgrade in Plain English

In the Sheets/GAS world, everything was single-threaded. One person runs a script, everyone else waits. The script times out after 6 minutes. The spreadsheet locks up. You get "trying to connect" spinners.

In the toMachina world, the database (Firestore) handles thousands of simultaneous reads/writes. The API (Cloud Run) spins up more copies of itself when traffic increases. Nobody waits for anyone else. The portals load in under 2 seconds.

---

## Section 4: UI -- What Users See

| Sheets World | Next.js World | Plain English |
|---|---|---|
| A spreadsheet with tabs at the bottom | A portal with sidebar navigation | **The main app** -- ProDashX, RIIMO, or SENTINEL |
| A tab you click (Clients, Accounts) | A route/page (`/contacts`, `/accounts`) | **A screen** -- each URL is a different screen |
| A dropdown in a cell (data validation list) | A select/dropdown component | **A picker** -- choose from a list |
| A checkbox in a cell | A toggle/checkbox component | **Yes/no choice** |
| Data validation ("must be a number") | Form validation | **"You can't type letters in the phone field"** -- the form stops you before you screw it up |
| A filter view (show only Active) | Filter dropdowns + search bar | **Narrowing down what you see** |
| Sort A-Z on a column | Click a column header (arrows appear) | **Reordering rows** |
| A GAS HTML sidebar | A slide-out panel (CommsModule, ConnectPanel) | **A panel that slides in from the right side** |
| A GAS modal dialog | A modal component | **A popup box** -- "Are you sure you want to delete this?" |
| A GAS toast notification | A toast component | **A brief message** -- "Saved!" or "Error: missing phone number" pops up and fades away |
| Conditional formatting (green/red cells) | Status badges and colored indicators | **Visual signals** -- green = good, red = attention, yellow = pending |
| A Google Form | A page with a form component | **Collecting info from users** -- but it's built into the portal, not a separate Google Form |
| A named range | A reusable component | **Something built once, used everywhere** -- like a client card that appears on 5 different pages |

### Portals = The New Spreadsheets

Think of it this way:

| Old World | New World |
|---|---|
| PRODASH_MATRIX (the spreadsheet) | **ProDashX portal** (prodash.tomachina.com) |
| RAPID_MATRIX (the spreadsheet) | **RIIMO portal** (riimo.tomachina.com) |
| SENTINEL_MATRIX (the spreadsheet) | **SENTINEL portal** (sentinel.tomachina.com) |

Same three worlds. Same three audiences. Just not spreadsheets anymore.

---

## Section 5: Architecture -- How Things Connect

| Sheets/GAS World | toMachina World | Plain English |
|---|---|---|
| PRODASH_MATRIX | ProDashX portal + Firestore | **The B2C platform** -- client-facing sales + service |
| RAPID_MATRIX | RIIMO portal + Firestore | **The B2E platform** -- internal shared services |
| SENTINEL_MATRIX | SENTINEL portal + Firestore | **The B2B platform** -- M&A + partnerships |
| RAPID_CORE (GAS library used by everything) | `packages/core` | **Shared business logic** -- calculations, rules, normalizers used by all 3 portals |
| RAPID_API (GAS web app that handled requests) | `services/api` on Cloud Run | **The backend** -- the middleman between the portal and the database |
| RAPID_IMPORT (GAS intake triggers) | `services/intake` (Cloud Functions) | **Data ingestion** -- how data gets INTO the system from external sources |
| RAPID_COMMS (GAS communications engine) | CommsModule (React) + Twilio | **Communications** -- calls, texts, emails |
| RAPID_FLOW (GAS workflow engine) | Flow Engine in `packages/core/flow` | **Workflow automation** -- "when this stage completes, move to the next one" |
| C3 (GAS campaign engine) | C3 Manager (React) + API routes | **Campaign management** -- sending marketing to clients |
| ATLAS (GAS data registry) | ATLAS Registry (React) + API routes | **Data source tracking** -- where every piece of data comes from |
| CAM (GAS commission analytics) | CAM Dashboard (React) + API routes | **Commission/revenue analytics** |
| GHL (GoHighLevel CRM) | The portals themselves | **CRM / client management** -- we replaced GHL with our own system |
| A Google Form | A page with form components | **Collecting info** |
| Google Drive folders | Firebase Storage (+ Drive for legacy files) | **File storage** |
| BigQuery | BigQuery (same!) | **Analytics and reporting** -- this one didn't change |

### The GAS Migration Scorecard

| GAS Engine | Status | Where It Went |
|---|---|---|
| RAPID_COMMS | Archived (Sprint 4) | `services/api/src/routes/comms.ts` + `communications.ts` |
| RAPID_FLOW | Archived (Sprint 4) | `packages/core/flow/` + `services/api/src/routes/flow.ts` |
| C3 | Archived (Sprint 4) | `services/api/src/routes/campaigns.ts` + `campaign-send.ts` + `campaign-analytics.ts` |
| ATLAS | Archived (Sprint 4) | `services/api/src/routes/atlas.ts` |
| CAM | Archived (Sprint 5) | `services/api/src/routes/cam.ts` + `revenue.ts` |
| RAPID_API | Archived (Sprint 5) | `services/api/` (the entire Cloud Run API replaced it) |
| RAPID_CORE | Still running | Thin adapter for the 2 remaining GAS projects |
| RAPID_IMPORT | Still running | Being ported to Cloud Functions |
| DEX | Still running | Sprint 11 target |

**3 left. 6 archived. The finish line is visible.**

---

## Section 6: The RPI-Specific Map

This is the one you'll Ctrl+F the most. Every major thing you work with, where it lives in all three worlds.

| What You Call It | Sheets Location | Firestore Path | Portal Location |
|---|---|---|---|
| **A client** | PRODASH_MATRIX -> Clients tab | `clients/{uuid}` | `/contacts` list and `/contacts/{id}` detail |
| **An account/policy** | PRODASH_MATRIX -> Accounts tab | `clients/{uuid}/accounts/{uuid}` (subcollection) | `/accounts` list and Contact Detail -> Accounts tab |
| **A communication** | RAPID_COMMS logs | `clients/{uuid}/communications/{uuid}` (subcollection) | Communications Module (slide-out panel) |
| **An agent/producer** | PRODASH_MATRIX -> Agents tab | `agents/{id}` or `producers/{id}` | Admin Panel, DAVID HUB |
| **A team member** | RAPID_MATRIX -> Users tab | `users/{email}` (keyed by email address) | Admin Panel -> Team Config |
| **A pipeline** | Various RAPID_MATRIX tabs | `flow_pipelines/{id}` + `flow_stages/{id}` | `/pipelines` view, Pipeline Studio (builder) |
| **A pipeline card** | A row in a pipeline tab | `flow_instances/{id}` | Kanban board card |
| **A campaign** | C3 engine Sheets | `campaigns/{id}` + `templates/{id}` + `content_blocks/{id}` | C3 Manager |
| **A revenue record** | PRODASH_MATRIX -> Revenue tab | `revenue/{id}` | CAM Dashboard |
| **A carrier** | PRODASH_MATRIX -> Carriers tab | `carriers/{id}` | Various dropdowns across portals |
| **A product** | PRODASH_MATRIX -> Products tab | `products/{id}` | Product pickers in QUE, NBX |
| **A case/task** | RAPID_FLOW | `case_tasks/{id}` | Tasks page |
| **An opportunity** | RAPID_FLOW | `opportunities/{id}` | Pipeline views |
| **A comp grid** | PRODASH_MATRIX -> Comp tabs | `comp_grids/{type}/{id}` | CAM -> Comp Grids |
| **Book of Business** | A column on the Clients tab | `client.book_of_business` field | Contacts grid filter |
| **Active Client File (ACF)** | A Google Drive folder link in a cell | `client.gdrive_folder_url` field | ACF icon on contacts grid |
| **Org structure** | RAPID_MATRIX -> Org tab | `org/{unitId}` | Admin Panel -> Org Chart |
| **A tracker item (FORGE)** | Didn't exist in Sheets | `tracker_items/{id}` + `sprints/{id}` | FORGE (the copper bug-report button) |
| **An activity log entry** | Didn't exist in Sheets | `activities/{id}` | Audit trail in Contact Detail |

### Access Control Translation

| Sheets World | Firestore World | Who |
|---|---|---|
| Sheet protection: "Only Josh and John can edit" | `isExecutiveOrAbove()` rule | Owner + Executive level users |
| Sheet protection: "Leaders can edit" | `isLeaderOrAbove()` rule | Owner + Executive + Leader level |
| Sheet sharing: "Anyone at RPI can view" | `isRPIUser()` rule | Any @retireprotected.com user |
| Tab hidden from view | Module permission in user profile | User doesn't see the sidebar item at all |

---

## Section 7: Common Operations Translated

| What You Want To Do | Sheets Way | toMachina Way |
|---|---|---|
| **Find a client** | Ctrl+F on the Clients tab | Search bar on `/contacts` or global search |
| **Add a new client** | Type in a new row at the bottom | Quick Intake button or `/intake` page |
| **Update a client field** | Click the cell, type, press Enter | Click the field on Contact Detail, edit, click Save |
| **See all accounts for a client** | Filter Accounts tab by client_id | Click the client -> Accounts tab (they're right there, no filtering needed) |
| **See communication history** | Check RAPID_COMMS logs (good luck) | Click the client -> Communications tab, or open CommsModule |
| **Run a report** | Pivot table or custom GAS function | Command Center / CAM Dashboard / ATLAS |
| **Send a campaign** | C3 GAS engine (pray it doesn't timeout) | C3 Manager -> select audience -> schedule send |
| **Send a text/email** | RAPID_COMMS (or GHL) | Communications Module -> compose -> send |
| **Check who has access** | Look at Sheet sharing settings | Admin Panel -> Team Config |
| **Change someone's permissions** | Edit Sheet protection | Admin Panel -> edit user -> set level + module permissions |
| **Import data** | RAPID_IMPORT (GAS triggers, manual runs) | Import API route or intake Cloud Functions (automatic) |
| **See pipeline status** | Check the pipeline tab, count rows per stage | Pipeline Kanban board (drag cards between columns) |
| **Build a new pipeline** | Create a new tab, add columns, pray | Pipeline Studio (visual builder, point and click) |
| **Track a bug or feature request** | Tell Josh on Slack, hope he remembers | Click the copper FORGE button -> describe it -> submit |
| **See what data sources exist** | Ask Josh, or dig through RAPID_IMPORT | ATLAS Registry (every source listed with status) |
| **Check commission analytics** | Pivot table on Revenue tab | CAM Dashboard (charts, grids, drill-down) |
| **Export data** | Download tab as CSV | Export button on any grid (coming) or BigQuery |

---

## Section 8: Glossary

Quick reference. Alphabetical. Ctrl+F friendly.

| Term | What It Actually Means |
|---|---|
| **API** | The middleman between the portal (what you see) and the database (where data lives). Like RAPID_API but faster and on Cloud Run. |
| **App** | A standalone tool with its own brand identity. Looks the same in every portal. Examples: FORGE, Pipeline Studio, ATLAS, C3. |
| **Auth** | Authentication -- proving you are who you say you are. You sign in with your @retireprotected.com Google account. |
| **Batch write** | Updating many records at once. Like selecting 500 rows in Sheets and changing a column value, but the system does it in one atomic operation. |
| **BigQuery** | Google's analytics database. Same one you already know. Data flows from Firestore to BigQuery automatically now. |
| **Build** | Converting the code into something the browser/server can run. Like compiling. You don't need to know more than that. |
| **CI** | Continuous Integration. Automated checks that run every time code is pushed. If any check fails, the code doesn't deploy. It's the bouncer at the door. |
| **Cloud Function** | A trigger that fires automatically when something happens. Like a GAS `onEdit` trigger, but for Firestore or file uploads. |
| **Cloud Run** | A server that runs our API. Like a GAS web app but it doesn't time out, doesn't have user limits, and scales automatically. |
| **Collection** | A group of similar records. Like a Sheet tab. `clients` is a collection. `users` is a collection. |
| **Commit** | Saving a snapshot of code changes. Like hitting "Save" but it also records WHO changed WHAT and WHEN. |
| **Component** | A reusable UI building block. A button, a table, a form, a card. Built once, used across all portals. |
| **Deploy** | Pushing code to production so users can see the changes. In toMachina, push to `main` branch and it auto-deploys. |
| **Document** | One record in Firestore. Like one row in a Sheet. A client document, a user document, an account document. |
| **Entitlements** | What a logged-in user is allowed to DO. Not just "can they get in" but "can they see the Admin panel? Can they edit comp grids?" |
| **Env var** | Environment variable. A secret value (like an API key) stored securely on the server, not in the code. Like Script Properties in GAS. |
| **Field** | One piece of data on a document. Like a column. `first_name`, `phone`, `status` are all fields. |
| **Firestore** | Google's NoSQL database. The new MATRIX. Faster, scales infinitely, supports real-time updates. |
| **FK (Foreign Key)** | A field that points to a record in another collection. Like a `client_id` column in the Accounts tab that points back to the Clients tab. |
| **Hook** | A rule that runs automatically. Hookify enforces coding standards. Think of it as the immune system checking for infections before code ships. |
| **Module** | A feature area inside a portal. Takes on the portal's brand colors. Examples: Communications, Admin, MyRPI, RPI Connect. |
| **Monorepo** | One repository (code storage) for the entire platform. All 3 portals, all packages, all services -- one place. |
| **Next.js** | The framework that builds the portal websites. It's what makes ProDashX, RIIMO, and SENTINEL actual web applications instead of spreadsheets. |
| **Package** | A shared code library used by multiple apps. `packages/core` = business logic. `packages/ui` = shared components. `packages/auth` = login system. |
| **PR (Pull Request)** | A request to review code before it goes to production. Someone proposes changes, someone else approves, then it merges. |
| **Push** | Sending committed code to the remote repository (GitHub). When you push to `main`, it triggers auto-deploy. |
| **Query** | A filter + sort on a collection. "Give me all clients where status = Active, sorted by last_name." Same as a filter view on a Sheet tab. |
| **React** | The UI library that builds the interactive screens. It's what makes buttons click, forms submit, and data tables sort. |
| **Route** | A URL path that shows a specific page. `/contacts` is a route. `/admin` is a route. `/modules/forge` is a route. Each route = one screen. |
| **Subcollection** | A collection that lives INSIDE a document. Accounts live inside clients. Communications live inside clients. Like a tab nested inside a row. |
| **Toast** | A brief popup message. "Saved successfully!" or "Error: phone number required." Shows for 3-5 seconds and disappears. |
| **Turborepo** | The tool that manages the monorepo. Makes sure packages build in the right order. You never interact with it directly. |
| **Type-check** | Automated verification that all the code is correct -- variables match their expected types, functions receive the right inputs. Like spell-check but for code. Must pass 13/13 workspaces before deploy. |
| **TypeScript** | JavaScript with type-checking. It catches errors before the code runs instead of after. Every file in toMachina is TypeScript. |
| **UUID** | Universally Unique Identifier. A random string like `f47ac10b-58cc-4372-a567-0e02b2c3d479` that identifies a record. Unlike row numbers, UUIDs never change even if you sort, filter, or delete other records. |
| **Worktree** | An isolated copy of the codebase for building features without affecting the main code. Like making a copy of a Sheet to test changes before applying them to the real one. |

---

## Quick Reference Card

**When someone says...** -> **They mean...**

| They Say | They Mean |
|---|---|
| "Check the collection" | Look at the Firestore equivalent of a Sheet tab |
| "That document is missing a field" | A record is missing data in one column |
| "The query is slow" | The filter view takes too long to load |
| "The API returned an error" | The middleman between the screen and the database choked |
| "The build failed" | The code has an error and can't deploy -- nothing is broken in production |
| "CI is red" | The automated checks found a problem -- deploy is blocked until it's fixed |
| "Push to main" | Send the code to production (auto-deploys) |
| "The component re-renders" | A piece of the screen refreshes/redraws (usually a performance conversation) |
| "That's a subcollection" | That data lives inside another record (like accounts inside a client) |
| "Add a route" | Create a new page/screen at a new URL |
| "Wire it up" | Connect the UI to real data (replace mock/fake data with actual database calls) |
| "Seed the database" | Load initial data into Firestore (like pre-filling a Sheet with starter rows) |
| "The bridge is off" | Sheets are no longer receiving copies of Firestore changes |
| "Spawn a builder" | Launch a parallel agent to work on a specific piece of the build |

---

*This guide is for JDM. If you're an engineer, you already know this stuff. Go read CLAUDE.md.*

*#RunningOurOwnRACE*
