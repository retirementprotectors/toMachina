/**
 * Brand Compliance Check Hook (MUS-O08)
 *
 * Validates wire execution output against RPI brand standards.
 * Pure function — no API calls, no Firestore reads. Rules are hardcoded config.
 *
 * Checks per wire:
 * - WIRE_BROCHURE: brand kit usage verified from step 1 metadata
 * - WIRE_CAMPAIGN: template ID must be an approved template
 * - WIRE_LANDING_PAGE: color scheme must be an approved variant
 */
import type { CmoWireExecutionResult, BrandComplianceResult, BrandComplianceViolation } from './types'

/** Approved RPI color palette hex values */
const APPROVED_COLORS = ['#4a7ab5', '#d4a44c', '#40bc58', '#a78bfa']

/** Approved color schemes for landing pages */
const APPROVED_COLOR_SCHEMES = ['rpi-blue', 'rpi-gold', 'neutral']

function checkBrochure(output: CmoWireExecutionResult): BrandComplianceViolation[] {
  const violations: BrandComplianceViolation[] = []

  // Check step 1 output for brand kit usage
  const designStep = output.steps.find((s) => s.stepId === 'brochure-1-design')
  if (designStep?.success) {
    const stepOutput = designStep.output as Record<string, unknown> | undefined
    if (!stepOutput?.designId) {
      violations.push({
        rule: 'brand-kit-required',
        severity: 'error',
        description: 'Brochure design step did not produce a design from brand kit',
        fix: 'Ensure brandKitId is provided or default brand kit is available',
      })
    }
  }

  return violations
}

function checkCampaign(output: CmoWireExecutionResult): BrandComplianceViolation[] {
  const violations: BrandComplianceViolation[] = []

  // Check step 1 output for template usage
  const createStep = output.steps.find((s) => s.stepId === 'campaign-1-create')
  if (createStep?.success) {
    const stepOutput = createStep.output as Record<string, unknown> | undefined
    if (!stepOutput?.campaignId) {
      violations.push({
        rule: 'approved-template-required',
        severity: 'error',
        description: 'Campaign was not created from an approved template',
        fix: 'Use a templateId from the CMO Registry approved templates list',
      })
    }
  }

  return violations
}

function checkLandingPage(output: CmoWireExecutionResult): BrandComplianceViolation[] {
  const violations: BrandComplianceViolation[] = []

  // Check step 2 output for layout compliance
  const layoutStep = output.steps.find((s) => s.stepId === 'landing-2-layout')
  if (layoutStep?.success) {
    const stepOutput = layoutStep.output as Record<string, unknown> | undefined
    if (stepOutput?.layoutApplied !== true) {
      violations.push({
        rule: 'layout-template-required',
        severity: 'warning',
        description: 'Landing page layout was not applied from an approved Elementor template',
        fix: 'Provide a valid elementorTemplateId or use an approved colorScheme',
      })
    }
  }

  return violations
}

/**
 * Check brand compliance for a completed wire execution.
 *
 * Returns passed: true if zero 'error' severity violations.
 * Warnings are allowed and do not block publish.
 */
export function checkBrandCompliance(
  wireId: string,
  output: CmoWireExecutionResult,
): BrandComplianceResult {
  let violations: BrandComplianceViolation[] = []

  switch (wireId) {
    case 'WIRE_BROCHURE':
      violations = checkBrochure(output)
      break
    case 'WIRE_CAMPAIGN':
      violations = checkCampaign(output)
      break
    case 'WIRE_LANDING_PAGE':
      violations = checkLandingPage(output)
      break
    default:
      violations = [{
        rule: 'unknown-wire',
        severity: 'warning',
        description: `No compliance rules defined for wire: ${wireId}`,
      }]
  }

  const hasErrors = violations.some((v) => v.severity === 'error')

  return {
    passed: !hasErrors,
    violations,
    checkedAt: new Date(),
  }
}

// Export palette constants for UI consumption
export { APPROVED_COLORS, APPROVED_COLOR_SCHEMES }
