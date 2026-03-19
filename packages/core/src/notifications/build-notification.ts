import type { CreateNotificationInput, Notification } from './types'

/**
 * Build a notification document object (no Firestore write).
 * Caller is responsible for persisting to Firestore.
 * This lives in packages/core so it can be used by any service.
 */
export function buildNotification(
  id: string,
  input: CreateNotificationInput
): Notification {
  return {
    id,
    ...input,
    read: false,
    created_at: new Date().toISOString(),
  }
}
