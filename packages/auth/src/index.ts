export { AuthProvider, useAuth, UserProfileProvider, useEntitlements } from './provider'
export type { AuthUser, AuthState, UserProfile, EntitlementState } from './provider'

// Core entitlement system (re-exported from @tomachina/core)
export {
  USER_LEVELS,
  ALL_MODULE_ACTIONS,
  TOOL_SUITES,
  MODULES,
  HIERARCHY_LEVELS,
  PRODASH_ROLE_TEMPLATES,
  DEFAULT_UNIT_MODULE_DEFAULTS,
  UNIT_MODULE_DEFAULTS,
  BASE_PRODASH_MODULES,
  LEADER_DEFAULT_RAPID_TOOLS,
  evaluateAccess,
  evaluateActionAccess,
  getAccessibleModules,
  getToolSuitesForUser,
  getModulesForPlatform,
  computeModulePermissions,
} from './entitlements'

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
} from './entitlements'

// Auth-aware convenience wrappers
export {
  buildEntitlementContext,
  canAccessModule,
  canPerformAction,
  getModulesForUser,
  getSuitesForUser,
  getPlatformModules,
} from './entitlements'

export type { UserEntitlementContext } from './entitlements'
