/**
 * DEX check handlers for the flow engine.
 * Registered at server startup via registerCheckHandler().
 *
 * DEX_KIT_GENERATE — checks if a DEX form kit exists for the entity.
 * DEX_DOCUSIGN — checks if a DEX package has been sent/signed via DocuSign.
 */

import type { CheckHandlerResult } from '@tomachina/core'

/**
 * Handler for DEX_KIT_GENERATE check type.
 * Synchronous handler — returns PENDING if no dex_package_id is linked,
 * PASS if the kit has been generated (dex_package_id present in instance data),
 * or FAIL if the kit generation was attempted but failed.
 */
export function handleDexKitGenerate(
  checkConfig: Record<string, unknown>,
  instanceData: Record<string, unknown>
): CheckHandlerResult {
  const dexPackageId = instanceData.dex_package_id as string | undefined
  const entityId = instanceData.entity_id as string | undefined

  if (!entityId) {
    return { result: 'FAIL', detail: 'No entity_id found on instance — cannot generate DEX kit' }
  }

  // If a DEX package is already linked, the kit was generated
  if (dexPackageId) {
    return { result: 'PASS', detail: `DEX kit generated — package ${dexPackageId}` }
  }

  // No package linked yet — kit generation is pending
  return { result: 'PENDING', detail: 'DEX kit not yet generated — awaiting kit build' }
}

/**
 * Handler for DEX_DOCUSIGN check type.
 * Checks the DocuSign status of the linked DEX package.
 * Returns PASS if signed, PENDING if sent/awaiting, FAIL if no package linked.
 */
export function handleDexDocuSign(
  checkConfig: Record<string, unknown>,
  instanceData: Record<string, unknown>
): CheckHandlerResult {
  const dexPackageId = instanceData.dex_package_id as string | undefined

  if (!dexPackageId) {
    return { result: 'PENDING', detail: 'No DEX package linked — DocuSign check deferred' }
  }

  // Check for docusign_status on the instance data (populated by DEX pipeline)
  const docusignStatus = instanceData.docusign_status as string | undefined

  if (!docusignStatus) {
    return { result: 'PENDING', detail: `DEX package ${dexPackageId} — DocuSign status unknown` }
  }

  const normalizedStatus = docusignStatus.toLowerCase()

  if (normalizedStatus === 'completed' || normalizedStatus === 'signed') {
    return { result: 'PASS', detail: `DocuSign completed for package ${dexPackageId}` }
  }

  if (normalizedStatus === 'declined' || normalizedStatus === 'voided') {
    return { result: 'FAIL', detail: `DocuSign ${normalizedStatus} for package ${dexPackageId}` }
  }

  // sent, delivered, created, etc. — still in progress
  return { result: 'PENDING', detail: `DocuSign status: ${docusignStatus} for package ${dexPackageId}` }
}
