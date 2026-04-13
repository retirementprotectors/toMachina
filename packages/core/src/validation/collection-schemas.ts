// ============================================================================
// GUARDIAN — Collection Schema Definitions
// Defines required, neverNull, immutable, and recommended fields per collection.
// Used by the Write Gate middleware to validate ALL Firestore writes.
// ============================================================================

import type { CollectionSchema } from '../types/guardian'

export const COLLECTION_SCHEMAS: Record<string, CollectionSchema> = {
  clients: {
    required: ['first_name', 'last_name', 'status'],
    neverNull: ['first_name', 'last_name'],
    immutableAfterCreate: ['client_id', 'created_at'],
    recommended: ['email', 'phone', 'dob', 'household_id'],
  },

  accounts: {
    required: ['client_id', 'carrier', 'status'],
    neverNull: ['client_id', 'carrier'],
    immutableAfterCreate: ['created_at'],
    recommended: ['charter', 'naic', 'carrier_id', 'policy_number'],
  },

  accounts_life: {
    required: ['client_id', 'carrier', 'status'],
    neverNull: ['client_id', 'carrier'],
    immutableAfterCreate: ['created_at'],
    recommended: ['charter', 'naic', 'carrier_id', 'policy_number'],
  },

  accounts_investments: {
    required: ['client_id', 'carrier', 'status'],
    neverNull: ['client_id', 'carrier'],
    immutableAfterCreate: ['created_at'],
    recommended: ['charter', 'naic', 'carrier_id'],
  },

  carriers: {
    required: ['carrier_id', 'display_name', 'parent_brand'],
    neverNull: ['carrier_id', 'display_name'],
    immutableAfterCreate: ['carrier_id'],
    recommended: ['naic', 'underwriting_charters'],
  },

  products: {
    required: ['product_id', 'carrier_id', 'product_name'],
    neverNull: ['product_id', 'carrier_id'],
    immutableAfterCreate: ['product_id'],
  },

  users: {
    required: ['user_id', 'email', 'first_name', 'last_name'],
    neverNull: ['user_id', 'email'],
    immutableAfterCreate: ['user_id', 'created_at'],
  },

  households: {
    required: ['primary_contact_id', 'status'],
    neverNull: ['primary_contact_id'],
    recommended: ['members', 'address'],
  },

  revenue: {
    required: ['client_id', 'carrier', 'amount'],
    neverNull: ['client_id'],
    immutableAfterCreate: ['created_at'],
  },

  flow_pipelines: {
    required: ['name', 'pipeline_type', 'status'],
    neverNull: ['name'],
    immutableAfterCreate: ['created_at'],
  },

  flow_stages: {
    required: ['pipeline_id', 'name', 'order'],
    neverNull: ['pipeline_id', 'name'],
    immutableAfterCreate: ['created_at'],
  },
}

/**
 * Protected collections — ALL writes to these go through the Write Gate.
 */
export const PROTECTED_COLLECTIONS = Object.keys(COLLECTION_SCHEMAS)

/**
 * Validate a document body against its collection schema.
 * Returns an array of error messages (empty = valid).
 */
export function validateSchema(
  collection: string,
  body: Record<string, unknown>,
  isCreate = false
): string[] {
  const schema = COLLECTION_SCHEMAS[collection]
  if (!schema) return [] // No schema = no validation (unprotected collection)

  const errors: string[] = []

  // Check required fields on create
  if (isCreate) {
    for (const field of schema.required) {
      if (body[field] === undefined || body[field] === null || body[field] === '') {
        errors.push(`Missing required field: ${field}`)
      }
    }
  }

  // Check neverNull — these can't be set to null/empty even on update
  if (schema.neverNull) {
    for (const field of schema.neverNull) {
      if (field in body && (body[field] === null || body[field] === '')) {
        errors.push(`Field cannot be null or empty: ${field}`)
      }
    }
  }

  // Check immutableAfterCreate — these can't be changed after initial set
  if (!isCreate && schema.immutableAfterCreate) {
    for (const field of schema.immutableAfterCreate) {
      if (field in body) {
        errors.push(`Immutable field cannot be modified: ${field}`)
      }
    }
  }

  return errors
}

/**
 * Get recommended fields that are missing from a document.
 * Used for health reporting, not write blocking.
 */
export function getMissingRecommended(
  collection: string,
  doc: Record<string, unknown>
): string[] {
  const schema = COLLECTION_SCHEMAS[collection]
  if (!schema?.recommended) return []
  return schema.recommended.filter(
    (field) => doc[field] === undefined || doc[field] === null || doc[field] === ''
  )
}
