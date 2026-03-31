// ---------------------------------------------------------------------------
// ATLAS Super Tools — barrel export
// ---------------------------------------------------------------------------

// SUPER_EXTRACT — definition only from barrel (imports server-only: fs, Anthropic SDK).
// Backend services import directly:
//   import { execute as executeExtract } from '@tomachina/core/src/atlas/super-tools/extract'
export { definition as extractDefinition } from './extract'
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

// SUPER_PREPARE — NOT exported from barrel (imports server-only modules: fs, child_process).
// Backend services import directly:
//   import { execute as executePrepare } from '@tomachina/core/src/atlas/super-tools/prepare'
// Types are safe:
export type { PrepareInput, PrepareOutput } from './prepare'

// ACF_FINALIZE — safe to export from barrel (no server-only deps in core logic).
// Context callbacks (Drive ops) are injected at runtime by the caller.
export { definition as finalizeDefinition, execute as executeFinalize } from './acf-finalize'
export type { FinalizeInput, FinalizeOutput } from './acf-finalize'

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
import { definition as finalizeDef } from './acf-finalize'

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
    finalizeDef,
  ]
}
