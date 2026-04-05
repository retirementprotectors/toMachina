# {{TITLE}} — Discovery Doc

> **CXO:** MEGAZORD (CIO) | **Track:** {{TRACK}} | **Authored:** {{DATE}}
> **Prefix:** ZRD-{{TRACK_CODE}}-### | **Color:** #10b981 (mecha-green)

---

## Tab 1: Vision

### Problem Statement
{{What data gap, integration failure, or manual process does this solve?}}

### Success Criteria
{{What does "done" look like? Measurable outcomes.}}

### ATLAS Context
- **Source Registry:** {{Which sources are affected? List source_ids from ATLAS.}}
- **Wire Dependency:** {{Which existing wires are involved? WIRE_DATA_IMPORT, WIRE_ACF_CLEANUP, etc.}}
- **Tool Coverage:** {{Which atomic tools exist vs. need building?}}

---

## Tab 2: Architecture

### System Design
{{How does this fit into The Machine's existing architecture?}}

### Data Flow
```
{{Source}} → {{Wire/Ranger}} → {{Collection}} → {{Portal View}}
```

### Dependencies
| Dependency | Status | Blocker? |
|-----------|--------|----------|
| {{dep}} | {{exists/needed}} | {{yes/no}} |

---

## Tab 3: Tickets

### Phase 1: {{Phase Name}}
| ID | Title | Effort | Description |
|----|-------|--------|-------------|
| ZRD-{{TRACK_CODE}}-01 | {{title}} | {{S/M/L}} | {{description}} |

### Phase 2: {{Phase Name}}
| ID | Title | Effort | Description |
|----|-------|--------|-------------|

### Phase 3: {{Phase Name}}
| ID | Title | Effort | Description |
|----|-------|--------|-------------|

---

## Tab 4: Acceptance Criteria

### Per-Ticket AC
{{Each ticket ID → bullet list of acceptance criteria}}

### Definition of Done — Track Gate
- [ ] All tickets completed
- [ ] `npm run type-check` passes (13/13)
- [ ] `npm run build` passes (11/11)
- [ ] E2E tests pass
- [ ] Command Center updated
- [ ] Wire audit clean

---

## Tab 5: Test Plan

### Unit Tests
{{Which functions need unit test coverage?}}

### E2E Tests
{{Which wires/Rangers need E2E test files?}}

### Manual Verification
{{What requires human review before shipping?}}

---

## Tab 6: Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| {{risk}} | {{high/med/low}} | {{mitigation}} |

---

## Tab 7: Timeline

| Phase | Tickets | Parallel? | Est. |
|-------|---------|-----------|------|
| P1 | {{ids}} | {{yes/no}} | {{effort}} |
| P2 | {{ids}} | {{yes/no}} | {{effort}} |
| P3 | {{ids}} | {{yes/no}} | {{effort}} |

---

## Tab 8: References

- ATLAS Wire Definitions: `packages/core/src/atlas/wires.ts`
- Source Registry: Firestore `source_registry`
- Tool Registry: Firestore `tool_registry`
- Existing Rangers: `services/api/src/rangers/`
- Wire Edge Cases: `docs/wire-edge-cases.md`
