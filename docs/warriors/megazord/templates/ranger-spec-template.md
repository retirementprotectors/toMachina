# Ranger Spec: {{RANGER_ID}}

> **Ranger Name:** {{RANGER_NAME}}
> **Wire Binding:** {{WIRE_ID}}
> **Author:** MEGAZORD (CIO) | **Date:** {{DATE}}

---

## Configuration

```typescript
const {{RANGER_CONST}}: RangerConfig = {
  rangerId: '{{RANGER_ID}}',
  wireId: '{{WIRE_ID}}',
  systemPrompt: '{{SYSTEM_PROMPT}}',
  superTools: [{{SUPER_TOOLS}}],
  model: '{{haiku|sonnet}}',
  maxRetries: {{MAX_RETRIES}},
}
```

---

## Wire Binding

| Property | Value |
|----------|-------|
| Wire ID | `{{WIRE_ID}}` |
| Stages | {{STAGE_COUNT}} |
| Super Tools | {{SUPER_TOOL_LIST}} |
| Server-Only? | {{yes/no}} |
| Model | {{haiku/sonnet}} |
| Why this model? | {{reason — haiku for deterministic, sonnet for Vision}} |

---

## System Prompt

```
{{FULL_SYSTEM_PROMPT}}
```

**Why this prompt matters:** Rangers are deterministic — the wire IS the task list. The system prompt exists only for audit trail context and error message clarity. It should describe WHAT this Ranger does, not HOW (the wire handles HOW).

---

## Dispatch Parameters

```typescript
interface {{RangerId}}DispatchInput {
  fileId?: string        // Drive file ID to process
  fileIds?: string[]     // Multiple files
  mode: '{{csv|document|commission}}'
  targetCategory?: string
  clientId?: string
  params?: {
    {{additional_params}}
  }
}
```

---

## Expected Behavior

### Happy Path
1. Dispatch with {{typical input}}
2. {{STAGE_1}} completes in ~{{time}}
3. {{STAGE_2}} completes in ~{{time}}
4. ...
5. Final output: {{records_created}} records, {{execution_time}} total

### Error Handling
| Stage | Error Type | Behavior |
|-------|-----------|----------|
| {{STAGE}} | {{error type}} | Halt (no silent continuation) |
| {{STAGE}} | Retry-eligible | Retry up to {{maxRetries}} times |

### Cancel Behavior
- Cancel flag checked between each stage
- Current stage completes before halt
- Status set to `cancelled` in Firestore

---

## File Path

```
services/api/src/rangers/{{RANGER_FILE}}.ts
```

---

## Test Plan

- [ ] `createRanger()` returns callable executor
- [ ] Dispatch with test data — all stages complete
- [ ] Error in stage {{N}} halts pipeline
- [ ] Result persisted to `ranger_runs` with accurate step data
- [ ] Cancel mid-execution halts at next stage boundary
