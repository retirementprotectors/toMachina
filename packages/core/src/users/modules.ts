/**
 * Module definitions, tool suites, user levels, and access evaluation.
 * Ported from CORE_Entitlements.gs -- 46 MODULES, 5 TOOL_SUITES, 4 USER_LEVELS.
 * All data ported EXACTLY from GAS source.
 */

// ============================================================================
// TYPES
// ============================================================================

export type UserLevelName = 'OWNER' | 'EXECUTIVE' | 'LEADER' | 'USER'
export type ModuleStatus = 'active' | 'planned'
export type SuiteKey = 'RAPID_TOOLS' | 'DAVID_TOOLS' | 'RPI_TOOLS' | 'PIPELINES' | 'ADMIN_TOOLS'
export type ModuleAction = 'VIEW' | 'EDIT' | 'ADD'

export interface UserLevelDef {
  level: number
  name: UserLevelName
  displayName: string
  description: string
  permissions: string[]
}

export interface ModuleDef {
  name: string
  fullName: string
  description: string
  status: ModuleStatus
  suite: SuiteKey
  minUserLevel: UserLevelName
}

export interface ToolSuiteDef {
  name: string
  description: string
  matrix: 'RAPID' | 'SENTINEL' | 'PRODASH'
  modules: string[]
}

// ============================================================================
// USER LEVELS
// ============================================================================

export const USER_LEVELS: Record<UserLevelName, UserLevelDef> = {
  OWNER: {
    level: 0,
    name: 'OWNER',
    displayName: 'Super Admin',
    description: 'Full access to all modules, data, and settings across all divisions',
    permissions: ['ALL'],
  },
  EXECUTIVE: {
    level: 1,
    name: 'EXECUTIVE',
    displayName: 'Admin',
    description: 'Access to all assigned Division Leaders and their downstream users',
    permissions: ['VIEW_ALL', 'EDIT_ASSIGNED', 'MANAGE_USERS', 'VIEW_REPORTS', 'MANAGE_SETTINGS'],
  },
  LEADER: {
    level: 2,
    name: 'LEADER',
    displayName: 'Manager',
    description: 'Access to all assigned Unit Users and their pipelines/clients',
    permissions: ['VIEW_TEAM', 'EDIT_TEAM', 'MANAGE_ASSIGNMENTS', 'VIEW_REPORTS'],
  },
  USER: {
    level: 3,
    name: 'USER',
    displayName: 'Sales/Service',
    description: 'Access to assigned Pipelines, Clients, and Accounts only',
    permissions: ['VIEW_ASSIGNED', 'EDIT_ASSIGNED'],
  },
}

export const ALL_MODULE_ACTIONS: ModuleAction[] = ['VIEW', 'EDIT', 'ADD']

// ============================================================================
// TOOL SUITES
// ============================================================================

export const TOOL_SUITES: Record<SuiteKey, ToolSuiteDef> = {
  RAPID_TOOLS: {
    name: 'RAPID Tools',
    description: 'Shared Services & Operations Apps',
    matrix: 'RAPID',
    modules: [
      'ATLAS', 'C3', 'CAM', 'DEX', 'MCP_HUB', 'MY_RPI', 'RAPID_IMPORT',
      'CONTRACT_GENERATOR', 'LC3', 'PROPOSAL_MAKER', 'TOMIS',
    ],
  },
  DAVID_TOOLS: {
    name: 'DAVID Tools',
    description: 'B2B Partner Management Apps',
    matrix: 'SENTINEL',
    modules: [
      'DAVID_HUB', 'SENTINEL_V2', 'SENTINEL_DEALS', 'SENTINEL_PRODUCERS',
      'SENTINEL_ANALYSIS', 'SENTINEL_ADMIN',
    ],
  },
  RPI_TOOLS: {
    name: 'RPI Tools',
    description: 'B2C Client & Account Apps',
    matrix: 'PRODASH',
    modules: [
      'PRODASH', 'QUE_MEDICARE', 'QUE_ANNUITY', 'QUE_LIFE', 'QUE_MEDSUP',
      'PRODASH_CLIENTS', 'PRODASH_ACCOUNTS', 'PRODASH_PIPELINES', 'PRODASH_CAMPAIGNS',
      'RMD_CENTER', 'BENI_CENTER', 'DISCOVERY_KIT', 'PRODASH_ACTIVITY', 'PRODASH_ADMIN',
      'PROZONE', 'PRODASH_HOUSEHOLDS',
    ],
  },
  PIPELINES: {
    name: 'Pipelines',
    description: 'Operations & HR Workflows',
    matrix: 'RAPID',
    modules: ['DATA_MAINTENANCE', 'OFFBOARDING', 'ONBOARDING', 'SECURITY', 'TECH_MAINTENANCE'],
  },
  ADMIN_TOOLS: {
    name: 'Admin',
    description: 'Organization & Permissions Management',
    matrix: 'RAPID',
    modules: ['ORG_STRUCTURE', 'PERMISSIONS', 'RPI_COMMAND_CENTER', 'PIPELINE_STUDIO', 'FORGE', 'GUARDIAN', 'MDJ'],
  },
}

