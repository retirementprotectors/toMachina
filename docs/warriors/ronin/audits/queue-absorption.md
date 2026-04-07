# RONIN Queue Absorption — ZRD-D13

> Generated: 2026-04-05 | Track: MEGAZORD DEVOUR | Author: RONIN

## Summary

ZRD-D13 establishes the process for absorbing data-centric tickets from RONIN (RON-) and RAIDEN (RDN-) queues into the MEGAZORD (ZRD-) pipeline.

| Metric | Value |
|--------|-------|
| Data-centric keywords scanned | import, data, carrier, commission, ACF, cleanup, audit, format, normalize, dedup |
| Queue sources | `dojo_tickets` Firestore collection |
| Target prefix | ZRD- (assigned to MEGAZORD pipeline) |
| Non-data tickets | Left in place (RON-/RDN- for code/UX work) |

## Absorption Criteria

A ticket is classified as **data-centric** if its title or description contains any of:
- `import`, `data`, `carrier`, `commission`, `ACF`, `cleanup`
- `audit` (data audit, not code audit), `format`, `normalize`, `dedup`
- `pipeline`, `source`, `registry`, `wire`, `ranger`
- `revenue`, `account sync`, `client sync`

## Process

1. Query `dojo_tickets` collection for all RON- and RDN- prefixed tickets
2. Filter by data-centric keywords in `title` + `description` fields
3. Reclassify matching tickets: update `ticket_id` prefix to ZRD-, set `assigned_to: 'megazord'`
4. Leave non-data tickets untouched
5. Generate absorption report

## Script Location

The absorption is implemented as a runtime API operation:
- `POST /api/atlas/absorb-queue` — scans and reclassifies tickets
- Can be triggered manually or via scheduled run

## Expected Outcome

After absorption:
- Zero data-centric tickets in RON-/RDN- queues
- All data work flows through MEGAZORD's pipeline
- RONIN focuses on code/feature work
- RAIDEN focuses on bug fixes/UX work

## Note

This ticket documents the **process and criteria** for queue absorption. The actual absorption requires live Firestore access and should be executed in a production session, not in an isolated worktree build. The API endpoint and logic are ready for when DEVOUR goes live.
