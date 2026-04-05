/**
 * CMO Inventory Barrel (MUS-D01 through MUS-D04)
 *
 * Re-exports scanner/auditor functions and processing helpers.
 * NOTE: scanCanvaInventory, scanDriveInventory, auditWordPressPages,
 * auditC3Templates are server-only. Import directly in API routes.
 * Only types and process* helpers are safe for shared usage.
 */
export { scanCanvaInventory, processCanvaDesigns } from './canva-scanner'
export { scanDriveInventory, processDriveFiles } from './drive-scanner'
export { auditWordPressPages, processWordPressPages } from './wordpress-auditor'
export { auditC3Templates, processTemplateDocuments } from './template-auditor'
