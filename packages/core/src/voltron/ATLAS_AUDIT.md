# ATLAS → VOLTRON Interface Mirror Audit

> **TRK-13791** | Sprint 002 — VOLTRON Action Engine v2
> **Date:** 2026-03-28 | **Auditor:** RONIN Builder Agent

---

## 1. Purpose

This document maps every ATLAS type to its VOLTRON counterpart, validates the current
`packages/core/src/voltron/types.ts` structure against ATLAS patterns, documents all
divergences with rationale, and provides recommendations for TRK-13792.

---

## 2. Type-by-Type Mapping

### 2.1 Enumerations & Unions

| ATLAS Type | VOLTRON Counterpart | Status | Notes |
|---|---|---|---|
| `ToolType` (`FUNCTION \| MCP_TOOL \| API_ENDPOINT \| LAUNCHD \| SCRIPT`) | `VoltronToolSource` (`API_ROUTE \| MCP \| VOLTRON \| FIRESTORE`) | **DIVERGED** | ATLAS classifies by execution mechanism; VOLTRON classifies by origin/source. Correct — VOLTRON tools are always functions; their *source* matters for registry generation. |
| `ToolCategory` (6 pipeline categories) | `VoltronToolType` (`ATOMIC \| SUPER \| WIRE`) | **DIVERGED** | ATLAS categories are pipeline-specific (INTAKE_QUEUING, etc.); VOLTRON uses a 3-tier hierarchy. Correct — VOLTRON's domain is orchestration tiers, not pipeline stages. |
| `StageType` (10 values) | No direct counterpart | **INTENTIONAL OMIT** | ATLAS stages span external systems (GAS_FUNCTION, MATRIX_TAB, LAUNCHD). VOLTRON stages are always super tool invocations — no need for stage-type classification. |
| `RegistryEntryType` (`TOOL \| SUPER_TOOL \| WIRE`) | `VoltronToolType` (`ATOMIC \| SUPER \| WIRE`) | **ALIGNED** | Same 3-tier concept. ATLAS says `TOOL`, VOLTRON says `ATOMIC` — clearer naming. |
| `GapStatus`, `HealthStatus` | No counterpart | **INTENTIONAL OMIT** | Health monitoring is ATLAS-domain (data freshness). VOLTRON has no equivalent concern. |
| `SourceMethod`, `SourceFrequency` | No counterpart | **INTENTIONAL OMIT** | Data ingestion metadata. Not applicable to client-facing action execution. |
| `AutomationType` | No counterpart | **INTENTIONAL OMIT** | ATLAS automation scheduling (launchd, GAS triggers). VOLTRON execution is on-demand. |
| — | `VoltronUserRole` (5 roles) | **VOLTRON-ONLY** | ATLAS has no role/entitlement system. VOLTRON requires per-role access control. |
| — | `VoltronToolSource` (4 sources) | **VOLTRON-ONLY** | Registry generation needs to know where each tool originated. |

### 2.2 Atomic/Tool-Level Types

| ATLAS Type | VOLTRON Counterpart | Status | Divergence Rationale |
|---|---|---|---|
| `AtlasTool` | No direct counterpart | **INTENTIONAL OMIT** | AtlasTool has pipeline-specific fields (source_project, run_target, product_lines). VOLTRON tools are defined by `VoltronRegistryEntry` instead. |
| `AtomicToolDefinition` | `VoltronRegistryEntry` (for ATOMIC type) | **RESTRUCTURED** | ATLAS separates definition from registry. VOLTRON unifies them — every tool IS a registry entry. Correct for auto-generated registry. |
| `AtomicToolResult<T>` | `VoltronToolResult<T>` | **DIVERGED** | See §3.1 below. |

### 2.3 Super Tool Types

| ATLAS Type | VOLTRON Counterpart | Status | Divergence Rationale |
|---|---|---|---|
| `SuperToolDefinition` | `VoltronSuperToolDefinition` | **ALIGNED** | Same shape: id, name, description, tools[]. VOLTRON adds `entitlement_min` for role gating. |
| `SuperToolContext` | `VoltronContext` | **DIVERGED** | See §3.2 below. |
| `SuperToolResult<T>` | `VoltronSuperResult<T>` | **DIVERGED** | See §3.3 below. |

### 2.4 Wire Types

