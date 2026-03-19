// ---------------------------------------------------------------------------
// ATLAS Super Tools — barrel export
// ---------------------------------------------------------------------------

export { definition as extractDefinition, execute as executeExtract } from './extract'
export type { ExtractInput, ExtractOutput } from './extract'

export { definition as introspectDefinition, execute as executeIntrospect } from './introspect'
export type { IntrospectInput, IntrospectOutput } from './introspect'

export { definition as validateDefinition, execute as executeValidate } from './validate'
export type { ValidateInput, ValidateOutput } from './validate'

export { definition as normalizeDefinition, execute as executeNormalize } from './normalize'
export type { NormalizeInput, NormalizeOutput } from './normalize'

export { definition as matchDefinition, execute as executeMatch } from './match'
export type { MatchInput, MatchOutput, MatchedRecord, MatchTag } from './match'

export { definition as writeDefinition, execute as executeWrite } from './write'
export type { WriteInput, WriteOutput, WriteRecord, WriteOperation } from './write'

// SUPER_CLASSIFY — NOT exported from barrel (imports server-only tools: fs, child_process).
// Backend services import directly:
//   import { execute as executeClassify } from '@tomachina/core/src/atlas/super-tools/classify'
// Types are safe:
export type { ClassifyInput, ClassifyOutput, ClassifiedOutputDoc } from './classify'

import { definition as extractDef } from './extract'
import { definition as introspectDef } from './introspect'
import { definition as validateDef } from './validate'
import { definition as normalizeDef } from './normalize'
import { definition as matchDef } from './match'
import { definition as writeDef } from './write'

/**
 * All super tool definitions for registry purposes.
 * SUPER_CLASSIFY definition must be loaded dynamically at runtime (server-only).
 */
export function getSuperToolDefinitions() {
  return [
    extractDef,
    introspectDef,
    validateDef,
    normalizeDef,
    matchDef,
    writeDef,
  ]
}
