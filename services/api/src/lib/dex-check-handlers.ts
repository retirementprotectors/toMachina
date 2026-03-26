/**
 * DEX Check Handlers — wires DEX_KIT_GENERATE + DEX_DOCUSIGN into the Flow Engine.
 * Called at API startup to register custom check handlers.
 */

import { registerCheckHandler } from '@tomachina/core'
import { getFirestore } from 'firebase-admin/firestore'

const PACKAGES = 'dex_packages'
const KITS = 'dex_kits'

/**
 * Register all DEX-related check handlers for the Flow Engine.
 * Call this once at server startup.
 */
export function registerDexCheckHandlers(): void {
  // DEX_KIT_GENERATE — verifies a DEX kit has been built for this flow instance
  registerCheckHandler('DEX_KIT_GENERATE', (config, instanceData) => {
    const clientId = String(instanceData.client_id || '')
    const pipelineKey = String(instanceData.pipeline_key || '')

    if (!clientId) {
      return { result: 'FAIL', detail: 'No client_id on flow instance — cannot verify DEX kit' }
    }

    // Check synchronously using instance metadata (kit_id stored when generated)
    const kitId = String(instanceData.dex_kit_id || '')
    if (kitId) {
      return { result: 'PASS', detail: `DEX kit ${kitId} exists for client ${clientId}` }
    }

    // If no kit_id stored yet, check if a kit exists for this client in Firestore
    // Since handlers must be synchronous, we return PENDING to allow async verification
    // The task can be manually completed when the kit is confirmed
    return {
      result: 'PENDING',
      detail: `No DEX kit linked to instance. Generate a kit for client ${clientId} in DEX, then complete this task.`,
    }
  })

  // DEX_DOCUSIGN — verifies a DocuSign envelope has been sent for this flow instance
  registerCheckHandler('DEX_DOCUSIGN', (config, instanceData) => {
    const clientId = String(instanceData.client_id || '')
    const envelopeId = String(instanceData.docusign_envelope_id || '')

    if (envelopeId) {
      return { result: 'PASS', detail: `DocuSign envelope ${envelopeId} sent for client ${clientId}` }
    }

    const packageId = String(instanceData.dex_package_id || '')
    if (packageId) {
      return {
        result: 'PENDING',
        detail: `DEX package ${packageId} exists but no DocuSign envelope sent yet. Send via DEX, then complete this task.`,
      }
    }

    return {
      result: 'PENDING',
      detail: `No DocuSign envelope linked. Generate PDF and send via DEX for client ${clientId}, then complete this task.`,
    }
  })
}

/**
 * Async helper: link a DEX kit to a flow instance.
 * Called after kit generation to update the flow instance with the kit reference.
 */
export async function linkDexKitToInstance(instanceId: string, kitId: string, packageId?: string): Promise<void> {
  const db = getFirestore()
  const updates: Record<string, unknown> = {
    dex_kit_id: kitId,
    updated_at: new Date().toISOString(),
  }
  if (packageId) updates.dex_package_id = packageId
  await db.collection('flow_instances').doc(instanceId).update(updates)
}

/**
 * Async helper: link a DocuSign envelope to a flow instance.
 * Called after DocuSign send to update the flow instance with the envelope reference.
 */
export async function linkDocuSignToInstance(instanceId: string, envelopeId: string, packageId: string): Promise<void> {
  const db = getFirestore()
  await db.collection('flow_instances').doc(instanceId).update({
    docusign_envelope_id: envelopeId,
    dex_package_id: packageId,
    updated_at: new Date().toISOString(),
  })
}
