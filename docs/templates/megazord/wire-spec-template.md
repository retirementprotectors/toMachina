# Wire Spec: {{WIRE_ID}}

> **Wire Name:** {{WIRE_NAME}}
> **Author:** MEGAZORD (CIO) | **Date:** {{DATE}}
> **Status:** Draft → Review → Approved → Deployed

---

## Overview

**Purpose:** {{What does this wire accomplish?}}
**Trigger:** {{How is this wire initiated? (Drive folder, email, manual, scheduled)}}
**Target Collections:** {{Which Firestore collections are written to?}}

---

## Wire Definition

```typescript
{
  wire_id: '{{WIRE_ID}}',
  name: '{{WIRE_NAME}}',
  description: '{{DESCRIPTION}}',
  product_lines: [{{PRODUCT_LINES}}],
  data_domains: [{{DATA_DOMAINS}}],
  super_tools: [
    {{SUPER_TOOL_SEQUENCE}}
  ],
}
```

---

## Super Tool Sequence

| # | Super Tool | Input | Output | Notes |
|---|-----------|-------|--------|-------|
| 1 | {{SUPER_TOOL_ID}} | {{input shape}} | {{output shape}} | {{notes}} |

---

## Input Schema

```typescript
interface {{WireId}}Input {
  file_id?: string
  file_ids?: string[]
  mode: '{{csv|document|commission}}'
  {{additional_fields}}
}
```

---

## Output Schema

```typescript
interface {{WireId}}Output {
  records_processed: number
  records_created: number
  records_updated: number
  records_skipped: number
  records_failed: number
  {{additional_fields}}
}
```

---

## Test Fixtures

### Happy Path
- **Input:** {{description of test data}}
- **Expected:** {{expected outcome}}

### Edge Cases
| Case | Input | Expected |
|------|-------|----------|
| Empty file | 0 rows | Graceful exit, 0 records |
| Duplicate rows | 10 identical rows | 1 created, 9 deduped |
| Missing required fields | Row without name | Rejected in SUPER_VALIDATE |

---

## ATLAS Integration

- **Source Registry Entry:** {{source_id if applicable}}
- **Tool Registry Entries:** {{list atomic tools used}}
- **Gap Status Impact:** {{Which sources move from RED/YELLOW to GREEN?}}

---

## RONIN Execution Notes

This spec is designed for autonomous execution by RONIN. No ambiguity.
- File paths are absolute
- Types are fully defined
- Test fixtures have concrete data
- Acceptance criteria are binary (pass/fail)
