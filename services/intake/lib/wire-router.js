/**
 * WIRE ROUTER — Maps file metadata to the correct Ranger (ZRD-O10).
 * Used by all intake channels (Drive, Slack, Email) to determine
 * which Ranger should process a given file.
 */
/** Commission-related filename patterns */
const COMMISSION_PATTERNS = [/commission/i, /statement/i, /comp[\s_-]?report/i, /revenue/i, /override/i];
/** Reference data filename patterns */
const REFERENCE_PATTERNS = [/carrier/i, /product/i, /naic/i, /rate[\s_-]?table/i, /reference/i, /seed/i];
/** Client/account import patterns */
const IMPORT_PATTERNS = [/client/i, /account/i, /roster/i, /book[\s_-]?of[\s_-]?business/i, /enrollment/i, /census/i];
/**
 * Route a file to the appropriate Ranger based on metadata.
 * Priority: file type → filename patterns → sender hints → default.
 */
export function routeToRanger(meta) {
    const lower = meta.filename.toLowerCase();
    // PDF documents → correspondence (mail scan, faxes, letters)
    if (lower.endsWith('.pdf') || meta.mimeType === 'application/pdf') {
        return {
            rangerId: 'ranger-correspondence',
            wireId: 'WIRE_INCOMING_CORRESPONDENCE',
            mode: 'document',
            confidence: 0.85,
            reason: 'PDF file type → correspondence pipeline',
        };
    }
    // Commission patterns (high confidence)
    if (COMMISSION_PATTERNS.some((p) => p.test(lower)) || COMMISSION_PATTERNS.some((p) => p.test(meta.subjectHint || ''))) {
        return {
            rangerId: 'ranger-commission',
            wireId: 'WIRE_COMMISSION_SYNC',
            mode: 'commission',
            confidence: 0.9,
            reason: 'Commission pattern matched in filename/subject',
        };
    }
    // Reference data patterns
    if (REFERENCE_PATTERNS.some((p) => p.test(lower))) {
        return {
            rangerId: 'ranger-reference',
            wireId: 'WIRE_REFERENCE_SEED',
            mode: 'csv',
            confidence: 0.8,
            reason: 'Reference data pattern matched in filename',
        };
    }
    // Explicit import patterns
    if (IMPORT_PATTERNS.some((p) => p.test(lower))) {
        return {
            rangerId: 'ranger-import',
            wireId: 'WIRE_DATA_IMPORT',
            mode: 'csv',
            confidence: 0.85,
            reason: 'Import pattern matched in filename',
        };
    }
    // Default: data import (lowest confidence — may need manual review)
    return {
        rangerId: 'ranger-import',
        wireId: 'WIRE_DATA_IMPORT',
        mode: 'csv',
        confidence: 0.5,
        reason: 'Default routing — no specific pattern matched',
    };
}
/**
 * Check if a route has high enough confidence for auto-dispatch.
 * Low-confidence routes should be queued for manual review instead.
 */
export function isAutoDispatchable(route, threshold = 0.7) {
    return route.confidence >= threshold;
}
//# sourceMappingURL=wire-router.js.map