| ATLAS Type | VOLTRON Counterpart | Status | Divergence Rationale |
|---|---|---|---|
| `WireDefinition` (v1) | — | **SUPERSEDED** | Legacy ATLAS wire def with raw stages. Replaced by V2 in both systems. |
| `WireDefinitionV2` | `VoltronWireDefinition` | **DIVERGED** | See §3.4 below. |
| `WireStage` | No counterpart | **INTENTIONAL OMIT** | ATLAS WireStage maps to external system types. VOLTRON stages are super tool IDs. |
| `WireInput` (wire-executor) | `VoltronWireInput` | **DIVERGED** | See §3.5 below. |
| `WireContext` (wire-executor) | `VoltronContext` | **DIVERGED** | See §3.2 below. |
| `StageResult` (wire-executor) | `VoltronStageResult` | **DIVERGED** | See §3.6 below. |
| `WireResult` (wire-executor) | `VoltronWireResult` | **DIVERGED** | See §3.7 below. |

### 2.5 Format Library & Introspection

| ATLAS Type | VOLTRON Counterpart | Status | Notes |
|---|---|---|---|
| `AtlasFormat` | No counterpart | **INTENTIONAL OMIT** | CSV format fingerprinting is ATLAS-domain (data ingestion). |
| `IntrospectRun` | No counterpart | **INTENTIONAL OMIT** | Column profiling is ATLAS-domain. |
| `ColumnMapping` | No counterpart | **INTENTIONAL OMIT** | Used by ATLAS super tools for CSV→Firestore mapping. |
| `FieldProfile` | No counterpart | **INTENTIONAL OMIT** | Statistical profiling of data columns. |

### 2.6 Registry Types

| ATLAS Type | VOLTRON Counterpart | Status | Divergence Rationale |
|---|---|---|---|
| `RegistryEntry` (id, type, name, description) | `VoltronRegistryEntry` (10 fields) | **EXTENDED** | ATLAS registry is minimal (4 fields). VOLTRON adds: source, entitlement_min, parameters (JSON Schema), server_only flag, generated_at timestamp. Required for auto-generated registry with role filtering. |

### 2.7 VOLTRON-Only Types (No ATLAS Counterpart)

| VOLTRON Type | Purpose |
|---|---|
| `VoltronUserRole` | 5-tier role hierarchy for entitlement gating |
| `VOLTRON_ROLE_RANK` | Numeric rank for comparison operators |
| `VOLTRON_ROLE_TYPE_ACCESS` | Role → allowed tool type matrix |
| `isToolTypeAllowed()` | Runtime entitlement check function |
| `VoltronArtifact` | Execution output tracking (PDF links, Drive files) |
| `VoltronSuperToolExecuteFn` | Typed execute signature for super tool implementations |
| `WireSSEEventType` | Server-Sent Event classification (wire-executor.ts) |
| `WireSSEEvent` | SSE payload for real-time wire progress streaming |
| `WireStatusListener` | Callback type for SSE consumers |
| `ExecuteWireOptions` | Wire execution config (simulate, resume, audit writer) |

---

## 3. Detailed Divergence Analysis

### 3.1 AtomicToolResult\<T\> → VoltronToolResult\<T\>

```
ATLAS AtomicToolResult<T>         VOLTRON VoltronToolResult<T>
─────────────────────────         ──────────────────────────────
success: boolean                  success: boolean           ✓ SAME
data?: T                          data?: T                   ✓ SAME
error?: string                    error?: string             ✓ SAME
processed?: number                —                          REMOVED
passed?: number                   —                          REMOVED
failed?: number                   —                          REMOVED
—                                 metadata?: {               ADDED
                                    duration_ms: number
                                    tool_id: string
                                  }
```

**Rationale:** ATLAS atomic tools process batches (CSV rows) — `processed/passed/failed`
counts are meaningful. VOLTRON atomic tools execute discrete actions (search client, send SMS)
— batch stats don't apply. `metadata` enables per-tool execution timing and audit trail linking.

### 3.2 SuperToolContext → VoltronContext

```
ATLAS SuperToolContext            VOLTRON VoltronContext
──────────────────────            ─────────────────────
triggered_by: string              user_email: string          RENAMED (more specific)
target_collection?: string        —                           REMOVED (not applicable)
column_mappings?: ColumnMapping[] —                           REMOVED (not applicable)
format_id?: string                —                           REMOVED (not applicable)
target_category?: string          —                           REMOVED (not applicable)
existing_records?: Record[]       —                           REMOVED (not applicable)
downloadFile?: Function           —                           REMOVED (server injected)
moveFile?: Function               —                           REMOVED (server injected)
listSubfolders?: Function         —                           REMOVED (server injected)
loadTaxonomy?: Function           —                           REMOVED (server injected)
loadLearning?: Function           —                           REMOVED (server injected)
source_file_id?: string           —                           REMOVED (pipeline state)
client_id?: string                client_id: string           PROMOTED (required)
source?: string                   —                           REMOVED (not applicable)
document_type?: string            —                           REMOVED (not applicable)
acf_subfolder?: string            —                           REMOVED (not applicable)
tmp_dir?: string                  —                           REMOVED (not applicable)
[key: string]: unknown            —                           REMOVED (strict typing)
—                                 user_role: VoltronUserRole  ADDED
—                                 wire_id?: string            ADDED
—                                 entitlement: number         ADDED
```

