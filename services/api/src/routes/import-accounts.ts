/**
 * import-accounts.ts (routes)
 * Account import API endpoints — ported from GAS IMPORT_Account.gs (IK-002)
 *
 * Endpoints:
 *   POST /api/import/accounts          — full orchestrated batch import (parse → validate → dedup → write)
 *   POST /api/import/accounts/batch    — batch import from pre-parsed records
 *   POST /api/import/accounts/parse    — parse-only (CRM or BoB), returns normalized records without writing
 *
 * All endpoints follow the { success, data } response contract.
 */

import { Router, type Request, type Response } from 'express'
import {
  successResponse,
  errorResponse,
} from '../lib/helpers.js'
import {
  parseAccounts,
  importAccountsBatch,
  importSingleAccount,
  validateAccountData,
  type AccountParseOptions,
  type ImportAccountOptions,
  type ParsedAccount,
} from '../lib/import-accounts.js'
import { startImportRun, completeImportRun } from '../lib/import-tracker.js'

export const importAccountRoutes = Router()

// ============================================================================
// POST /accounts — Full orchestrated import
// Parse raw rows (CRM or BoB) → validate → resolve clients → dedup → write
// ============================================================================

importAccountRoutes.post('/', async (req: Request, res: Response) => {
  try {
    const {
      rows,
      options = {},
    } = req.body as {
      rows?: Record<string, unknown>[]
      options?: AccountParseOptions & ImportAccountOptions
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty "rows" array'))
      return
    }

    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    // 1. Parse raw rows into normalized accounts
    const parseResult = parseAccounts(rows, {
      crmType: options.crmType,
      carrier: options.carrier,
      source: options.source,
    })

    if (parseResult.parsedCount === 0) {
      res.status(400).json(errorResponse(
        `No valid accounts parsed from ${parseResult.totalRows} rows. ` +
        `Parse errors: ${parseResult.errorCount}`,
      ))
      return
    }

    // 2. Start import run tracking
    const importRunId = await startImportRun({
      import_type: 'account_import',
      source: options.source || options.carrier || 'CRM_IMPORT',
      total_records: parseResult.parsedCount,
      triggered_by: userEmail,
    })

    // 3. Run batch import (client resolution + dedup + write)
    const batchResult = await importAccountsBatch(parseResult.parsed, {
      createClient: options.createClient,
      skipDuplicates: options.skipDuplicates,
      source: options.source || 'ACCOUNT_IMPORT',
      triggeredBy: userEmail,
    })

    // 4. Complete import run tracking
    await completeImportRun(importRunId, {
      imported: batchResult.imported,
      skipped: batchResult.skipped,
      duplicates: batchResult.skipped, // skipped = duplicates in this context
      errors: batchResult.errors.length,
      error_details: batchResult.errors.map(e => ({ index: e.index, error: e.error })),
    })

    // 5. Combine parse errors + import errors for full reporting
    const allErrors = [
      ...parseResult.errors.map(e => ({
        index: e.row - 1,
        error: e.errors.map(err => err.message).join('; '),
      })),
      ...batchResult.errors,
    ]

    res.json(successResponse({
      import_run_id: importRunId,
      parse: {
        totalRows: parseResult.totalRows,
        parsed: parseResult.parsedCount,
        parseErrors: parseResult.errorCount,
        source: parseResult.source,
        crmType: parseResult.crmType,
        carrier: parseResult.carrier,
      },
      import: {
        imported: batchResult.imported,
        updated: batchResult.updated,
        skipped: batchResult.skipped,
        errors: allErrors.length,
        error_details: allErrors.slice(0, 100),
      },
      summary: batchResult.summary,
    }))
  } catch (err) {
    console.error('POST /api/import/accounts error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /accounts/batch — Batch import from pre-parsed/normalized records
// Caller has already parsed the data — we just validate + dedup + write.
// ============================================================================

importAccountRoutes.post('/batch', async (req: Request, res: Response) => {
  try {
    const {
      accounts,
      options = {},
    } = req.body as {
      accounts?: ParsedAccount[]
      options?: ImportAccountOptions
    }

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty "accounts" array'))
      return
    }

    const userEmail = (req as unknown as { user?: { email?: string } }).user?.email || 'api'

    // Validate each account before importing
    const validAccounts: ParsedAccount[] = []
    const validationErrors: Array<{ index: number; error: string }> = []

    for (let i = 0; i < accounts.length; i++) {
      const v = validateAccountData(accounts[i])
      if (v.valid) {
        validAccounts.push(accounts[i])
      } else {
        validationErrors.push({
          index: i,
          error: v.errors.map(e => e.message).join('; '),
        })
      }
    }

    if (validAccounts.length === 0) {
      res.status(400).json(errorResponse(
        `All ${accounts.length} accounts failed validation`,
      ))
      return
    }

    const importRunId = await startImportRun({
      import_type: 'account_import_batch',
      source: options.source || 'API_BATCH',
      total_records: validAccounts.length,
      triggered_by: userEmail,
    })

    const batchResult = await importAccountsBatch(validAccounts, {
      createClient: options.createClient,
      skipDuplicates: options.skipDuplicates,
      source: options.source || 'API_BATCH',
      triggeredBy: userEmail,
    })

    const allErrors = [...validationErrors, ...batchResult.errors]

    await completeImportRun(importRunId, {
      imported: batchResult.imported,
      skipped: batchResult.skipped,
      duplicates: batchResult.skipped,
      errors: allErrors.length,
      error_details: allErrors.slice(0, 100),
    })

    res.json(successResponse({
      import_run_id: importRunId,
      imported: batchResult.imported,
      updated: batchResult.updated,
      skipped: batchResult.skipped,
      validation_errors: validationErrors.length,
      errors: allErrors.length,
      error_details: allErrors.slice(0, 100),
      summary: batchResult.summary,
    }))
  } catch (err) {
    console.error('POST /api/import/accounts/batch error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})

// ============================================================================
// POST /accounts/parse — Parse-only (dry run), no writes
// Returns normalized account data for preview / validation before committing.
// ============================================================================

importAccountRoutes.post('/parse', async (req: Request, res: Response) => {
  try {
    const {
      rows,
      options = {},
    } = req.body as {
      rows?: Record<string, unknown>[]
      options?: AccountParseOptions
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json(errorResponse('Payload must include non-empty "rows" array'))
      return
    }

    const parseResult = parseAccounts(rows, {
      crmType: options.crmType,
      carrier: options.carrier,
      source: options.source,
    })

    // Validate each parsed record and attach warnings
    const validated = parseResult.parsed.map((account, i) => {
      const v = validateAccountData(account)
      return {
        index: i,
        account: {
          ...account,
          _raw: undefined, // Strip raw data from response to reduce payload
        },
        valid: v.valid,
        errors: v.errors,
        warnings: v.warnings,
      }
    })

    res.json(successResponse({
      source: parseResult.source,
      crmType: parseResult.crmType,
      carrier: parseResult.carrier,
      totalRows: parseResult.totalRows,
      parsedCount: parseResult.parsedCount,
      parseErrors: parseResult.errors.map(e => ({
        row: e.row,
        errors: e.errors,
      })),
      records: validated,
    }))
  } catch (err) {
    console.error('POST /api/import/accounts/parse error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
