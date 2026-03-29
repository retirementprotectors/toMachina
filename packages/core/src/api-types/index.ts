/**
 * API Contract DTOs — single source of truth for request/response shapes.
 *
 * Both API routes (services/api) and frontend consumers (apps/*, packages/ui)
 * import these types. Keeps both sides in sync across the HTTP boundary.
 *
 * Usage:
 *   import type { ApiEnvelope, ClientDTO } from '@tomachina/core'
 */

export * from './common'

// Group files will be added as they're created:
export * from './client'
export * from './campaign'
export * from './flow'
export * from './cam'
export * from './atlas'
export * from './dex'
export * from './prozone'
export * from './forge'
export * from './utility'
export * from './sensei'
