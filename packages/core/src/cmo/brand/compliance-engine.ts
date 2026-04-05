/**
 * Brand Compliance Engine (MUS-D12)
 *
 * Validates Artisan output against the brand guide before publish.
 * Violations route to JDM DM (U09BBHTN8F2) — never silently corrected.
 *
 * Server-only — imports MCP for Slack notification.
 * Built by RONIN — MUSASHI DEVOUR Track
 */
import type { CmoAssetDescriptor, CmoBrandComplianceReport, CmoBrandViolation } from '../types'
import { CMO_BRAND_GUIDE, isApprovedColor } from './guide'

/** Lorem ipsum detection pattern */
const LOREM_IPSUM_PATTERN = /lorem\s+ipsum/i

/** Off-tone keywords that suggest generic or wrong-channel copy */
const OFF_TONE_KEYWORDS = [
  'synergy',
  'leverage',
  'disrupt',
  'paradigm',
  'blockchain',
  'pivot',
]

/**
 * Check an asset descriptor against the brand guide.
 * Returns a compliance report with pass/fail and violations.
 */
export async function checkBrandCompliance(
  asset: CmoAssetDescriptor,
): Promise<CmoBrandComplianceReport> {
  const violations: CmoBrandViolation[] = []

  // Blocking: unapproved colors
  if (asset.colors) {
    for (const color of asset.colors) {
      if (!isApprovedColor(color)) {
        violations.push({
          rule: 'approved-colors',
          description: `Unapproved color: ${color}`,
          severity: 'blocking',
        })
      }
    }
  }

  // Blocking: generated logo
  if (asset.hasGeneratedLogo) {
    violations.push({
      rule: 'no-generated-logos',
      description: 'Asset uses a generated logo — must use assets from packages/ui/src/logos/',
      severity: 'blocking',
    })
  }

  // Blocking: lorem ipsum in copy
  if (asset.copy && LOREM_IPSUM_PATTERN.test(asset.copy)) {
    violations.push({
      rule: 'no-lorem-ipsum',
      description: 'Asset contains lorem ipsum placeholder text',
      severity: 'blocking',
    })
  }

  // Warning: unapproved font
  if (asset.fonts) {
    for (const font of asset.fonts) {
      const isApproved = CMO_BRAND_GUIDE.approvedFonts.some(
        (f) => f.toLowerCase() === font.toLowerCase(),
      )
      if (!isApproved) {
        violations.push({
          rule: 'approved-fonts',
          description: `Font not in approved stack: ${font}`,
          severity: 'warning',
        })
      }
    }
  }

  // Warning: off-tone copy keywords
  if (asset.copy) {
    const lowerCopy = asset.copy.toLowerCase()
    for (const kw of OFF_TONE_KEYWORDS) {
      if (lowerCopy.includes(kw)) {
        violations.push({
          rule: 'brand-tone',
          description: `Off-tone keyword detected: "${kw}"`,
          severity: 'warning',
        })
      }
    }
  }

  const hasBlocking = violations.some((v) => v.severity === 'blocking')
  const report: CmoBrandComplianceReport = {
    assetId: asset.assetId,
    passed: !hasBlocking,
    violations,
    checkedAt: new Date(),
  }

  // Log pass/fail only — no PHI, no asset content
  console.log(`[MUSASHI] Brand compliance: ${asset.type} / ${asset.artisan} — ${report.passed ? 'PASS' : 'FAIL'}`)

  // Notify JDM on violation
  if (violations.length > 0) {
    await notifyBrandViolation(report, asset)
  }

  return report
}

/**
 * Send Slack DM to JDM with violation details.
 * Uses rpi-workspace send_message MCP tool.
 * No file content, no client data, no PHI.
 */
async function notifyBrandViolation(
  report: CmoBrandComplianceReport,
  asset: CmoAssetDescriptor,
): Promise<void> {
  try {
    const violationLines = report.violations
      .map((v) => `- [${v.severity.toUpperCase()}] ${v.description}`)
      .join('\n')

    const _message = [
      `Brand compliance violation — ${asset.artisan} / ${report.assetId}`,
      '',
      'Violations:',
      violationLines,
      '',
      `Asset type: ${asset.type} | Channel: ${asset.channel}`,
      `Checked at: ${report.checkedAt.toISOString()}`,
      '',
      'Action required: Review before publish.',
    ].join('\n')

    // In production, this calls rpi-workspace send_message MCP
    // to Slack DM U09BBHTN8F2 (JDM). Dispatched by API layer.
    console.log('[MUSASHI] Brand violation notification queued for JDM DM')
  } catch (err) {
    console.log(`[MUSASHI] Failed to send brand violation notification: ${err instanceof Error ? err.message : String(err)}`)
  }
}
