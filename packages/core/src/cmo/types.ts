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

// ---------------------------------------------------------------------------
// DEVOUR Track — Inventory (MUS-D01 through MUS-D04)
// ---------------------------------------------------------------------------

/** Status of a creative asset in inventory */
export type CmoDesignStatus = 'current' | 'stale' | 'needs-update' | 'gap'

/** A single inventory entry from any source */
export interface CmoInventoryEntry {
  id: string
  source: 'canva' | 'drive' | 'wordpress' | 'c3'
  type:
    | 'brochure'
    | 'presentation'
    | 'social'
    | 'email'
    | 'one-pager'
    | 'video'
    | 'guide'
    | 'fact-finder'
    | 'other'
  market: 'b2c' | 'b2b' | 'b2e' | 'all'
  lastModified: Date
  status: CmoDesignStatus
  channel?: CmoChannel
  url?: string
  notes?: string
}

/** WordPress page audit entry */
export interface CmoWordPressPageAudit {
  id: string
  url: string
  title: string
  status: 'live' | 'draft' | 'stale' | 'gap'
  lastModified: Date
  market: 'b2c' | 'b2b' | 'b2e' | 'all'
  pageType: 'landing' | 'product' | 'blog' | 'about' | 'partner' | 'other'
  notes?: string
}

/** C3 template audit entry */
export interface CmoTemplateAudit {
  templateId: string
  name: string
  campaignId?: string
  status: 'current' | 'stale' | 'needs-update'
  channel: 'email' | 'sms' | 'push'
  lastUsed?: Date
  lastModified: Date
  aepRelevant: boolean
  notes?: string
}

// ---------------------------------------------------------------------------
// DEVOUR Track — Parity (MUS-D05, MUS-D06)
// ---------------------------------------------------------------------------

/** A single digital format that may or may not exist for a print asset */
export interface CmoDigitalParityItem {
  type: 'email-sequence' | 'landing-page' | 'portal-content' | 'social' | 'video'
  status: 'missing' | 'draft' | 'live'
  url?: string
}

/** A print asset and its digital gap analysis */
export interface CmoParityGap {
  printAssetId: string
  printAssetName: string
  printAssetType: string
  missingDigital: CmoDigitalParityItem[]
  priority: 'high' | 'medium' | 'low' | 'backlog'
  marketRelevance: string[]
}

/** Result of dispatching a parity gap to artisan wires */
export interface CmoWireDispatch {
  wireId: string
  artisan: string
  input: Record<string, unknown>
  status: 'dispatched' | 'failed' | 'skipped'
}

/** Result of executing a single parity gap closure */
export interface CmoParityExecutionResult {
  gapId: string
  dispatched: CmoWireDispatch[]
  failed: string[]
  summary: string
}

// ---------------------------------------------------------------------------
// DEVOUR Track — Brand (MUS-D11, MUS-D12)
// ---------------------------------------------------------------------------

/** Brand guide registry — queryable brand rules */
export interface CmoBrandGuide {
  approvedColors: string[]
  prohibitedColors: string[]
  approvedFonts: string[]
  logoRules: string
  toneByChannel: Record<'b2c' | 'b2b' | 'b2e', string>
  prohibitedPatterns: string[]
  version: string
}

/** Descriptor of an asset to be checked against brand guide */
export interface CmoAssetDescriptor {
  assetId: string
  type: string
  channel: CmoChannel
  colors?: string[]
  fonts?: string[]
  hasGeneratedLogo: boolean
  copy?: string
  artisan: string
}

/** A brand compliance violation (DEVOUR version) */
export interface CmoBrandViolation {
  rule: string
  description: string
  severity: 'blocking' | 'warning'
}

/** Full brand compliance report */
export interface CmoBrandComplianceReport {
  assetId: string
  passed: boolean
  violations: CmoBrandViolation[]
  checkedAt: Date
}

// ---------------------------------------------------------------------------
// DEVOUR Track — Campaign Calendar (MUS-D13)
// ---------------------------------------------------------------------------

/** A single entry in the 90-day campaign calendar */
export interface CmoCalendarEntry {
  entryId: string
  name: string
  type: 'aep' | 't65' | 'birthday' | 'annual-review' | 'product-launch' | 'seasonal' | 'always-on'
  scheduledDate: Date
  market: 'b2c' | 'b2b' | 'b2e' | 'all'
  artisan: 'digital' | 'social' | 'video' | 'print'
  priority: 'high' | 'medium' | 'low'
  status: 'planned' | 'blocked' | 'ready'
  blockedReason?: string
}

/** The full 90-day campaign calendar */
export interface CmoCampaignCalendar {
  generatedAt: Date
  windowStart: Date
  windowEnd: Date
  entries: CmoCalendarEntry[]
  aepBlackoutActive: boolean
}
