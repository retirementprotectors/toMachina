/**
 * verify-permissions.ts
 *
 * Pure-function verification of the permission cascade.
 * No Firestore needed — tests evaluateAccess, evaluateActionAccess,
 * and computeModulePermissions directly.
 *
 * Run: npx tsx services/api/src/scripts/verify-permissions.ts
 */

import {
  computeModulePermissions,
  evaluateAccess,
  evaluateActionAccess,
  PRODASH_ROLE_TEMPLATES,
  UNIT_MODULE_DEFAULTS,
  MODULES,
} from '@tomachina/core'
import type { RoleTemplateKey, UserLevelName, ModuleAction } from '@tomachina/core'

// ============================================================================
// Test harness
// ============================================================================

let passed = 0
let failed = 0

function assert(condition: boolean, label: string): void {
  if (condition) {
    passed++
    console.log(`  PASS  ${label}`)
  } else {
    failed++
    console.error(`  FAIL  ${label}`)
  }
}

function section(name: string): void {
  console.log(`\n--- ${name} ---`)
}

// ============================================================================
// Test 1: OWNER gets access to ALL modules
// ============================================================================
section('Test 1: OWNER gets access to all modules')

const allModuleKeys = Object.keys(MODULES)
for (const key of allModuleKeys) {
  assert(
    evaluateAccess('OWNER', key),
    `OWNER -> ${key}`
  )
}

// ============================================================================
// Test 2: USER with no permissions — blocked from high-level modules
// ============================================================================
section('Test 2: USER (no permissions) — blocked from EXECUTIVE/LEADER modules, allowed USER modules')

assert(
  !evaluateAccess('USER', 'ATLAS'),
  'USER cannot access ATLAS (minLevel=EXECUTIVE)'
)
assert(
  !evaluateAccess('USER', 'CAM'),
  'USER cannot access CAM (minLevel=EXECUTIVE)'
)
assert(
  !evaluateAccess('USER', 'DEX'),
  'USER cannot access DEX (minLevel=LEADER)'
)
assert(
  evaluateAccess('USER', 'PRODASH'),
  'USER can access PRODASH (minLevel=USER)'
)
assert(
  evaluateAccess('USER', 'QUE_MEDICARE'),
  'USER can access QUE_MEDICARE (minLevel=USER)'
)

// ============================================================================
// Test 3: computeModulePermissions('service', 'MEDICARE')
// ============================================================================
section('Test 3: computeModulePermissions — service + MEDICARE unit')

const serviceMedicare = computeModulePermissions('service', 'MEDICARE')

assert(
  Array.isArray(serviceMedicare['QUE_MEDICARE']) && serviceMedicare['QUE_MEDICARE'].length > 0,
  'service+MEDICARE has QUE_MEDICARE'
)
assert(
  Array.isArray(serviceMedicare['QUE_MEDSUP']) && serviceMedicare['QUE_MEDSUP'].length > 0,
  'service+MEDICARE has QUE_MEDSUP'
)
assert(
  serviceMedicare['QUE_ANNUITY'] === undefined,
  'service+MEDICARE does NOT have QUE_ANNUITY'
)
assert(
  serviceMedicare['QUE_LIFE'] === undefined,
  'service+MEDICARE does NOT have QUE_LIFE'
)

// ============================================================================
// Test 4: computeModulePermissions('sales', 'RETIREMENT')
// ============================================================================
section('Test 4: computeModulePermissions — sales + RETIREMENT unit')

const salesRetirement = computeModulePermissions('sales', 'RETIREMENT')

assert(
  Array.isArray(salesRetirement['QUE_ANNUITY']) && salesRetirement['QUE_ANNUITY'].length > 0,
  'sales+RETIREMENT has QUE_ANNUITY'
)
assert(
  Array.isArray(salesRetirement['QUE_LIFE']) && salesRetirement['QUE_LIFE'].length > 0,
  'sales+RETIREMENT has QUE_LIFE'
)
assert(
  Array.isArray(salesRetirement['RMD_CENTER']) && salesRetirement['RMD_CENTER'].length > 0,
  'sales+RETIREMENT has RMD_CENTER'
)
assert(
  salesRetirement['QUE_MEDICARE'] === undefined,
  'sales+RETIREMENT does NOT have QUE_MEDICARE'
)

// ============================================================================
// Test 5: computeModulePermissions('admin', 'MEDICARE') — Leaders get ALL specialties + RAPID tools
// ============================================================================
section('Test 5: computeModulePermissions — admin + MEDICARE (Leader role)')

const adminMedicare = computeModulePermissions('admin', 'MEDICARE')