**Rationale:** ATLAS context is a kitchen-sink bag for pipeline state (file ops, column maps,
taxonomy loaders). VOLTRON context is lean and focused: identity (user_email, user_role),
scope (client_id, wire_id), and authorization (entitlement). The `[key: string]: unknown`
index signature is intentionally removed — VOLTRON enforces strict typing with no escape hatch.

### 3.3 SuperToolResult\<T\> → VoltronSuperResult\<T\>

```
ATLAS SuperToolResult<T>          VOLTRON VoltronSuperResult<T>
────────────────────────          ───────────────────────────────
success: boolean                  success: boolean              ✓ SAME
data?: T                          data?: T                      ✓ SAME
error?: string                    error?: string                ✓ SAME
tool_results?: Record<str, ATR>   tool_results: VTR[]           CHANGED (see below)
stats?: { records_in, out, ... }  stats?: Record<str, unknown>  RELAXED
—                                 duration_ms: number           ADDED
```

**Key change — tool_results:**
- ATLAS: `Record<string, AtomicToolResult>` — keyed by tool name, optional
- VOLTRON: `VoltronToolResult[]` — ordered array, required

**Rationale:** VOLTRON needs ordered execution audit (which tool ran first, timing per tool).
An array preserves execution order. Making it required ensures audit completeness — every
super tool execution MUST report individual tool outcomes. `duration_ms` enables performance
monitoring in the Mode 1 UI.

### 3.4 WireDefinitionV2 → VoltronWireDefinition

```
ATLAS WireDefinitionV2            VOLTRON VoltronWireDefinition
──────────────────────            ─────────────────────────────
wire_id: string                   wire_id: string              ✓ SAME
name: string                      name: string                 ✓ SAME
description: string               description: string          ✓ SAME
product_lines: string[]           —                            REMOVED
data_domains: string[]            —                            REMOVED
super_tools: string[]             super_tools: string[]        ✓ SAME
stages: WireStage[]               —                            REMOVED
—                                 approval_gates?: string[]    ADDED
—                                 entitlement_min: VoltronUserRole  ADDED
```

**Rationale:** ATLAS wire definitions carry data-pipeline metadata (product_lines, data_domains,
legacy stages). VOLTRON wires are action sequences — they don't process data categories.
`approval_gates` is added because VOLTRON wires can pause mid-execution for human approval
(SMS send, irreversible actions). `entitlement_min` gates who can trigger the wire.

### 3.5 WireInput → VoltronWireInput

```
ATLAS WireInput                   VOLTRON VoltronWireInput
───────────────                   ────────────────────────
file_id?: string                  —                            REMOVED
file_ids?: string[]               —                            REMOVED
data?: unknown                    —                            REMOVED
mode: 'document'|'csv'|'commission' —                          REMOVED
—                                 wire_id: string              ADDED
—                                 client_id: string            ADDED
—                                 params: Record<str, unknown> ADDED
—                                 entitlement: number          ADDED
```

**Rationale:** Complete redesign. ATLAS wire input is file-centric (which files to process,
which mode). VOLTRON wire input is action-centric (which client, which wire, what parameters).
`entitlement` is passed for server-side authorization before execution begins.

### 3.6 StageResult → VoltronStageResult

```
ATLAS StageResult                 VOLTRON VoltronStageResult
─────────────────                 ────────────────────────────
stage: string                     stage: string                ✓ SAME
—                                 super_tool_id: string        ADDED
status: 5 values                  status: 6 values             EXTENDED (+approval_pending)
started_at?: string               started_at?: string          ✓ SAME
completed_at?: string             completed_at?: string        ✓ SAME
output?: unknown                  output?: unknown             ✓ SAME
error?: string                    error?: string               ✓ SAME
—                                 approval_gate?: boolean      ADDED
```

**Rationale:** `super_tool_id` links each stage to its orchestrator for audit drill-down.
`approval_pending` status enables wires to pause at human-in-loop gates. `approval_gate`
flag marks which stages require human confirmation before proceeding.

### 3.7 WireResult → VoltronWireResult

```
ATLAS WireResult                  VOLTRON VoltronWireResult
────────────────                  ─────────────────────────
success: boolean                  —                            REMOVED (status is richer)
wire_id: string                   wire_id: string              ✓ SAME
execution_id: string              execution_id: string         ✓ SAME
stages: StageResult[]             stage_results: VStageResult[]  RENAMED
created_records: Array<...>       —                            REMOVED (not applicable)
execution_time_ms: number         —                            REMOVED (derivable from timestamps)
status: 3 values                  status: 4 values             EXTENDED (+simulated)
approval_batch_id?: string        —                            REMOVED (per-stage gates instead)
—                                 user_email: string           ADDED
—                                 client_id: string            ADDED
—                                 started_at: string           ADDED
—                                 completed_at: string         ADDED
—                                 artifacts: VoltronArtifact[] ADDED
```

