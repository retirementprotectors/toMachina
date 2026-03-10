// Ported from RAPID_CORE CORE_Entitlements.gs

export const USER_LEVELS = {
  OWNER: 0,
  EXECUTIVE: 1,
  LEADER: 2,
  USER: 3,
} as const

export const TOOL_SUITES = {
  RAPID: 'RAPID',
  RPI: 'RPI',
  DAVID: 'DAVID',
  PIPELINES: 'PIPELINES',
  ADMIN: 'ADMIN',
} as const

interface ModuleDefinition {
  key: string
  label: string
  suite: string
  minUserLevel: number
  status: 'LIVE' | 'BETA' | 'DISABLED'
}

// Stub — Phase 1 will port full 46 module definitions from CORE_Entitlements.gs
const MODULES: ModuleDefinition[] = []

export function evaluateAccess(
  userLevel: number,
  moduleKey: string,
  _action?: string
): boolean {
  const mod = MODULES.find((m) => m.key === moduleKey)
  if (!mod) return false
  if (mod.status === 'DISABLED') return false
  return userLevel <= mod.minUserLevel
}

export function getAccessibleModules(userLevel: number, suite?: string): ModuleDefinition[] {
  return MODULES.filter((m) => {
    if (m.status === 'DISABLED') return false
    if (suite && m.suite !== suite) return false
    return userLevel <= m.minUserLevel
  })
}
