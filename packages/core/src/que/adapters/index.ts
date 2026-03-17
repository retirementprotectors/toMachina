/**
 * QUE Adapters — Barrel Export
 *
 * Source adapters bridge QUE sessions to external quote providers.
 */

// Base types
export type { QueAdapterConfig, QueAdapterResult, QueAdapter } from './base-adapter'

// Adapter implementations
export { CsgMedicareAdapter } from './csg-adapter'
export { ManualEntryAdapter } from './manual-adapter'
export { PlaywrightAdapter } from './playwright-adapter'