**Rationale:** ATLAS WireResult is processing-focused (created_records, execution_time_ms).
VOLTRON WireResult is audit-focused (who ran it, for which client, what was produced).
`artifacts` tracks outputs (generated PDFs, filed documents). `simulated` status enables
dry-run mode. Per-stage approval gates replace the single `approval_batch_id`.

---

## 4. types.ts Structure Validation

### Current State: ✅ VALID

| Check | Result |
|---|---|
| All 5 core interfaces present (VoltronToolResult, VoltronSuperResult, VoltronContext, VoltronWireInput, VoltronWireResult) | ✅ |
| No `any` type usage | ✅ |
| All types properly exported | ✅ |
| JSDoc on all public interfaces | ✅ |
| Generic type parameter `<T = unknown>` (not `any`) | ✅ |
| Role rank constant + access matrix defined | ✅ |
| Runtime entitlement check function present | ✅ |
| VoltronSuperToolExecuteFn signature typed | ✅ |
| VoltronRegistryEntry fully specified (10 fields) | ✅ |
| VoltronArtifact defined for wire outputs | ✅ |

### File Organization

```
types.ts (183 lines)
├── Role & Classification (lines 6-19)
│   ├── VoltronUserRole
│   ├── VOLTRON_ROLE_RANK
│   ├── VoltronToolType
│   └── VoltronToolSource
├── Entitlement Matrix (lines 21-45)
│   ├── VOLTRON_ROLE_TYPE_ACCESS
│   └── isToolTypeAllowed()
├── Tool Results (lines 47-75)
│   ├── VoltronToolResult<T>
│   └── VoltronSuperResult<T>
├── Context & Input (lines 77-100)
│   ├── VoltronContext
│   └── VoltronWireInput
├── Wire Execution (lines 102-138)
│   ├── VoltronStageResult
│   ├── VoltronWireResult
│   └── VoltronArtifact
├── Registry (lines 140-153)
│   └── VoltronRegistryEntry
├── Definitions (lines 155-174)
│   ├── VoltronSuperToolDefinition
│   └── VoltronWireDefinition
└── Execute Signature (lines 176-182)
    └── VoltronSuperToolExecuteFn
```

---

## 5. Recommendations for TRK-13792

1. **No structural changes needed to types.ts** — all required interfaces are present, correctly
   typed, and properly exported. The file is clean and well-organized.

2. **Barrel export verification** — Ensure `packages/core/src/voltron/index.ts` re-exports ALL
   types from `types.ts`. Currently needed: all interfaces, type aliases, constants, and the
   `isToolTypeAllowed` function.

3. **Wire executor types stay in wire-executor.ts** — The SSE types (`WireSSEEvent`,
   `WireSSEEventType`, `WireStatusListener`, `ExecuteWireOptions`) correctly live in
   `wire-executor.ts` rather than `types.ts` since they're execution-layer concerns, not
   domain types.

4. **Zero `any` enforcement** — Current types.ts uses `unknown` everywhere instead of `any`.
   TRK-13792 should maintain this discipline and add a lint rule if not already present.

5. **Consider adding VoltronAtomicToolDefinition** — Currently atomic tools are only represented
   via `VoltronRegistryEntry`. If TRK-13796 (Atomic Tools) needs a definition type distinct
   from registry entries, add it in TRK-13792. Shape suggestion:
   ```typescript
   export interface VoltronAtomicToolDefinition {
     tool_id: string
     name: string
     description: string
     source: VoltronToolSource
     entitlement_min: VoltronUserRole
     server_only: boolean
     execute: (params: Record<string, unknown>, context: VoltronContext) => Promise<VoltronToolResult>
   }
   ```

---

## 6. Summary

| Metric | Count |
|---|---|
| ATLAS types audited | 22 (types, interfaces, enums) |
| VOLTRON counterparts mapped | 12 direct mappings |
| Intentional omissions (ATLAS-only) | 10 (pipeline/ingestion-specific) |
| VOLTRON-only additions | 10 (role system, SSE, artifacts) |
| Divergences documented with rationale | 7 detailed analyses (§3.1–§3.7) |
| types.ts validation checks passed | 10/10 |

**Overall assessment:** VOLTRON types correctly mirror the ATLAS atomic → super → wire
orchestration pattern while diverging appropriately for client-facing action execution.
All divergences are intentional, documented, and architecturally sound.
