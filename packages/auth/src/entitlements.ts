/**
 * Auth-aware entitlement evaluation.
 *
 * Re-exports the full module/user-level system from @tomachina/core,
 * plus convenience wrappers that accept an AuthUser and resolve access.
 */

// Re-export everything from core's user/module system
export {
  USER_LEVELS,
  ALL_MODULE_ACTIONS,
  TOOL_SUITES,
  MODULES,
  HIERARCHY_LEVELS,
  PRODASH_ROLE_TEMPLATES,
  UNIT_MODULE_DEFAULTS,
  BASE_PRODASH_MODULES,
  LEADER_DEFAULT_RAPID_TOOLS,
  evaluateAccess,
  evaluateActionAccess,
  getAccessibleModules,
  getToolSuitesForUser,
  getModulesForPlatform,
  computeModulePermissions,
} from '@tomachina/core'

export type {
  UserLevelName,
  ModuleStatus,
  SuiteKey,
  ModuleAction,
  UserLevelDef,
  ModuleDef,
  ToolSuiteDef,
  HierarchyLevelDef,
  RoleTemplateKey,
  RoleTemplateDef,
  UnitModuleDefaultDef,
  UserSuiteDef,
} from '@tomachina/core'

import type { AuthUser } from './provider'
import type { UserLevelName, ModuleAction } from '@tomachina/core'
import {
  USER_LEVELS,
  MODULES,
  evaluateAccess as coreEvaluateAccess,
  evaluateActionAccess as coreEvaluateActionAccess,
  getAccessibleModules as coreGetAccessibleModules,
  getToolSuitesForUser as coreGetToolSuitesForUser,
  getModulesForPlatform as coreGetModulesForPlatform,
} from '@tomachina/core'
import type { UserSuiteDef } from '@tomachina/core'

// ============================================================================
// AUTH-AWARE CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Entitlement context for an authenticated user.
 * Built from Firestore user doc or defaults.
 */
export interface UserEntitlementContext {
  email: string
  userLevel: UserLevelName
  modulePermissions?: Record<string, ModuleAction[]>
  moduleOverrides?: Record<string, boolean>
  assignedModules?: string[]
}

/** Default level for unknown users (most restrictive). */
const DEFAULT_LEVEL: UserLevelName = 'USER'

/**
 * Build an entitlement context from an AuthUser.
 *
 * Reads the user's level + permissions from their Firestore profile
 * (passed in via firestoreOverrides). Falls back to USER level when
 * no profile exists.
 */
export function buildEntitlementContext(
  authUser: AuthUser | null,
  firestoreOverrides?: Partial<UserEntitlementContext>
): UserEntitlementContext {
  if (!authUser) {
    return { email: '', userLevel: DEFAULT_LEVEL }
  }

  const email = authUser.email.toLowerCase()

  // Determine user level from Firestore profile, default to USER
  const userLevel: UserLevelName = firestoreOverrides?.userLevel || DEFAULT_LEVEL

  return {
    email,
    userLevel,
    modulePermissions: firestoreOverrides?.modulePermissions,
    moduleOverrides: firestoreOverrides?.moduleOverrides,
    assignedModules: firestoreOverrides?.assignedModules,
  }
}

/**
 * Check if an authenticated user can access a specific module.
 */
export function canAccessModule(
  ctx: UserEntitlementContext,
  moduleKey: string
): boolean {
  return coreEvaluateAccess(
    ctx.userLevel,
    moduleKey,
    ctx.modulePermissions,
    ctx.moduleOverrides,
    ctx.assignedModules
  )
}

/**
 * Check if an authenticated user can perform a specific action on a module.
 */
export function canPerformAction(
  ctx: UserEntitlementContext,
  moduleKey: string,
  action: ModuleAction
): boolean {
  return coreEvaluateActionAccess(
    ctx.userLevel,
    moduleKey,
    action,
    ctx.modulePermissions
  )
}

/**
 * Get all module keys accessible to an authenticated user.
 */
export function getModulesForUser(ctx: UserEntitlementContext): string[] {
  return coreGetAccessibleModules(
    ctx.userLevel,
    ctx.modulePermissions,
    ctx.moduleOverrides,
    ctx.assignedModules
  )
}

/**
 * Get tool suites with their accessible modules for an authenticated user.
 */
export function getSuitesForUser(ctx: UserEntitlementContext): Record<string, UserSuiteDef> {
  return coreGetToolSuitesForUser(
    ctx.userLevel,
    ctx.modulePermissions,
    ctx.moduleOverrides,
    ctx.assignedModules
  )
}

/**
 * Get all module keys for a specific platform.
 */
export function getPlatformModules(platform: 'RAPID' | 'SENTINEL' | 'PRODASH'): string[] {
  return coreGetModulesForPlatform(platform)
}
