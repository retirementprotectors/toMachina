/**
 * VOL-H06 — Lion Tool Isolation Tests
 *
 * Tests run without a framework (pure Node.js / tsx). Exit 0 = all pass.
 * Run: npx tsx src/__tests__/lion-tool-isolation.test.ts
 *
 * Verifies per-Lion `available_tools` arrays per MUSASHI Discovery Doc
 * (2026-04-14) Section 6 test matrix. For each Lion we assert:
 *   1. In-domain tool resolves (ALLOWED)
 *   2. Cross-domain tool denied (DENIED, unless in baseline)
 *   3. Baseline tool present (ALLOWED)
 *   4. RED-tier tool would hit approval gate (NOT in available_tools)
 *
 * The configs under test are static exports of `@tomachina/core/voltron/lion-configs`.
 * Firestore writes happen in the seed script; this test validates the source-of-truth.
 */

import {
  BASELINE_LION_TOOLS,
  MEDICARE_LION_CONFIG,
  ANNUITY_LION_CONFIG,
  INVESTMENT_LION_CONFIG,
  LIFE_ESTATE_LION_CONFIG,
  LEGACY_LTC_LION_CONFIG,
  ALL_LION_CONFIGS,
} from "@tomachina/core/voltron/lion-configs"

let passed = 0
let failed = 0

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  \u2713 ${message}`)
    passed++
  } else {
    console.error(`  \u2717 FAIL: ${message}`)
    failed++
  }
}

// Tools that MUST NOT appear on ANY Lion (RED tier or admin/ops territory)
const FORBIDDEN_ON_ALL_LIONS = [
  "tm_comms_send_email",
  "tm_comms_send_sms",
  "tm_comms_send_voice",
  "tm_clients_create",
  "tm_clients_update",
  "tm_accounts_create",
  "tm_sprints_create",
  "tm_tracker_create",
  "tm_tracker_update",
  "mcp_workspace_execute_script",
  "mcp_slack_post_message",
  "audit_workspace_users",
  "audit_drive_sharing",
  "wire_offboard_employee",
  "purge_drive_permissions",
  "humana_submit_medicare_enrollment",
]

console.log("\n=== VOL-H06: Lion Tool Isolation ===\n")

// ── Baseline sanity ─────────────────────────────────────────────────────────
console.log("Baseline tools:")
assert(BASELINE_LION_TOOLS.length >= 20, `BASELINE_LION_TOOLS has >= 20 entries (actual: ${BASELINE_LION_TOOLS.length})`)
assert(BASELINE_LION_TOOLS.includes("tm_clients_get"), "baseline includes tm_clients_get")
assert(BASELINE_LION_TOOLS.includes("tm_search_global"), "baseline includes tm_search_global")
assert(!BASELINE_LION_TOOLS.includes("tm_comms_send_email"), "baseline does NOT include tm_comms_send_email")
assert(!BASELINE_LION_TOOLS.includes("tm_clients_update"), "baseline does NOT include tm_clients_update (YELLOW goes through per-Lion decision)")

// ── Per-Lion tests ──────────────────────────────────────────────────────────
const testMatrix = [
  {
    config: MEDICARE_LION_CONFIG,
    label: "mdj-medicare",
    inDomain: "mcp_healthcare_search_plans",
    outDomain: "tm_atlas_wires_list", // Annuity/Investment extras but not Medicare
    baseline: "tm_clients_get",
    redTool: "tm_comms_send_email",
  },
  {
    config: ANNUITY_LION_CONFIG,
    label: "mdj-annuity",
    inDomain: "tm_atlas_wires_list",
    outDomain: "mcp_healthcare_search_codes",
    baseline: "tm_households_meeting_prep",
    redTool: "tm_comms_send_sms",
  },
  {
    config: INVESTMENT_LION_CONFIG,
    label: "mdj-investment",
    inDomain: "tm_atlas_sources_list",
    outDomain: "mcp_healthcare_lookup_npi",
    baseline: "tm_clients_get_accounts",
    redTool: "tm_comms_send_voice",
  },
  {
    config: LIFE_ESTATE_LION_CONFIG,
    label: "mdj-life-estate",
    inDomain: "mcp_gdrive_create_doc",
    outDomain: "mcp_healthcare_lookup_npi",
    baseline: "tm_atlas_health",
    redTool: "tm_comms_send_email",
  },
  {
    config: LEGACY_LTC_LION_CONFIG,
    label: "mdj-legacy-ltc",
    inDomain: "tm_atlas_sources_list",
    outDomain: "mcp_healthcare_lookup_npi",
    baseline: "tm_search_global",
    redTool: "tm_comms_send_voice",
  },
]

for (const t of testMatrix) {
  const tools = t.config.available_tools
  console.log(`\n${t.label} (${tools.length} tools):`)
  assert(tools.length > BASELINE_LION_TOOLS.length, `${t.label}: more tools than baseline (${tools.length} > ${BASELINE_LION_TOOLS.length})`)
  assert(tools.includes(t.inDomain), `${t.label}: ${t.inDomain} is ALLOWED (in-domain)`)
  assert(tools.includes(t.baseline), `${t.label}: ${t.baseline} is ALLOWED (baseline)`)
  // Out-of-domain: only DENIED if NOT in baseline (baseline tools are cross-cutting by design)
  if (BASELINE_LION_TOOLS.includes(t.outDomain as (typeof BASELINE_LION_TOOLS)[number])) {
    assert(tools.includes(t.outDomain), `${t.label}: ${t.outDomain} is in baseline so ALLOWED universally`)
  } else {
    assert(!tools.includes(t.outDomain), `${t.label}: ${t.outDomain} is DENIED (out-of-domain)`)
  }
  assert(!tools.includes(t.redTool), `${t.label}: ${t.redTool} (RED) is NOT available in-Lion — must route through approval`)
}

// ── Universal forbidden tools ───────────────────────────────────────────────
console.log("\nUniversal forbidden (every Lion):")
for (const forbidden of FORBIDDEN_ON_ALL_LIONS) {
  let okAll = true
  for (const c of ALL_LION_CONFIGS) {
    if (c.available_tools.includes(forbidden)) {
      okAll = false
      console.error(`  \u2717 FAIL: ${c.domain} has forbidden tool ${forbidden}`)
    }
  }
  if (okAll) {
    console.log(`  \u2713 ${forbidden} absent from all 5 Lions`)
    passed++
  } else {
    failed++
  }
}

// ── Baseline is subset of every Lion ─────────────────────────────────────────
console.log("\nBaseline subset check:")
for (const c of ALL_LION_CONFIGS) {
  const missing = BASELINE_LION_TOOLS.filter((t) => !c.available_tools.includes(t))
  assert(missing.length === 0, `${c.domain}: every baseline tool is present (${BASELINE_LION_TOOLS.length}/${BASELINE_LION_TOOLS.length})`)
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)
if (failed > 0) {
  process.exit(1)
}
process.exit(0)
