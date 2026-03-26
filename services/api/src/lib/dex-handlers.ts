/**
 * DEX check handlers for the flow engine.
 * Registered at server startup via registerCheckHandler().
 *
 * DEX_KIT_GENERATE — validates kit generation readiness and checks if a DEX
 *   form kit exists for the entity. Extracts product_type, registration_type,
 *   action from check_config to validate the pipeline context.
 *
 * DEX_DOCUSIGN — checks if a DEX package has been sent/signed via DocuSign.
 *   Reads package status from instance data (populated by DEX pipeline routes).
 *
 * NOTE: These handlers are SYNCHRONOUS per the CheckHandler contract.
 * Actual Firestore I/O (kit creation, DocuSign sends) happens in the DEX API
 * routes. These handlers verify pre-populated state on instance/task data.
 */

import type { CheckHandlerResult } from '@tomachina/core'

/**
 * Handler for DEX_KIT_GENERATE check type.
 *
 * check_config fields:
 *   - product_type: e.g. 'annuity', 'life', 'securities'
 *   - registration_type: e.g. 'individual', 'joint', 'trust'
 *   - action: e.g. 'new_business', '1035_exchange', 'transfer'
 *
 * instanceData fields read:
 *   - entity_id: client ID for kit generation
 *   - dex_package_id: set by API route after kit is built
 *   - dex_kit_status: set by API route ('Generated', 'Ready', 'Needs Data', 'Failed')
 *
 * Returns:
 *   PASS — kit generated and package linked
 *   PENDING — kit not yet generated, awaiting build
 *   FAIL — entity_id missing or kit generation failed
 */
export function handleDexKitGenerate(
  checkConfig: Record<string, unknown>,
  instanceData: Record<string, unknown>
): CheckHandlerResult {
  const entityId = instanceData.entity_id as string | undefined
  const dexPackageId = instanceData.dex_package_id as string | undefined
  const kitStatus = instanceData.dex_kit_status as string | undefined

  // Validate entity context
  if (!entityId) {
    return { result: 'FAIL', detail: 'No entity_id found on instance data — cannot generate DEX kit' }
  }

  // Extract config for richer error messages
  const productType = String(checkConfig.product_type || 'unknown')
  const registrationType = String(checkConfig.registration_type || 'unknown')
  const action = String(checkConfig.action || 'unknown')

  // If kit generation was attempted and explicitly failed
  if (kitStatus === 'Failed') {
    return {
      result: 'FAIL',
      detail: `DEX kit generation failed for ${productType}/${registrationType}/${action} — entity ${entityId}`,
    }
  }

  // If a DEX package is already linked, the kit was generated successfully
  if (dexPackageId) {
    const statusSuffix = kitStatus ? ` (status: ${kitStatus})` : ''
    return {
      result: 'PASS',
      detail: `DEX kit generated — package ${dexPackageId}${statusSuffix}`,
    }
  }

  // No package linked yet — kit generation is pending
  return {
    result: 'PENDING',
    detail: `DEX kit not yet generated for ${productType}/${registrationType}/${action} — awaiting kit build for entity ${entityId}`,
  }
}

/**
 * Handler for DEX_DOCUSIGN check type.
 * Checks the DocuSign lifecycle status of the linked DEX package.
 *
 * instanceData fields read:
 *   - dex_package_id: the linked package ID
 *   - dex_package_status: package status from dex_packages collection
 *     (DRAFT, READY, SENT, VIEWED, SIGNED, SUBMITTED, COMPLETE, VOIDED, DECLINED)
 *
 * Returns:
 *   PASS — package is SIGNED or COMPLETE
 *   PENDING — package is SENT, VIEWED, or READY (still in progress)
 *   FAIL — no package linked, or package VOIDED/DECLINED
 */
export function handleDexDocuSign(
  checkConfig: Record<string, unknown>,
  instanceData: Record<string, unknown>
): CheckHandlerResult {
  const dexPackageId = instanceData.dex_package_id as string | undefined

  if (!dexPackageId) {
    return { result: 'PENDING', detail: 'No DEX package linked — DocuSign check deferred until kit is generated' }
  }

  // Read package status — populated by DEX pipeline routes onto instance data
  const packageStatus = (
    instanceData.dex_package_status as string ||
    instanceData.docusign_status as string ||
    ''
  ).toUpperCase()

  if (!packageStatus) {
    return { result: 'PENDING', detail: `DEX package ${dexPackageId} — status not yet populated` }
  }

  // Terminal success states
  if (packageStatus === 'SIGNED' || packageStatus === 'COMPLETE' || packageStatus === 'SUBMITTED') {
    return { result: 'PASS', detail: `DocuSign ${packageStatus.toLowerCase()} for package ${dexPackageId}` }
  }

  // Terminal failure states
  if (packageStatus === 'VOIDED' || packageStatus === 'DECLINED') {
    return { result: 'FAIL', detail: `DocuSign ${packageStatus.toLowerCase()} for package ${dexPackageId}` }
  }

  // In-progress states: SENT, VIEWED, READY, DRAFT
  if (packageStatus === 'SENT' || packageStatus === 'VIEWED') {
    return { result: 'PENDING', detail: `DocuSign ${packageStatus.toLowerCase()} — awaiting signature for package ${dexPackageId}` }
  }

  if (packageStatus === 'READY') {
    return { result: 'PENDING', detail: `Package ${dexPackageId} is READY — DocuSign envelope not yet sent` }
  }

  if (packageStatus === 'DRAFT') {
    return { result: 'PENDING', detail: `Package ${dexPackageId} is still in DRAFT — PDF not yet generated` }
  }

  // Unknown status — treat as pending
  return { result: 'PENDING', detail: `Package ${dexPackageId} has unknown status: ${packageStatus}` }
}
