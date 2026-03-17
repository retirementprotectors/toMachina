/**
 * QUE — Analysis & Quoting Engine
 *
 * types        — Session, Quote, Recommendation, Profile, Source types
 * engine       — State machine, comparison algorithms
 * adapters/    — CSG, Manual, Playwright adapter interfaces
 * tools/       — 33 pure TypeScript financial calculators (25 calc + 8 lookup)
 * super-tools/ — 8 ANALYZE_* sequences + GENERATE_CASEWORK + ASSEMBLE_OUTPUT
 * generators/  — 5 generators + HTML templates (Summary + Detail x 8 types)
 * wires/       — 10 wires that chain super tools in sequence
 * registry     — QUE tool registrations
 */

// Sprint A: Core types, engine, adapters
export * from './types'
export * from './engine'
export * from './adapters'

// Calc tools, super tools, generators, wires
export * as queTools from './tools'
export * as queSuperTools from './super-tools'
export * as queGenerators from './generators'
export * as queWires from './wires'
export { QUE_REGISTRY, getQueRegistryEntry, getQueRegistryByType } from './registry'
export type { QueRegistryEntry } from './registry'
