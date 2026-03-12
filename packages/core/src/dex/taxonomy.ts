// ---------------------------------------------------------------------------
// DEX Taxonomy — Pure functions for carrier/product/accountType/transaction
// lookups with domain filtering. Ported from DEX_Taxonomy.gs.
//
// All functions operate on arrays (no Firestore dependency).
// The API layer fetches from Firestore and passes arrays in.
// ---------------------------------------------------------------------------

import type {
  TaxonomyCarrier,
  TaxonomyProduct,
  TaxonomyAccountType,
  TaxonomyTransaction,
  TaxonomyDomain,
  CarrierType,
  ProductCategory,
} from './types'

// ============================================================================
// Domain Filtering — shared across all taxonomy types
// ============================================================================

/**
 * Filter any taxonomy array by domain. Items with domain "BOTH" always pass.
 * If domain is "ALL" or undefined, no filtering is applied.
 */
export function filterByDomain<T extends { domain?: TaxonomyDomain | string; [key: string]: unknown }>(
  items: T[],
  domain?: TaxonomyDomain | string,
): T[] {
  if (!domain || domain === 'ALL') return items
  return items.filter((item) => item.domain === domain || item.domain === 'BOTH')
}

// ============================================================================
// Carriers
// ============================================================================

/**
 * Get carriers, optionally filtered by domain.
 */
export function getCarriers(
  carriers: TaxonomyCarrier[],
  domain?: TaxonomyDomain | string,
): TaxonomyCarrier[] {
  return filterByDomain(carriers, domain)
}

/**
 * Get carriers filtered by carrier_type (e.g. INSURANCE, CUSTODIAN, BD_RIA, IMO).
 */
export function getCarriersByType(
  carriers: TaxonomyCarrier[],
  carrierType: CarrierType | string,
): TaxonomyCarrier[] {
  return carriers.filter((c) => c.carrier_type === carrierType)
}

/**
 * Find a single carrier by ID.
 */
export function getCarrierById(
  carriers: TaxonomyCarrier[],
  carrierId: string,
): TaxonomyCarrier | undefined {
  return carriers.find((c) => c.carrier_id === carrierId)
}

// ============================================================================
// Products
// ============================================================================

/**
 * Get products, optionally filtered by domain.
 */
export function getProducts(
  products: TaxonomyProduct[],
  domain?: TaxonomyDomain | string,
): TaxonomyProduct[] {
  return filterByDomain(products, domain)
}

/**
 * Get products filtered by category (e.g. MEDICARE, LIFE, ANNUITY, INVESTMENT).
 */
export function getProductsByCategory(
  products: TaxonomyProduct[],
  category: ProductCategory | string,
): TaxonomyProduct[] {
  return products.filter((p) => p.category === category)
}

/**
 * Find a single product by ID.
 */
export function getProductById(
  products: TaxonomyProduct[],
  productId: string,
): TaxonomyProduct | undefined {
  return products.find((p) => p.product_id === productId)
}

// ============================================================================
// Account Types
// ============================================================================

/**
 * Get account types, optionally filtered by domain.
 */
export function getAccountTypes(
  accountTypes: TaxonomyAccountType[],
  domain?: TaxonomyDomain | string,
): TaxonomyAccountType[] {
  return filterByDomain(accountTypes, domain)
}

/**
 * Find a single account type by ID.
 */
export function getAccountTypeById(
  accountTypes: TaxonomyAccountType[],
  accountTypeId: string,
): TaxonomyAccountType | undefined {
  return accountTypes.find((at) => at.account_type_id === accountTypeId)
}

// ============================================================================
// Transactions
// ============================================================================

/**
 * Get transactions, optionally filtered by domain.
 */
export function getTransactions(
  transactions: TaxonomyTransaction[],
  domain?: TaxonomyDomain | string,
): TaxonomyTransaction[] {
  return filterByDomain(transactions, domain)
}

/**
 * Find a single transaction by ID.
 */
export function getTransactionById(
  transactions: TaxonomyTransaction[],
  transactionId: string,
): TaxonomyTransaction | undefined {
  return transactions.find((t) => t.transaction_type_id === transactionId)
}

// ============================================================================
// Summary
// ============================================================================

export interface TaxonomySummary {
  carriers: { total: number; health: number; wealth: number }
  products: { total: number; health: number; wealth: number }
  accountTypes: { total: number; health: number; wealth: number }
  transactions: { total: number; health: number; wealth: number }
}

/**
 * Build a summary of all taxonomy data.
 */
export function getTaxonomySummary(
  carriers: TaxonomyCarrier[],
  products: TaxonomyProduct[],
  accountTypes: TaxonomyAccountType[],
  transactions: TaxonomyTransaction[],
): TaxonomySummary {
  return {
    carriers: {
      total: carriers.length,
      health: filterByDomain(carriers, 'HEALTH').length,
      wealth: filterByDomain(carriers, 'WEALTH').length,
    },
    products: {
      total: products.length,
      health: filterByDomain(products, 'HEALTH').length,
      wealth: filterByDomain(products, 'WEALTH').length,
    },
    accountTypes: {
      total: accountTypes.length,
      health: filterByDomain(accountTypes, 'HEALTH').length,
      wealth: filterByDomain(accountTypes, 'WEALTH').length,
    },
    transactions: {
      total: transactions.length,
      health: filterByDomain(transactions, 'HEALTH').length,
      wealth: filterByDomain(transactions, 'WEALTH').length,
    },
  }
}
