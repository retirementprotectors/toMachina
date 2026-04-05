/**
 * CMO Registry Types (MUS-C01)
 *
 * Follows QUE registry pattern with CMO-specific extensions:
 * - channel: content distribution channel
 * - toolDomain: which MCP/service the tool belongs to
 */

/** Content distribution channels */
export type CmoChannel = 'print' | 'digital' | 'web' | 'social' | 'video'

/** Tool source/domain — which MCP server or service owns the tool */
export type CmoToolDomain = 'canva' | 'wordpress' | 'veo' | 'c3' | 'pdf' | 'drive' | 'frontend-design'

/** Registry entry — one tool, super tool, or wire */
export interface CmoRegistryEntry {
  id: string
  type: 'TOOL' | 'SUPER_TOOL' | 'WIRE'
  domain: 'cmo'
  name: string
  description: string
  /** Which channels this tool serves */
  channel?: CmoChannel | CmoChannel[]
  /** Which MCP/service owns this tool */
  toolDomain?: CmoToolDomain
  /** Composed tool IDs (for super tools and wires) */
  composedOf?: string[]
}

/** A single step in a wire definition */
export interface CmoWireStep {
  stepId: string
  toolId: string
  description: string
  /** Reference to input schema (for Track 2 wiring) */
  inputSchemaRef?: string
  /** Reference to output schema (for Track 2 wiring) */
  outputSchemaRef?: string
}

/** A wire definition — multi-step creative pipeline */
export interface CmoWireDefinition {
  wireId: string
  name: string
  channel: CmoChannel
  description: string
  steps: CmoWireStep[]
}

// ---------------------------------------------------------------------------
// Wire Execution (MUS-O01)
// ---------------------------------------------------------------------------

/** Result of a single wire step execution */
export interface WireStepResult {
  stepId: string
  toolId: string
  success: boolean
  output?: unknown
  error?: string
  durationMs: number
}

/** Result of executing an entire wire */
export interface CmoWireExecutionResult {
  wireId: string
  success: boolean
  steps: WireStepResult[]
  completedAt?: Date
  haltedAt?: string
  error?: string
}

/** Callback signature for executing a single tool step */
export type ToolRunner = (
  toolId: string,
  input: Record<string, unknown>,
  context: Record<string, unknown>,
) => Promise<{ success: boolean; output?: unknown; error?: string }>

// ---------------------------------------------------------------------------
// Artisan Configuration (MUS-O06)
// ---------------------------------------------------------------------------

/** A named creative agent that owns a wire */
export interface CmoArtisan {
  id: string
  name: string
  channel: CmoChannel
  wireId: string
  toolDomains: CmoToolDomain[]
  description: string
  status: 'active' | 'degraded' | 'offline'
}

/** Health state for an artisan */
export interface CmoArtisanHealth {
  artisanId: string
  status: 'active' | 'degraded' | 'offline'
  lastExecutedAt?: Date
  lastResult?: 'success' | 'failure'
  errorMessage?: string
}

// ---------------------------------------------------------------------------
// Content Pipeline (MUS-O07)
// ---------------------------------------------------------------------------

/** Input schemas for each wire channel */
export interface BrochureInput {
  market: string
  product: string
  target: string
  tone: string
  brandKitId?: string
}

export interface CampaignInput {
  market: string
  templateId: string
  audience: {
    segment: string
    filters?: Record<string, unknown>
  }
  schedule: {
    type: 'drip' | 'blast'
    startAt: string
    endAt?: string
    cadenceDays?: number
  }
  sendChannels: Array<'email' | 'sms'>
}

export interface LandingPageInput {
  market: string
  purpose: string
  content: {
    title: string
    headline: string
    subheadline: string
    bodyText: string
    ctaText: string
    ctaUrl: string
  }
  design: {
    elementorTemplateId?: string
    heroImageUrl?: string
    colorScheme?: 'rpi-blue' | 'rpi-gold' | 'neutral'
  }
  slug: string
}

/** A creative brief submitted to the pipeline */
export interface CmoBrief {
  id: string
  market: string
  channels: CmoChannel[]
  inputs: {
    print?: BrochureInput
    digital?: CampaignInput
    web?: LandingPageInput
  }
  requestedBy: string
  createdAt: Date
  source?: 'slack' | 'forge' | 'manual'
  slackChannelId?: string
  forgeTicketId?: string
}

/** A single pipeline job (one artisan execution) */
export interface CmoPipelineJob {
  jobId: string
  briefId: string
  artisanId: string
  wireId: string
  status: 'queued' | 'running' | 'complete' | 'failed'
  result?: CmoWireExecutionResult
  startedAt?: Date
  completedAt?: Date
}

/** Result of processing an entire brief through the pipeline */
export interface CmoPipelineResult {
  briefId: string
  jobs: CmoPipelineJob[]
  overallStatus: 'complete' | 'partial' | 'failed'
  completedAt?: Date
}

// ---------------------------------------------------------------------------
// Brand Compliance (MUS-O08)
// ---------------------------------------------------------------------------

/** A single brand compliance violation */
export interface BrandComplianceViolation {
  rule: string
  severity: 'error' | 'warning'
  description: string
  fix?: string
}

/** Result of a brand compliance check */
export interface BrandComplianceResult {
  passed: boolean
  violations: BrandComplianceViolation[]
  checkedAt: Date
}