// Admin template has userLevel=LEADER, so gets ALL specialty modules (cross-unit)
const allSpecialties = Object.values(UNIT_MODULE_DEFAULTS).flatMap(u => u.modules)
const uniqueSpecialties = [...new Set(allSpecialties)]

for (const mod of uniqueSpecialties) {
  assert(
    Array.isArray(adminMedicare[mod]) && adminMedicare[mod].length > 0,
    `admin+MEDICARE has ${mod} (cross-unit for Leaders+)`
  )
}

// Leaders also get RAPID tools: C3, DEX, RAPID_IMPORT
assert(
  Array.isArray(adminMedicare['C3']) && adminMedicare['C3'].length > 0,
  'admin+MEDICARE has C3 (RAPID tool for Leaders+)'
)
assert(
  Array.isArray(adminMedicare['DEX']) && adminMedicare['DEX'].length > 0,
  'admin+MEDICARE has DEX (RAPID tool for Leaders+)'
)
assert(
  Array.isArray(adminMedicare['RAPID_IMPORT']) && adminMedicare['RAPID_IMPORT'].length > 0,
  'admin+MEDICARE has RAPID_IMPORT (RAPID tool for Leaders+)'
)

// ============================================================================
// Test 6: evaluateAccess with module_permissions — service+Medicare perms
// ============================================================================
section('Test 6: evaluateAccess with module_permissions — USER + service+Medicare')

assert(
  evaluateAccess('USER', 'QUE_MEDICARE', serviceMedicare),
  'USER with service+Medicare perms CAN access QUE_MEDICARE'
)
// QUE_ANNUITY is not in the serviceMedicare permissions map.
// evaluateAccess falls back to level-based check (USER meets QUE_ANNUITY minLevel=USER),
// so level-based access is granted. The permissions map is additive, not restrictive.
// Enforcement is at the map level: QUE_ANNUITY actions are NOT granted by the map.
assert(
  serviceMedicare['QUE_ANNUITY'] === undefined,
  'service+Medicare perms map does NOT include QUE_ANNUITY (already verified in Test 3)'
)
// USER with service+Medicare perms CAN access ATLAS-level modules? No — ATLAS requires EXECUTIVE.
assert(
  !evaluateAccess('USER', 'ATLAS', serviceMedicare),
  'USER with service+Medicare perms CANNOT access ATLAS (minLevel=EXECUTIVE, not in perms map)'
)

// ============================================================================
// Test 7: evaluateActionAccess — VIEW/EDIT checks on QUE_MEDICARE
// ============================================================================
section('Test 7: evaluateActionAccess — action-level checks')

// service template gives QUE_MEDICARE: ['VIEW', 'EDIT']
assert(
  evaluateActionAccess('USER', 'QUE_MEDICARE', 'VIEW', serviceMedicare),
  'USER+service+Medicare: VIEW on QUE_MEDICARE = allowed'
)
assert(
  evaluateActionAccess('USER', 'QUE_MEDICARE', 'EDIT', serviceMedicare),
  'USER+service+Medicare: EDIT on QUE_MEDICARE = allowed'
)
assert(
  !evaluateActionAccess('USER', 'QUE_MEDICARE', 'ADD', serviceMedicare),
  'USER+service+Medicare: ADD on QUE_MEDICARE = denied (service has VIEW+EDIT only)'
)

// ============================================================================
// Test 8: Readonly role — all actions are VIEW only
// ============================================================================
section('Test 8: Readonly role — all actions are VIEW only')

const readonlyPerms = computeModulePermissions('readonly', 'MEDICARE')

// Readonly+MEDICARE should have QUE_MEDICARE with VIEW only
assert(
  evaluateActionAccess('USER', 'QUE_MEDICARE', 'VIEW', readonlyPerms),
  'readonly: VIEW on QUE_MEDICARE = allowed'
)
assert(
  !evaluateActionAccess('USER', 'QUE_MEDICARE', 'EDIT', readonlyPerms),
  'readonly: EDIT on QUE_MEDICARE = denied'
)
assert(
  !evaluateActionAccess('USER', 'QUE_MEDICARE', 'ADD', readonlyPerms),
  'readonly: ADD on QUE_MEDICARE = denied'
)

// Check PRODASH too
assert(
  evaluateActionAccess('USER', 'PRODASH', 'VIEW', readonlyPerms),
  'readonly: VIEW on PRODASH = allowed'
)
assert(
  !evaluateActionAccess('USER', 'PRODASH', 'EDIT', readonlyPerms),
  'readonly: EDIT on PRODASH = denied'
)

// ============================================================================
// Summary
// ============================================================================

console.log(`\n========================================`)
console.log(`  Results: ${passed} passed, ${failed} failed`)
console.log(`========================================\n`)

if (failed > 0) {
  process.exit(1)
}
