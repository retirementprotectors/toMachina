/**
 * Shared constants used across the platform.
 * Import from '@tomachina/core' or '@tomachina/core/constants'.
 */

/** Account statuses that should be excluded from display in all account-rendering contexts.
 *  Used by: AccountsTab (contact detail), AccountsTab (household detail), accounts/page.tsx
 *
 *  Primary source: config_registry/excluded_statuses in Firestore (editable from Admin > Config Registry).
 *  This constant serves as the hardcoded FALLBACK when Firestore is unavailable.
 *  API routes should use: getConfig('excluded_statuses', { statuses: EXCLUDED_ACCOUNT_STATUSES }) */
export const EXCLUDED_ACCOUNT_STATUSES = ['inactive', 'terminated', 'lapsed', 'cancelled', 'merged', 'deleted'] as const

/** Client statuses that are always hard-filtered (not toggleable via status dropdown) */
export const HARD_EXCLUDED_CLIENT_STATUSES = ['merged'] as const