// ============================================================================
// 47 MODULE DEFINITIONS
// ============================================================================

export const MODULES: Record<string, ModuleDef> = {
  // ---- RAPID Tools - Shared Services (11) ----
  ATLAS: {
    name: 'ATLAS',
    fullName: 'Source of Truth Registry',
    description: 'Track every data source, carrier integration, and manual pull across all product lines',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'EXECUTIVE',
  },
  C3: {
    name: 'C3',
    fullName: 'Content/Campaign Manager',
    description: 'Manage campaigns and content triggers for B2B and B2C',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'USER',
  },
  CAM: {
    name: 'CAM',
    fullName: 'Commission Accounting Machine',
    description: 'Process and track commissions',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'EXECUTIVE',
  },
  DEX: {
    name: 'DEX',
    fullName: 'Data Exchange Hub',
    description: 'Cross-platform data synchronization and exchange',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'LEADER',
  },
  MCP_HUB: {
    name: 'MCP-Hub',
    fullName: 'Intelligence + Calculations',
    description: 'AI-powered intelligence and calculations',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'USER',
  },
  MY_RPI: {
    name: 'My RPI',
    fullName: 'Employee Profile',
    description: 'Personal dashboard with profile, access, documents, and team info',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'USER',
  },
  RAPID_IMPORT: {
    name: 'RAPID Import',
    fullName: 'Data Ingestion',
    description: 'Import and process data from various sources',
    status: 'active',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'LEADER',
  },
  CONTRACT_GENERATOR: {
    name: 'Contract Generator',
    fullName: 'DocuSign Integration',
    description: 'Generate and send contracts via DocuSign',
    status: 'planned',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'USER',
  },
  LC3: {
    name: 'LC3',
    fullName: 'Licensing/Contracting/Certs/Commissions',
    description: 'Manage licensing, contracting, and certifications',
    status: 'planned',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'LEADER',
  },
  PROPOSAL_MAKER: {
    name: 'Proposal Maker',
    fullName: 'Analysis Output Generator',
    description: 'Generate proposals and analysis outputs',
    status: 'planned',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'USER',
  },
  TOMIS: {
    name: 'TOMIS',
    fullName: 'Field Specialist App',
    description: 'Mobile app for field specialists',
    status: 'planned',
    suite: 'RAPID_TOOLS',
    minUserLevel: 'USER',
  },

  // ---- DAVID Tools - B2B (6) ----
  DAVID_HUB: {
    name: 'DAVID Hub',
    fullName: 'B2B Command Center',
    description: 'Central hub for all B2B operations and analytics',
    status: 'active',
    suite: 'DAVID_TOOLS',
    minUserLevel: 'LEADER',
  },
  SENTINEL_V2: {
    name: 'SENTINEL v2',
    fullName: 'Producer Management System',
    description: 'B2B producer pipeline and deal management',
    status: 'active',
    suite: 'DAVID_TOOLS',
    minUserLevel: 'USER',
  },
  SENTINEL_DEALS: {
    name: 'Deals',
    fullName: 'Deal Pipeline Management',
    description: 'B2B deal tracking, valuation, and pipeline management',
    status: 'active',
    suite: 'DAVID_TOOLS',
    minUserLevel: 'USER',
  },
  SENTINEL_PRODUCERS: {
    name: 'Producers',
    fullName: 'Producer Management',
    description: 'Producer onboarding, licensing, and relationship management',
    status: 'active',
    suite: 'DAVID_TOOLS',
    minUserLevel: 'USER',
  },
  SENTINEL_ANALYSIS: {
    name: 'Analysis',
    fullName: 'Book of Business Analysis',
    description: 'Revenue analysis, valuation comparisons, and MAP reports',
    status: 'active',
    suite: 'DAVID_TOOLS',
    minUserLevel: 'USER',
  },
  SENTINEL_ADMIN: {
    name: 'SENTINEL Admin',
    fullName: 'SENTINEL Administration',
    description: 'Team management and system settings for SENTINEL',
    status: 'active',
    suite: 'DAVID_TOOLS',
    minUserLevel: 'LEADER',
  },

  // ---- RPI Tools - B2C (14) ----
  PRODASH: {
    name: 'ProDashX',
    fullName: 'Client Dashboard',
    description: 'B2C client management and account overview',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  QUE_MEDICARE: {
    name: 'QUE- Medicare',
    fullName: 'Medicare Queue Manager',
    description: 'Medicare enrollment and service queue',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  QUE_LIFE: {
    name: 'QUE- Life',
    fullName: 'Life Insurance Queue Manager',
    description: 'Life insurance service and policy queue',
    status: 'planned',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  QUE_ANNUITY: {
    name: 'QUE- Annuity',
    fullName: 'Annuity Queue Manager',
    description: 'Annuity service and account queue',
    status: 'planned',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  QUE_MEDSUP: {
    name: 'QUE- MedSup',
    fullName: 'Medicare Supplement Queue Manager',
    description: 'Medicare supplement service queue',
    status: 'planned',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_CLIENTS: {
    name: 'Clients',
    fullName: 'Client Management',
    description: 'Client master data CRUD and search',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_ACCOUNTS: {
    name: 'Accounts',
    fullName: 'Account Management',
    description: 'Multi-type account management (annuity, life, medicare, investment, banking)',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_PIPELINES: {
    name: 'Pipelines',
    fullName: 'Sales Pipeline Boards',
    description: 'Kanban boards for sales pipeline management',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_CAMPAIGNS: {
    name: 'Campaigns',
    fullName: 'Campaign Manager',
    description: 'Marketing campaigns and content delivery',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  RMD_CENTER: {
    name: 'RMD Center',
    fullName: 'Required Minimum Distribution Tracker',
    description: 'Track and manage client RMD obligations',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  BENI_CENTER: {
    name: 'Beni Center',
    fullName: 'Beneficiary Confirmation Center',
    description: 'Cross-account beneficiary verification and confirmation',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  DISCOVERY_KIT: {
    name: 'Discovery Kit',
    fullName: 'Client Discovery Document Kit',
    description: 'Generate discovery documents and client intake kits',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_ACTIVITY: {
    name: 'Activity Log',
    fullName: 'Client Activity Logging',
    description: 'Log and review client interactions and activities',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_ADMIN: {
    name: 'PRODASH Admin',
    fullName: 'PRODASH Administration',
    description: 'Team management, permissions, and system settings for PRODASH',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'LEADER',
  },

  // ---- Pipelines (5) ----
  DATA_MAINTENANCE: {
    name: 'Data Maintenance',
    fullName: 'Cross-Matrix Data Sync',
    description: 'Cross-matrix data synchronization and integrity',
    status: 'active',
    suite: 'PIPELINES',
    minUserLevel: 'LEADER',
  },
  TECH_MAINTENANCE: {
    name: 'Tech Maintenance',
    fullName: 'Code & System Monitoring',
    description: 'Code deployment and system monitoring',
    status: 'active',
    suite: 'PIPELINES',
    minUserLevel: 'LEADER',
  },
  SECURITY: {
    name: 'Security',
    fullName: 'Access Control & Compliance',
    description: 'Access control and compliance audits',
    status: 'active',
    suite: 'PIPELINES',
    minUserLevel: 'EXECUTIVE',
  },
  ONBOARDING: {
    name: 'On-Boarding',
    fullName: 'New User Onboarding',
    description: 'New user and producer onboarding workflow',
    status: 'active',
    suite: 'PIPELINES',
    minUserLevel: 'LEADER',
  },
  OFFBOARDING: {
    name: 'Off-Boarding',
    fullName: 'User Termination',
    description: 'User termination and offboarding workflow',
    status: 'active',
    suite: 'PIPELINES',
    minUserLevel: 'LEADER',
  },

  // ---- Build Tracker (1) ----
  PIPELINE_STUDIO: {
    name: 'Pipeline Studio',
    fullName: 'Pipeline Design Tool',
    description: 'Full-screen pipeline builder and admin configuration',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'OWNER',
  },
  FORGE: {
    name: 'FORGE',
    fullName: 'Build Tracker',
    description: 'Platform build tracker with screenshot reporting and sprint management',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'OWNER',
  },
  GUARDIAN: {
    name: 'GUARDIAN',
    fullName: 'Data Protection Engine',
    description: 'Code-enforced write gates, schema validation, anomaly detection, and data health dashboard',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'OWNER',
  },
  MDJ: {
    name: 'VOLTRON',
    fullName: 'VOLTRON AI Assistant',
    description: 'AI-powered conversational assistant wired into the entire toMachina platform',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'USER',
  },
  PROZONE: {
    name: 'ProZONE',
    fullName: 'Prospecting Hub',
    description: 'Territory-based prospecting engine with zone scheduling and lead surfacing',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'LEADER',
  },
  RSP: {
    name: 'RSP',
    fullName: 'Retirement Sales Process',
    description: '5-stage pipeline: Discovery, Analysis, Presentation, Implementation, Service',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },
  PRODASH_HOUSEHOLDS: {
    name: 'Households',
    fullName: 'Household Management',
    description: 'Household grouping and family unit management',
    status: 'active',
    suite: 'RPI_TOOLS',
    minUserLevel: 'USER',
  },

  // ---- Admin Tools (3) ----
  ORG_STRUCTURE: {
    name: 'ORG Structure',
    fullName: 'Organization Hierarchy Manager',
    description: 'Manage company divisions, units, and reporting structure',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'EXECUTIVE',
  },
  PERMISSIONS: {
    name: 'Permissions',
    fullName: 'Entitlement Management',
    description: 'Manage user entitlements and module access',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'EXECUTIVE',
  },
  RPI_COMMAND_CENTER: {
    name: 'Command Center',
    fullName: 'RPI Command Center',
    description: 'Leadership visibility and monitoring dashboard',
    status: 'active',
    suite: 'ADMIN_TOOLS',
    minUserLevel: 'EXECUTIVE',
  },
}

// ============================================================================
// ACCESS EVALUATION
// ============================================================================

/**
 * Evaluate whether a user has access to a specific module.
 * Ported from CORE_Entitlements.gs evaluateAccess / userHasModuleAccess pattern.
 *
 * Pure function -- caller provides userLevel and optional overrides.
 */
export function evaluateAccess(
  userLevel: UserLevelName,
  moduleKey: string,
  modulePermissions?: Record<string, ModuleAction[]>,
  moduleOverrides?: Record<string, boolean>,
  assignedModules?: string[]
): boolean {
  const level = USER_LEVELS[userLevel]
  const moduleDef = MODULES[moduleKey]

  if (!level || !moduleDef) return false

  // OWNER has access to everything
  if (userLevel === 'OWNER') return true

  // Check per-module permissions (Entitlements v2)
  if (modulePermissions && modulePermissions[moduleKey] !== undefined) {
    const perms = modulePermissions[moduleKey]
    return Array.isArray(perms) && perms.length > 0
  }

  // Check legacy boolean overrides
  if (moduleOverrides && moduleOverrides[moduleKey] !== undefined) {
    return moduleOverrides[moduleKey]
  }

  // Check suite-level assignment
  if (assignedModules && !assignedModules.includes(moduleKey)) {
    return false
  }

  // Check minimum user level requirement
  const minLevel = USER_LEVELS[moduleDef.minUserLevel]?.level ?? 3
  return level.level <= minLevel
}

/**
 * Check if user has access to a specific module action.
 * Ported from CORE_Entitlements.gs userHasModuleAccess().
 */
export function evaluateActionAccess(
  userLevel: UserLevelName,
  moduleKey: string,
  action: ModuleAction,
  modulePermissions?: Record<string, ModuleAction[]>
): boolean {
  if (userLevel === 'OWNER') return true

  if (modulePermissions && modulePermissions[moduleKey] !== undefined) {
    const perms = modulePermissions[moduleKey]
    return Array.isArray(perms) && perms.includes(action)
  }

  // If no per-action permissions defined, fall back to module-level access
  return evaluateAccess(userLevel, moduleKey, modulePermissions)
}

/**
 * Get all modules accessible to a user at a given level.
 * Ported from CORE_Entitlements.gs getUserAccessibleModules().
 */
export function getAccessibleModules(
  userLevel: UserLevelName,
  modulePermissions?: Record<string, ModuleAction[]>,
  moduleOverrides?: Record<string, boolean>,
  assignedModules?: string[]
): string[] {
  if (userLevel === 'OWNER') {
    return Object.keys(MODULES)
  }

  return Object.keys(MODULES).filter(key =>
    evaluateAccess(userLevel, key, modulePermissions, moduleOverrides, assignedModules)
  )
}

/**
 * Get tool suites filtered by user access.
 * Ported from CORE_Entitlements.gs getToolSuitesForUser().
 */
export interface UserSuiteDef {
  name: string
  description: string
  matrix: 'RAPID' | 'SENTINEL' | 'PRODASH'
  modules: Array<ModuleDef & { key: string }>
}

export function getToolSuitesForUser(
  userLevel: UserLevelName,
  modulePermissions?: Record<string, ModuleAction[]>,
  moduleOverrides?: Record<string, boolean>,
  assignedModules?: string[]
): Record<string, UserSuiteDef> {
  const accessible = getAccessibleModules(userLevel, modulePermissions, moduleOverrides, assignedModules)
  const result: Record<string, UserSuiteDef> = {}

  for (const [suiteKey, suite] of Object.entries(TOOL_SUITES)) {
    const userModules = suite.modules
      .filter(m => accessible.includes(m))
      .map(key => ({ key, ...MODULES[key] }))

    if (userModules.length > 0) {
      result[suiteKey] = {
        name: suite.name,
        description: suite.description,
        matrix: suite.matrix,
        modules: userModules,
      }
    }
  }

  return result
}

/**
 * Get modules filtered for a specific platform.
 * Ported from CORE_Entitlements.gs getEntitlementsForPlatform().
 */
export function getModulesForPlatform(
  platform: 'RAPID' | 'SENTINEL' | 'PRODASH'
): string[] {
  const platformUpper = platform.toUpperCase()
  const allowed: string[] = []

  for (const suite of Object.values(TOOL_SUITES)) {
    if (suite.matrix === platformUpper) {
      allowed.push(...suite.modules)
    }
  }

  return allowed
}

// ============================================================================
// HIERARCHY LEVELS
// Ported from CORE_Entitlements.gs HIERARCHY_LEVELS
// ============================================================================

export interface HierarchyLevelDef {
  level: number
  name: string
  assignedUserLevel: UserLevelName
}

export const HIERARCHY_LEVELS: Record<string, HierarchyLevelDef> = {
  COMPANY: { level: 0, name: 'Company', assignedUserLevel: 'OWNER' },
  DIVISION: { level: 1, name: 'Division', assignedUserLevel: 'EXECUTIVE' },
  UNIT: { level: 2, name: 'Unit', assignedUserLevel: 'LEADER' },
  INDIVIDUAL: { level: 3, name: 'Individual', assignedUserLevel: 'USER' },
}

// ============================================================================
// PRODASH ROLE TEMPLATES
// Ported from CORE_Entitlements.gs PRODASH_ROLE_TEMPLATES
// ============================================================================

export type RoleTemplateKey = 'owner' | 'superadmin' | 'admin' | 'service' | 'sales' | 'readonly'

export interface RoleTemplateDef {
  label: string
  description: string
  userLevel: UserLevelName
  module_permissions: Record<string, ModuleAction[]>
}

export const PRODASH_ROLE_TEMPLATES: Record<RoleTemplateKey, RoleTemplateDef> = {
  owner: {
    label: 'Owner',
    description: 'Full access to all PRODASH features including admin',
    userLevel: 'OWNER',
    module_permissions: {
      PRODASH: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_CLIENTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACCOUNTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_HOUSEHOLDS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_PIPELINES: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_CAMPAIGNS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACTIVITY: ['VIEW', 'ADD'],
      PRODASH_ADMIN: ['VIEW', 'EDIT', 'ADD'],
      QUE_MEDICARE: ['VIEW', 'EDIT', 'ADD'],
      QUE_ANNUITY: ['VIEW', 'EDIT', 'ADD'],
      QUE_LIFE: ['VIEW', 'EDIT', 'ADD'],
      QUE_MEDSUP: ['VIEW', 'EDIT', 'ADD'],
      RMD_CENTER: ['VIEW', 'EDIT', 'ADD'],
      BENI_CENTER: ['VIEW', 'EDIT', 'ADD'],
      DISCOVERY_KIT: ['VIEW', 'EDIT', 'ADD'],
    },
  },
  superadmin: {
    label: 'Super Admin',
    description: 'Full access with admin roles but no admin assign',
    userLevel: 'EXECUTIVE',
    module_permissions: {
      PRODASH: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_CLIENTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACCOUNTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_HOUSEHOLDS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_PIPELINES: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_CAMPAIGNS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACTIVITY: ['VIEW', 'ADD'],
      PRODASH_ADMIN: ['VIEW', 'EDIT', 'ADD'],
      QUE_MEDICARE: ['VIEW', 'EDIT', 'ADD'],
      QUE_ANNUITY: ['VIEW', 'EDIT', 'ADD'],
      QUE_LIFE: ['VIEW', 'EDIT', 'ADD'],
      QUE_MEDSUP: ['VIEW', 'EDIT', 'ADD'],
      RMD_CENTER: ['VIEW', 'EDIT', 'ADD'],
      BENI_CENTER: ['VIEW', 'EDIT', 'ADD'],
      DISCOVERY_KIT: ['VIEW', 'EDIT', 'ADD'],
    },
  },
  admin: {
    label: 'Admin',
    description: 'Full data access with admin view/edit (no role management)',
    userLevel: 'LEADER',
    module_permissions: {
      PRODASH: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_CLIENTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACCOUNTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_HOUSEHOLDS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_PIPELINES: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_CAMPAIGNS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACTIVITY: ['VIEW', 'ADD'],
      PRODASH_ADMIN: ['VIEW', 'EDIT'],
      QUE_MEDICARE: ['VIEW', 'EDIT', 'ADD'],
      QUE_ANNUITY: ['VIEW', 'EDIT', 'ADD'],
      QUE_LIFE: ['VIEW', 'EDIT', 'ADD'],
      QUE_MEDSUP: ['VIEW', 'EDIT', 'ADD'],
      RMD_CENTER: ['VIEW', 'EDIT', 'ADD'],
      BENI_CENTER: ['VIEW', 'EDIT', 'ADD'],
      DISCOVERY_KIT: ['VIEW', 'EDIT', 'ADD'],
    },
  },
  service: {
    label: 'Service',
    description: 'Client/account CRUD, view-only pipelines and campaigns',
    userLevel: 'USER',
    module_permissions: {
      PRODASH: ['VIEW', 'EDIT'],
      PRODASH_CLIENTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_ACCOUNTS: ['VIEW', 'EDIT', 'ADD'],
      PRODASH_HOUSEHOLDS: ['VIEW', 'EDIT'],
      PRODASH_PIPELINES: ['VIEW'],
      PRODASH_CAMPAIGNS: ['VIEW'],
      PRODASH_ACTIVITY: ['VIEW', 'ADD'],
      PRODASH_ADMIN: [],
      QUE_MEDICARE: ['VIEW', 'EDIT'],
      QUE_ANNUITY: ['VIEW', 'EDIT'],
      QUE_LIFE: ['VIEW', 'EDIT'],
      QUE_MEDSUP: ['VIEW', 'EDIT'],
      RMD_CENTER: ['VIEW', 'EDIT'],
      BENI_CENTER: ['VIEW', 'EDIT'],
      DISCOVERY_KIT: ['VIEW', 'EDIT'],
    },
  },
  sales: {
    label: 'Sales',
    description: 'View/edit clients, view accounts, create campaigns',
    userLevel: 'USER',
    module_permissions: {
      PRODASH: ['VIEW'],
      PRODASH_CLIENTS: ['VIEW', 'EDIT'],
      PRODASH_ACCOUNTS: ['VIEW'],
      PRODASH_HOUSEHOLDS: ['VIEW'],
      PRODASH_PIPELINES: ['VIEW'],
      PRODASH_CAMPAIGNS: ['VIEW', 'ADD'],
      PRODASH_ACTIVITY: ['VIEW', 'ADD'],
      PRODASH_ADMIN: [],
      QUE_MEDICARE: ['VIEW'],
      QUE_ANNUITY: ['VIEW'],
      QUE_LIFE: ['VIEW'],
      QUE_MEDSUP: ['VIEW'],
      RMD_CENTER: ['VIEW'],
      BENI_CENTER: ['VIEW'],
      DISCOVERY_KIT: ['VIEW'],
    },
  },
  readonly: {
    label: 'Read Only',
    description: 'View-only access to all data, no editing',
    userLevel: 'USER',
    module_permissions: {
      PRODASH: ['VIEW'],
      PRODASH_CLIENTS: ['VIEW'],
      PRODASH_ACCOUNTS: ['VIEW'],
      PRODASH_HOUSEHOLDS: ['VIEW'],
      PRODASH_PIPELINES: ['VIEW'],
      PRODASH_CAMPAIGNS: ['VIEW'],
      PRODASH_ACTIVITY: ['VIEW'],
      PRODASH_ADMIN: [],
      QUE_MEDICARE: ['VIEW'],
      QUE_ANNUITY: ['VIEW'],
      QUE_LIFE: ['VIEW'],
      QUE_MEDSUP: ['VIEW'],
      RMD_CENTER: ['VIEW'],
      BENI_CENTER: ['VIEW'],
      DISCOVERY_KIT: ['VIEW'],
    },
  },
}

// ============================================================================
// UNIT MODULE DEFAULTS
// Ported from CORE_Entitlements.gs UNIT_MODULE_DEFAULTS
// ============================================================================

export interface UnitModuleDefaultDef {
  label: string
  description: string
  modules: string[]
}

/** Hardcoded fallback — used when Firestore `unit_module_defaults` collection is unavailable. */
export const DEFAULT_UNIT_MODULE_DEFAULTS: Record<string, UnitModuleDefaultDef> = {
  MEDICARE: {
    label: 'Medicare',
    description: 'Medicare sales and service',
    modules: ['QUE_MEDICARE', 'QUE_MEDSUP'],
  },
  RETIREMENT: {
    label: 'Retirement',
    description: 'Annuity, life insurance, and RMD services',
    modules: ['QUE_ANNUITY', 'QUE_LIFE', 'RMD_CENTER'],
  },
  LEGACY: {
    label: 'Legacy',
    description: 'Beneficiary and discovery services',
    modules: ['BENI_CENTER', 'DISCOVERY_KIT'],
  },
}

/** @deprecated Use DEFAULT_UNIT_MODULE_DEFAULTS. Kept for backward compatibility. */
export const UNIT_MODULE_DEFAULTS = DEFAULT_UNIT_MODULE_DEFAULTS

/** Base PRODASH modules every user gets (action level from role template). */
export const BASE_PRODASH_MODULES = [
  'PRODASH', 'PRODASH_CLIENTS', 'PRODASH_ACCOUNTS',
  'PRODASH_PIPELINES', 'PRODASH_CAMPAIGNS', 'PRODASH_ACTIVITY',
] as const

/** RAPID Tools auto-granted to Leaders+ with full access. */
export const LEADER_DEFAULT_RAPID_TOOLS = ['C3', 'RAPID_IMPORT', 'DEX'] as const

// ============================================================================
// COMPUTE MODULE PERMISSIONS
// Ported from CORE_Entitlements.gs computeModulePermissions()
// ============================================================================

/**
 * Compute module_permissions from role template + unit.
 * Base modules come from the role template.
 * Specialty modules are filtered by unit (Medicare/Retirement/Legacy).
 * Leaders and above get ALL specialty modules (not filtered by unit).
 *
 * Ported from CORE_Entitlements.gs computeModulePermissions().
 */
export function computeModulePermissions(
  roleTemplateKey: string,
  unitId?: string,
  sentinelPerms?: Record<string, ModuleAction[]>,
  unitDefaults?: Record<string, UnitModuleDefaultDef>
): Record<string, ModuleAction[]> {
  const template = PRODASH_ROLE_TEMPLATES[(roleTemplateKey || '').toLowerCase() as RoleTemplateKey]
    || PRODASH_ROLE_TEMPLATES.readonly

  const effectiveDefaults = unitDefaults || DEFAULT_UNIT_MODULE_DEFAULTS

  const isLeaderOrAbove = ['OWNER', 'EXECUTIVE', 'LEADER'].includes(template.userLevel)
  const unitUpper = (unitId || '').toUpperCase()
  const unitDef = effectiveDefaults[unitUpper]

  // Get the list of specialty modules this user should have
  let allowedSpecialty: string[] = []
  if (isLeaderOrAbove) {
    // Leaders+ get ALL specialty modules
    for (const unit of Object.values(effectiveDefaults)) {
      for (const mod of unit.modules) {
        if (!allowedSpecialty.includes(mod)) allowedSpecialty.push(mod)
      }
    }
  } else if (unitDef) {
    allowedSpecialty = [...unitDef.modules]
  }

  // Build module_permissions: start with base + add specialty if allowed
  const result: Record<string, ModuleAction[]> = {}

  for (const [moduleKey, actions] of Object.entries(template.module_permissions)) {
    const isBaseModule = (BASE_PRODASH_MODULES as readonly string[]).includes(moduleKey)
    const isAdminModule = moduleKey === 'PRODASH_ADMIN'
    const isSpecialty = !isBaseModule && !isAdminModule

    if (isBaseModule || isAdminModule) {
      result[moduleKey] = [...actions]
    } else if (isSpecialty && allowedSpecialty.includes(moduleKey)) {
      result[moduleKey] = [...actions]
    }
    // Specialty modules NOT in allowedSpecialty are excluded
  }

  // Add RAPID Tools for Leaders+
  if (isLeaderOrAbove) {
    for (const mod of LEADER_DEFAULT_RAPID_TOOLS) {
      if (!result[mod]) {
        result[mod] = ['VIEW', 'EDIT', 'ADD']
      }
    }
  }

  // Merge SENTINEL permissions if provided
  if (sentinelPerms) {
    for (const [moduleKey, actions] of Object.entries(sentinelPerms)) {
      result[moduleKey] = [...actions]
    }
  }

  return result
}
