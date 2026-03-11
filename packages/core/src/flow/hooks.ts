/**
 * Flow hooks — ported from FLOW_Hooks.gs.
 * Dispatch mechanism for custom check handlers.
 */

import type { CheckHandler, CheckHandlerResult, BuiltInCheckType } from './types'
import { runBuiltInCheck } from './gates'
import { BUILT_IN_CHECK_TYPES } from './constants'

// Registry for custom check handlers
const _checkHandlers: Record<string, CheckHandler> = {}

/**
 * Register a custom check handler.
 * Ported from FLOW_Hooks.gs registerCheckHandler().
 */
export function registerCheckHandler(checkType: string, handler: CheckHandler): void {
  if (!checkType) throw new Error('checkType is required')
  if (typeof handler !== 'function') throw new Error('handler must be a function')
  _checkHandlers[checkType] = handler
}

/**
 * Get registered handler keys.
 */
export function getRegisteredHandlers(): string[] {
  return Object.keys(_checkHandlers)
}

/**
 * Dispatch a check — tries registered handler first, then built-in, then PENDING.
 * Ported from FLOW_Hooks.gs dispatchCheck().
 */
export function dispatchCheck(
  checkType: string,
  checkConfig: string | Record<string, unknown>,
  instanceData: Record<string, unknown>
): CheckHandlerResult {
  const config = typeof checkConfig === 'string'
    ? (safeJsonParse(checkConfig) || {})
    : checkConfig

  // Priority 1: registered handler
  if (_checkHandlers[checkType]) {
    try {
      return _checkHandlers[checkType](config, instanceData)
    } catch (err) {
      return { result: 'FAIL', detail: `Handler error: ${String(err)}` }
    }
  }

  // Priority 2: built-in check
  if ((BUILT_IN_CHECK_TYPES as readonly string[]).includes(checkType)) {
    return runBuiltInCheck(checkType as BuiltInCheckType, config, instanceData)
  }

  // Priority 3: unknown
  return { result: 'PENDING', detail: `No handler registered for check type: ${checkType}` }
}

function safeJsonParse(str: string): Record<string, unknown> | null {
  try { return JSON.parse(str) } catch { return null }
}
