// ---------------------------------------------------------------------------
// Notification Types — Notifications Module
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'contact_created' | 'contact_updated' | 'contact_deleted'
  | 'account_created' | 'account_updated' | 'account_deleted'
  | 'account_transferred'
  | 'approval_created' | 'approval_executed'
  | 'wire_complete' | 'import_complete'
  | 'merge_executed' | 'status_changed'

export type NotificationEntityType = 'client' | 'account' | 'approval_batch' | 'household' | 'revenue'

export type NotificationSourceType = 'user' | 'wire' | 'import' | 'intake' | 'system'

export type NotificationPortal = 'prodashx' | 'riimo' | 'sentinel' | 'all'

export type TeamScope = 'all' | 'sales' | 'service' | 'leadership'

export interface Notification {
  id: string
  type: NotificationType
  entity_type: NotificationEntityType
  entity_id: string
  entity_name: string
  summary: string
  fields_changed?: string[]
  source_type: NotificationSourceType
  source_id?: string
  source_label: string
  user_id?: string
  team_scope?: TeamScope
  hyperlink: string
  approval_batch_id?: string
  read: boolean
  created_at: string
  portal: NotificationPortal
}

export interface CreateNotificationInput {
  type: NotificationType
  entity_type: NotificationEntityType
  entity_id: string
  entity_name: string
  summary: string
  fields_changed?: string[]
  source_type: NotificationSourceType
  source_id?: string
  source_label: string
  user_id?: string
  team_scope?: TeamScope
  hyperlink: string
  approval_batch_id?: string
  portal: NotificationPortal
}
