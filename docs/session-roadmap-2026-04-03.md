# Session Roadmap — 2026-04-03
## Updated: 2:00 PM CDT

---

## DO RIGHT NOW

- [ ] **Push PRs to main** — #228 (Learning Loop), #230 (Comms v2), #231 (Clients/Contacts)
- [ ] **Post shipped features to #the-dojo** — team doesn't know about the 8 PRs on main
- [ ] **/q filter buttons** — big filter, sub-filter, back button, clean ticket language
- [ ] **Clean up /q ticket titles** — 353 items need human-readable descriptions, not raw IDs
- [ ] **Read emails** — SERFF (CSG/Brian Welch), Twilio rejection, WhitePages PM

## DELEGATE TODAY

- [ ] **SERFF data ingest** — VOLTRON + Medicare specialist, BigQuery schema exists
- [ ] **Twilio response** — 4th rejection, figure out what they need this time
- [ ] **WhitePages PM email** — review and respond
- [ ] **Dojo channel comms** — dispatcher should auto-post Fix/Feature/File completions to #the-dojo
- [ ] **Dojo App ticket movement** — shipped PRs must advance their tickets through RAIDEN/RONIN pipelines (RDN-deploy → RDN-reported, etc.) — this should be automatic via git monitor
- [ ] **Dispatcher comms audit** — what IS it communicating vs what SHOULD it be? Warriors report their own completions to war room, dispatcher relays to #the-dojo
- [ ] **Dedup engine for Nikki** — wire SUPER_MATCH to a UI (not a spreadsheet), delegation by type (clients vs accounts vs orphans)

## SCOPED — READY FOR RONIN

| # | Discovery Doc | Status | Priority |
|---|---|---|---|
| 1 | Field Parity (Sprint 014) | SCOPED 98KB | HIGH — Nikki can't see 100+ fields |
| 2 | Trinity ACF Wire | SCOPED 39KB | HIGH — third pillar foundation |
| 3 | Trinity Third Pillar | SCOPED 43KB | HIGH — ACF grid + detail + dedup |
| 4 | Trinity B2B Product | SCOPED 36KB | MEDIUM — DAVID play |
| 5 | MDJ Infrastructure Master | BUILDING NOW | HIGH — box capabilities |
| 6 | Product Specialists Roadmap | SCOPED 24KB | MEDIUM — Medicare/Securities |
| 7 | CMO Creative Roadmap | SCOPED 28KB | MEDIUM — brochures + MYST |

## BUILT — PENDING MERGE

| PR | What | Blocker |
|---|---|---|
| #228 | Learning Loop 2.0 (12 tickets) | Merge conflict |
| #230 | Communications v2 (9 tickets) | Merge conflict |
| #231 | Clients/Contacts UX (10 tickets) | Merge conflict |

## SHIPPED TODAY (on main)

| PR | What |
|---|---|
| #222 | Dojo 2.0 — VOLTRON tab, RONIN pipelines, RAIDEN stages |
| #223 | Warrior status prefixes (RDN-/RON-/VLT-/INT-) |
| #224 | Tracker API 500 fix |
| #225 | CEO Action Queue (/q + INTAKE) |
| #226 | Team Triage — Delivery pipeline + custom fields + assignee |
| #221 | DELIVERY pipeline + flow-admin auth |
| #229 | Accounts + Service UX (8 tickets) |
| #227 | RAIDEN batch 1 — gates, kit builder, CAM agent |
| + | Tab order fix, auth fix, queue API fix, Firestore Timestamp fix |

## NOT SCOPED — NEEDS DISCOVERY

- [ ] **RONIN Assessment Pipeline** — 20 items sitting in RON-new. Who assesses? When? How do they flow through researching → strategizing → discovery doc? What are the gates?
- [ ] **ProZone tightening for Vince** — what's missing/broken for Vince to go live NEXT WEEK? Audit current state vs what he needs
- [ ] **Retirement Sales Process** — must be airtight for Vince. Full sales funnel: ProZone → activity → opportunities → pipeline stages. What's wired, what's not?
- [ ] **Dedup Engine UI** — wire SUPER_MATCH to a page Nikki can hammer through (not spreadsheet). Side-by-side comparison, merge/dismiss/spouse/check-with-JDM buttons. Delegate by type.
- [ ] **Product Specialist mesh layer — initial phase sprint** — separate from the roadmap doc. What's the FIRST sprint to get Medicare specialist live?
- [ ] **CMO plan — initial phase sprint** — separate from the roadmap doc. What's the FIRST sprint for brochures/MYST?

## COMPLETED OPERATIONS

- [x] ACF Step 1 — 234 renames, 46 merges
- [x] ACF Step 2 — 3,788 subfolders created
- [x] ACF Step 3 — 705 files routed
- [x] ACF Step 4 — verified, found 275 client dupes + 237 account dupes
- [x] Tracker sorted — 694 items into pipelines
- [x] Slack scrape — 43 Nikki/Vince posts → tickets
- [x] 19 already-fixed tickets auto-closed
- [x] RAIDEN queue cleared (0 open)
- [x] Dedup report on Shared Drive for Nikki
- [x] MDJ_SERVER fully wired (Twilio + SendGrid + Gmail 40 scopes + Tailscale on PRO)
- [x] Dispatcher infinite loop fixed
- [x] Competitive intel — 13 articles analyzed
- [x] Trinity Data Method rediscovered + 3 discovery docs

## UX REVIEW QUEUE (JDM)

- [ ] **Dojo 2.0 tabs** — https://prodash.tomachina.com → The Dojo (INTAKE, RAIDEN, RONIN, VOLTRON tabs)
- [ ] **CEO Action Queue** — https://prodash.tomachina.com/q (with filters once built)
- [ ] **Pipeline custom fields** — Create an opportunity, check Life/Annuity/Medicare field sets
- [ ] **Delivery pipeline** — New pipeline with 4 stages (Pending Receipt → Awaiting Appointment → Needs Mailed → Awaiting PDR)
- [ ] **Accounts/Service UX** — Account detail page: income rider card, policy number display, ACF subfolder recursion
- [ ] **Assignee vs Agent** — Create opportunity, verify assignee field is separate from agent
- [ ] **Status prefixes** — RAIDEN tab shows RDN- items only, RONIN shows RON- only
- [ ] **ProZone COMMS** — Auto-dial, call disposition (6 outcomes), power dialer session, MMS attachments
- [ ] **Contacts grid** — Client hover card, column selector, search improvements
- [ ] **Everything built in last week** — full walkthrough of all 8 PRs on main

## DISCOVERY DOCS WRITTEN TODAY (11)

1. CEO Action Queue (16KB)
2. Clients/Contacts UX (41KB)
3. Communications v2 (40KB)
4. Accounts/Service UX (25KB)
5. Field Parity (98KB)
6. Trinity ACF Wire (39KB)
7. Trinity Third Pillar (43KB)
8. Trinity B2B Product (36KB)
9. MDJ Infrastructure Master (building)
10. Competitive Intel (13 articles → war room)
11. Dedup Report (Shared Drive)
