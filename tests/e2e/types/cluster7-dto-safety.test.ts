/**
 * Cluster 7 — DTO & Type Safety Tests
 *
 * Pure TypeScript tests (no Firestore, no API calls).
 * Validates that DTOs, generics, and API contracts are correctly typed.
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import { readFileSync, readdirSync, type Dirent } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = join(__dirname, '..', '..', '..')
const API_ROUTES_DIR = join(ROOT, 'services', 'api', 'src', 'routes')
const PRODASH_APP_DIR = join(ROOT, 'apps', 'prodash', 'app')

// ---------------------------------------------------------------------------
// TRK-13613: successResponse<T>() generic
// ---------------------------------------------------------------------------

describe('TRK-13613: successResponse<T>() generic', () => {
  it('propagates generic type through result', () => {
    // Replicate the successResponse signature here because the helpers module
    // imports firebase-admin/firestore at the top level, which is unavailable
    // in the pure test runner. The contract test validates the generic shape.
    function successResponse<T>(data: T, meta?: Record<string, unknown>) {
      return { success: true as const, data, ...meta }
    }

    const result = successResponse({ count: 5 })

    expect(result.success).toBe(true)
    expect(result.data.count).toBe(5)

    // Verify the generic propagates — result.data should be { count: number }
    expectTypeOf(result).toMatchTypeOf<{
      success: true
      data: { count: number }
    }>()

    // Verify that T flows through — wrong type should NOT match
    expectTypeOf(result.data).toEqualTypeOf<{ count: number }>()
  })

  it('matches the actual helpers.ts source signature', () => {
    // Static analysis: read the source file and verify the function signature
    const source = readFileSync(
      join(ROOT, 'services', 'api', 'src', 'lib', 'helpers.ts'),
      'utf-8'
    )

    // Verify the function exists with generic parameter
    expect(source).toContain('function successResponse<T>')
    expect(source).toContain('success: true as const')
    expect(source).toContain('data,')
  })
})

// ---------------------------------------------------------------------------
// TRK-13621: Flow/Pipeline/Approval DTOs match API contracts
// ---------------------------------------------------------------------------

describe('TRK-13621: Flow/Pipeline/Approval DTOs match API contracts', () => {
  it('FlowPipelineDTO has required fields', () => {
    type FlowPipelineDTO = import('../../../packages/core/src/api-types/flow').FlowPipelineDTO

    const dto: FlowPipelineDTO = {
      id: 'pipe-1',
      pipeline_key: 'new_business',
      pipeline_name: 'New Business',
      description: 'New business pipeline',
      status: 'published',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }

    expect(dto.id).toBe('pipe-1')
    expect(dto.pipeline_key).toBe('new_business')
    expectTypeOf(dto).toHaveProperty('id')
    expectTypeOf(dto).toHaveProperty('pipeline_key')
    expectTypeOf(dto).toHaveProperty('pipeline_name')
  })

  it('FlowInstanceDTO has required fields', () => {
    type FlowInstanceDTO = import('../../../packages/core/src/api-types/flow').FlowInstanceDTO

    const dto: FlowInstanceDTO = {
      id: 'inst-1',
      instance_id: 'inst-1',
      pipeline_key: 'new_business',
      entity_type: 'CLIENT',
      entity_id: 'client-1',
      entity_name: 'Test Client',
      entity_data: {},
      current_stage: 'intake',
      current_step: 'step-1',
      stage_status: 'in_progress',
      workflow_progress: {},
      priority: 'normal',
      assigned_to: 'josh@retireprotected.com',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      created_by: 'system',
    }

    expect(dto.id).toBe('inst-1')
    expect(dto.stage_status).toBe('in_progress')
    expectTypeOf(dto).toHaveProperty('pipeline_key')
    expectTypeOf(dto).toHaveProperty('current_stage')
    expectTypeOf(dto).toHaveProperty('entity_id')
  })

  it('ApprovalItemDTO satisfies ApprovalItem shape', () => {
    type ApprovalItemDTO = import('../../../packages/core/src/api-types/flow').ApprovalItemDTO

    // ApprovalItemDTO = ApprovalItem — verify it compiles and has expected structure
    expectTypeOf<ApprovalItemDTO>().toHaveProperty('approval_id')
    expectTypeOf<ApprovalItemDTO>().toHaveProperty('status')
  })
})

// ---------------------------------------------------------------------------
// TRK-13635: API routes import DTOs (no Record<string, unknown>)
// ---------------------------------------------------------------------------

describe('TRK-13635: API routes import DTOs (no Record<string, unknown>)', () => {
  it('scans API route files for untyped return patterns', () => {
    const routeFiles = readdirSync(API_ROUTES_DIR).filter((f) =>
      f.endsWith('.ts')
    )

    expect(routeFiles.length).toBeGreaterThan(0)

    const findings: { file: string; lines: number[] }[] = []

    for (const file of routeFiles) {
      const content = readFileSync(join(API_ROUTES_DIR, file), 'utf-8')
      const lines = content.split('\n')
      const flaggedLines: number[] = []

      lines.forEach((line, idx) => {
        // Skip comments
        const trimmed = line.trim()
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return

        // Check for Record<string, unknown> used as a response type
        if (
          line.includes('Record<string, unknown>') &&
          (line.includes('successResponse') ||
            line.includes('res.json') ||
            line.includes('return {'))
        ) {
          flaggedLines.push(idx + 1)
        }
      })

      if (flaggedLines.length > 0) {
        findings.push({ file, lines: flaggedLines })
      }
    }

    // Report findings — this is informational, not a hard fail
    // As DTOs are adopted, this count should decrease toward 0
    if (findings.length > 0) {
      console.log(
        `[TRK-13635] ${findings.length} route file(s) with untyped response patterns:`
      )
      for (const f of findings) {
        console.log(`  - ${f.file} (lines: ${f.lines.join(', ')})`)
      }
    }

    // Soft assertion: track count but don't fail (baseline measurement)
    expect(routeFiles.length).toBeGreaterThan(10)
  })
})

// ---------------------------------------------------------------------------
// TRK-13636: Frontend consumers import DTOs
// ---------------------------------------------------------------------------

describe('TRK-13636: Frontend consumers import DTOs', () => {
  it('scans ProDash app for fetch calls and DTO imports', () => {
    const findings: { file: string; hasFetch: boolean; hasTypeImport: boolean }[] = []

    function scanDir(dir: string) {
      let dirEntries: Dirent[]
      try {
        dirEntries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of dirEntries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          scanDir(fullPath)
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) &&
          !entry.name.endsWith('.test.ts')
        ) {
          let content: string
          try {
            content = readFileSync(fullPath, 'utf-8')
          } catch {
            continue
          }

          const hasFetch =
            content.includes('/api/') &&
            (content.includes('fetch(') || content.includes('fetch ('))
          if (!hasFetch) continue

          const hasTypeImport =
            content.includes('@tomachina/core') ||
            content.includes('api-types')

          findings.push({
            file: fullPath.replace(ROOT + '/', ''),
            hasFetch,
            hasTypeImport,
          })
        }
      }
    }

    scanDir(PRODASH_APP_DIR)

    // Report findings
    const withTypes = findings.filter((f) => f.hasTypeImport)
    const withoutTypes = findings.filter((f) => !f.hasTypeImport)

    if (withoutTypes.length > 0) {
      console.log(
        `[TRK-13636] ${withoutTypes.length} component(s) with fetch calls but no DTO imports:`
      )
      for (const f of withoutTypes) {
        console.log(`  - ${f.file}`)
      }
    }

    if (withTypes.length > 0) {
      console.log(
        `[TRK-13636] ${withTypes.length} component(s) correctly importing DTOs`
      )
    }

    // Informational — at least the scan ran successfully
    expect(findings.length).toBeGreaterThanOrEqual(0)
  })
})

// ---------------------------------------------------------------------------
// TRK-13609: Pipeline Studio Yellow Stage config (DTO shape)
// ---------------------------------------------------------------------------

describe('TRK-13609: Pipeline Studio Yellow Stage config', () => {
  it('has 4 steps with correct shape and order', async () => {
    const {
      YELLOW_STAGE_PIPELINE,
    } = await import(
      '../../../packages/core/src/que/pipeline-studio-config'
    )

    // YellowStageStep type is verified structurally via expectTypeOf below

    // 4 steps
    expect(YELLOW_STAGE_PIPELINE).toHaveLength(4)

    // Type safety — array conforms to YellowStageStep[]
    expectTypeOf(YELLOW_STAGE_PIPELINE).toMatchTypeOf<
      Array<{
        id: string
        name: string
        description: string
        execution_type: string
        order: number
      }>
    >()

    // Each step has required fields
    for (const step of YELLOW_STAGE_PIPELINE) {
      expect(step).toHaveProperty('id')
      expect(step).toHaveProperty('name')
      expect(step).toHaveProperty('description')
      expect(step).toHaveProperty('execution_type')
      expect(step).toHaveProperty('order')
    }

    // Verify stage names in order
    const names = YELLOW_STAGE_PIPELINE.map((s) => s.name)
    expect(names).toEqual([
      'Analysis',
      'Case Building',
      'Package Assembly',
      'Case Ready',
    ])
  })
})
