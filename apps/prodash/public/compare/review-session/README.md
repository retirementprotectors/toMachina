# JDM Review Session — Visual Reference

**Date:** 2026-03-12 19:23 CDT
**Duration:** 1hr 44min
**Source Video:** `~/Downloads/zsj-pcte-bxu (2026-03-12 19_23 GMT-5).mp4`
**Transcript:** `~/Projects/toMachina/.claude/sprint7/` + `~/Downloads/Meeting started 2026_03_12 19_23 CDT - Notes by Gemini.md`
**Fix Prompt:** `~/Projects/toMachina/.claude/sprint7/DESIGN_FIXES_29.md`

## Frame Map

Each frame shows the toMachina dev server (LEFT) vs GAS original (RIGHT) side-by-side, with JDM's face cam. These are the EXACT screens JDM was looking at when he gave each piece of feedback.

| Frame | Timestamp | What JDM Was Reviewing | Related Fixes |
|-------|-----------|----------------------|---------------|
| 01-sidebar-comparison.jpg | ~00:04:10 | Sidebar + clients grid side-by-side | #1 Logo, #2 Switcher, #3 Order, #4 Rename |
| 02-myrpi-comparison.jpg | ~00:05:23 | My RPI profile side-by-side | #25 Connect logo, #26 Admin styling |
| 03-sidebar-collapsed.jpg | ~00:09:56 | Sidebar sections collapsed, apps visible | #3 Order, #27 Apps reorder |
| 04-client360-connect.jpg | ~00:20:27 | Client 360 Connect tab side-by-side | #9 Collapsed, #11 Inline edit, #12 DND |
| 05-personal-tab.jpg | ~00:29:46 | Personal tab with inline editing | #14 Dates, #15 Age, #16 Former Occ |
| 06-accounts-tab.jpg | ~00:35:30 | Accounts tab with type grouping | #18 Policy number, #19 Click=navigate |
| 07-date-formats.jpg | ~00:43:59 | Date format comparisons | #14 Date formats (CRITICAL) |
| 08-account-detail.jpg | ~00:48:49 | Account detail page | #10 Button styling, #19 Navigation |
| 09-access-button-idea.jpg | ~00:57:56 | Where Access button should go (NEW IDEA) | Sprint 8: Access Center |
| 10-admin-section.jpg | ~01:14:41 | Admin module config | #28 Click to expand, #29 Team Config |
| 11-ddup-review.jpg | ~01:18:32 | Ddup comparison view | Sprint 8: Ddup Overhaul |
| 12-account-grid-controls.jpg | ~01:30:31 | Account grid with column selector | #7 Column selector, #23 New buttons |
| 13-rpi-connect-admin.jpg | ~01:36:11 | RPI Connect and Admin buttons | #25 Connect logo, #26 Admin logo |

## How to Use This

**Builders:** Before writing ANY UI code, look at the frame that corresponds to the page you're building. The GAS version (RIGHT side of each frame) is the visual target. The toMachina version (LEFT side) is what needs to be fixed.

**Auditors:** Compare the builder's output against these frames. If it doesn't match the RIGHT side's visual quality, it fails.

## Full Frame Archive

All 1,248 frames (one every 5 seconds) are at `/tmp/review-session-frames/`. Frame number × 5 = seconds into the video.
