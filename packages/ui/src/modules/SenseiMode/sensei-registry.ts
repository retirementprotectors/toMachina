/**
 * Sensei Registry — TRK-SNS-009
 *
 * Static map: DOM element selector → sensei module_id.
 * Registers which UI elements have training content.
 * New modules auto-register via single-line entry.
 */

export interface SenseiRegistryEntry {
  moduleId: string
  label: string
  selector: string
  description?: string
}

export const SENSEI_REGISTRY: SenseiRegistryEntry[] = [
  { moduleId: 'contacts', label: 'Contacts', selector: '[data-module="contacts"]' },
  { moduleId: 'households', label: 'Households', selector: '[data-module="households"]' },
  { moduleId: 'accounts', label: 'Accounts', selector: '[data-module="accounts"]' },
  { moduleId: 'rmd-center', label: 'RMD Center', selector: '[data-module="rmd-center"]' },
  { moduleId: 'beni-center', label: 'Beni Center', selector: '[data-module="beni-center"]' },
  { moduleId: 'access-center', label: 'Access Center', selector: '[data-module="access-center"]' },
  { moduleId: 'megazord', label: 'MEGAZORD', selector: '[data-module="megazord"]' },
  { moduleId: 'cam', label: 'CAM', selector: '[data-module="cam"]' },
  { moduleId: 'dex', label: 'DEX', selector: '[data-module="dex"]' },
  { moduleId: 'c3', label: 'C3', selector: '[data-module="c3"]' },
  { moduleId: 'pipeline-studio', label: 'Pipeline Studio', selector: '[data-module="pipeline-studio"]' },
  { moduleId: 'forge', label: 'FORGE', selector: '[data-module="forge"]' },
  { moduleId: 'prozone', label: 'ProZone', selector: '[data-module="prozone"]' },
  { moduleId: 'comms', label: 'Communications', selector: '[data-module="comms"]' },
  { moduleId: 'connect', label: 'Connect', selector: '[data-module="connect"]' },
  { moduleId: 'notifications', label: 'Notifications', selector: '[data-module="notifications"]' },
  { moduleId: 'voltron', label: 'VOLTRON', selector: '[data-module="voltron"]' },
  { moduleId: 'admin', label: 'Admin', selector: '[data-module="admin"]' },
  { moduleId: 'myrpi', label: 'MyRPI', selector: '[data-module="myrpi"]' },
]

/** Look up a registry entry by module ID. */
export function getSenseiEntry(moduleId: string): SenseiRegistryEntry | undefined {
  return SENSEI_REGISTRY.find((e) => e.moduleId === moduleId)
}
