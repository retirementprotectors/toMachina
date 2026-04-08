/**
 * benchmark-trinity.ts — Trinity vs Claude benchmark
 * CTO tasking: compare Arcee Trinity models against Claude equivalents
 *
 * Run: npx tsx services/api/src/scripts/benchmark-trinity.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

// ─── Config ───────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
const ARCEE_API_KEY = process.env.ARCEE_API_KEY || ''

if (!ANTHROPIC_API_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1) }
if (!ARCEE_API_KEY) { console.error('Missing ARCEE_API_KEY'); process.exit(1) }

// Cost per 1M tokens
const COSTS: Record<string, { input: number; output: number }> = {
  'sonnet-4.6': { input: 3.00, output: 15.00 },
  'haiku-4.5': { input: 0.80, output: 4.00 },
  'trinity-lg': { input: 0.25, output: 0.90 },
  'trinity-mini': { input: 0.045, output: 0.15 },
}

// ─── Test Prompts ─────────────────────────────────────────────────────────────

const SYSTEM = 'You are a senior TypeScript engineer. Write clean, typed code. Return ONLY the code — no markdown fences, no explanation.'

const TASKS: Array<{ id: string; prompt: string }> = [
  {
    id: 'Task A: Calc Tool',
    prompt: 'Write a TypeScript function calcTotalLifeNeed that takes incomeNeed, debtNeed, collegeFunding, miscCashNeed, survivorCashNeed, survivorIncomeNeed, existingCoverageOffset and returns { totalNeed, breakdown } with each component labeled. Use a typed input interface and CalcResult<T> wrapper pattern: { value: T, breakdown: Record<string, number> }.',
  },
  {
    id: 'Task B: Super Tool',
    prompt: 'Write a TypeScript super tool analyzeLifeOptions that imports calcTotalLifeNeed, lookupLifeCarrierProduct, lookupLifeRate, calcNetOutlay. Produces 3 options: Option A (Final Expenses, whole life, MOO carrier), Option B (Income Replacement, term, PRO carrier), Option C (Swiss-Army IUL, JH carrier). Returns SuperToolOutput with findings array. Define all interfaces inline.',
  },
  {
    id: 'Task C: HTML Template',
    prompt: 'Write an HTML template function that takes a life needs analysis result and renders a summary card with: total need, income component, debt component, college component, misc component. Use dark theme CSS with teal accent (#14b8a6). Return a string of HTML. Function signature: renderLifeNeedsSummary(input: { totalNeed: number, incomeNeed: number, debtNeed: number, collegeFunding: number, miscCashNeed: number, clientName: string }): string',
  },
]

// ─── API Callers ──────────────────────────────────────────────────────────────

interface CallResult {
  model: string
  label: string
  output: string
  timeMs: number
  inputTokens: number
  outputTokens: number
  cost: number
  error?: string
}

async function callClaude(prompt: string, model: string, label: string): Promise<CallResult> {
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  const start = Date.now()
  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    const timeMs = Date.now() - start
    const output = response.content.map(b => b.type === 'text' ? b.text : '').join('')
    const inTok = response.usage.input_tokens
    const outTok = response.usage.output_tokens
    const rates = COSTS[label] || COSTS['sonnet-4.6']
    const cost = (inTok * rates.input + outTok * rates.output) / 1_000_000
    return { model, label, output, timeMs, inputTokens: inTok, outputTokens: outTok, cost }
  } catch (err) {
    return { model, label, output: '', timeMs: Date.now() - start, inputTokens: 0, outputTokens: 0, cost: 0, error: String(err).slice(0, 100) }
  }
}

async function callTrinity(prompt: string, model: string, label: string): Promise<CallResult> {
  const start = Date.now()
  try {
    const response = await fetch('https://api.arcee.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ARCEE_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        max_tokens: 4096,
        temperature: 0.3,
      }),
    })
    const timeMs = Date.now() - start
    if (!response.ok) {
      const errText = await response.text()
      return { model, label, output: '', timeMs, inputTokens: 0, outputTokens: 0, cost: 0, error: `HTTP ${response.status}: ${errText.slice(0, 150)}` }
    }
    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const output = data.choices?.[0]?.message?.content || ''
    const inTok = data.usage?.prompt_tokens || 0
    const outTok = data.usage?.completion_tokens || 0
    const rates = COSTS[label] || COSTS['trinity-mini']
    const cost = (inTok * rates.input + outTok * rates.output) / 1_000_000
    return { model, label, output, timeMs, inputTokens: inTok, outputTokens: outTok, cost }
  } catch (err) {
    return { model, label, output: '', timeMs: Date.now() - start, inputTokens: 0, outputTokens: 0, cost: 0, error: String(err).slice(0, 100) }
  }
}

// ─── Compile Check ────────────────────────────────────────────────────────────

function checkCompiles(code: string): boolean {
  const tmpFile = path.join('/tmp', `bench-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`)
  try {
    let cleaned = code
    const fenceMatch = cleaned.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/)
    if (fenceMatch) cleaned = fenceMatch[1]
    fs.writeFileSync(tmpFile, cleaned)
    execSync(`npx tsc --noEmit --strict --skipLibCheck --target es2020 --moduleResolution node "${tmpFile}" 2>&1`, { encoding: 'utf-8', timeout: 15000 })
    return true
  } catch {
    return false
  } finally {
    try { fs.unlinkSync(tmpFile) } catch { /* */ }
  }
}

// ─── Model Discovery ──────────────────────────────────────────────────────────

async function probeTrinitModel(model: string): Promise<boolean> {
  console.log(`  Probing ${model}...`)
  try {
    const res = await fetch('https://api.arcee.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ARCEE_API_KEY}` },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Say OK' }], max_tokens: 5 }),
    })
    if (res.ok) { console.log(`  ✓ ${model} — ACCESSIBLE`); return true }
    const txt = await res.text()
    console.log(`  ✗ ${model} — ${res.status}: ${txt.slice(0, 80)}`)
    return false
  } catch (err) {
    console.log(`  ✗ ${model} — ${String(err).slice(0, 80)}`)
    return false
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n=== Trinity vs Claude Benchmark ===\n')

  // Phase 1: Discover available Trinity models
  console.log('Phase 1: Model Discovery')
  const hasLarge = await probeTrinitModel('trinity-large-thinking')
  const hasMini = await probeTrinitModel('trinity-mini')

  if (!hasLarge && !hasMini) {
    console.error('\nNo Trinity models accessible. Check ARCEE_API_KEY.')
    process.exit(1)
  }

  // Build matchups
  type Matchup = { trinityModel: string; trinityLabel: string; claudeModel: string; claudeLabel: string; tier: string }
  const matchups: Matchup[] = []

  if (hasLarge) matchups.push({ trinityModel: 'trinity-large-thinking', trinityLabel: 'trinity-lg', claudeModel: 'claude-sonnet-4-6', claudeLabel: 'sonnet-4.6', tier: 'PRO TIER' })
  if (hasMini) matchups.push({ trinityModel: 'trinity-mini', trinityLabel: 'trinity-mini', claudeModel: 'claude-haiku-4-5-20251001', claudeLabel: 'haiku-4.5', tier: 'VALUE TIER' })

  console.log(`\nMatchups: ${matchups.map(m => `${m.trinityLabel} vs ${m.claudeLabel}`).join(' | ')}\n`)

  // Phase 2: Run benchmarks
  const allResults: Array<{ task: string; tier: string; claude: CallResult & { compiles: boolean }; trinity: CallResult & { compiles: boolean } }> = []

  for (const matchup of matchups) {
    console.log(`\n─── ${matchup.tier}: ${matchup.trinityLabel} vs ${matchup.claudeLabel} ───`)

    for (const task of TASKS) {
      console.log(`  Running ${task.id}...`)

      const [claudeResult, trinityResult] = await Promise.all([
        callClaude(task.prompt, matchup.claudeModel, matchup.claudeLabel),
        callTrinity(task.prompt, matchup.trinityModel, matchup.trinityLabel),
      ])

      const claudeCompiles = claudeResult.error ? false : checkCompiles(claudeResult.output)
      const trinityCompiles = trinityResult.error ? false : checkCompiles(trinityResult.output)

      allResults.push({
        task: task.id,
        tier: matchup.tier,
        claude: { ...claudeResult, compiles: claudeCompiles },
        trinity: { ...trinityResult, compiles: trinityCompiles },
      })

      console.log(`    ${matchup.claudeLabel}: ${claudeResult.timeMs}ms ${claudeResult.error ? '(ERROR)' : ''} | ${matchup.trinityLabel}: ${trinityResult.timeMs}ms ${trinityResult.error ? '(ERROR)' : ''}`)
    }
  }

  // Phase 3: Print results
  console.log('\n\n' + '═'.repeat(115))
  console.log(`${'Task'.padEnd(22)} | ${'Model'.padEnd(14)} | ${'Time (ms)'.padEnd(10)} | ${'In Tok'.padEnd(8)} | ${'Out Tok'.padEnd(8)} | ${'Est Cost'.padEnd(10)} | Compiles?`)
  console.log('─'.repeat(115))

  let currentTier = ''
  for (const r of allResults) {
    if (r.tier !== currentTier) {
      if (currentTier) console.log('─'.repeat(115))
      console.log(`\n  >>> ${r.tier}`)
      console.log('─'.repeat(115))
      currentTier = r.tier
    }
    for (const [data] of [[r.claude], [r.trinity]]) {
      const d = data as CallResult & { compiles: boolean }
      const costStr = d.error ? 'ERROR' : `$${d.cost.toFixed(4)}`
      const compilesStr = d.error ? `ERR` : (d.compiles ? '✓ PASS' : '✗ FAIL')
      console.log(`${r.task.padEnd(22)} | ${d.label.padEnd(14)} | ${String(d.timeMs).padEnd(10)} | ${String(d.inputTokens).padEnd(8)} | ${String(d.outputTokens).padEnd(8)} | ${costStr.padEnd(10)} | ${compilesStr}`)
    }
  }

  // Totals per tier
  console.log('\n' + '═'.repeat(115))
  for (const matchup of matchups) {
    const tierResults = allResults.filter(r => r.tier === matchup.tier)
    const claudeTotals = tierResults.reduce((s, r) => ({ time: s.time + r.claude.timeMs, cost: s.cost + r.claude.cost, pass: s.pass + (r.claude.compiles ? 1 : 0) }), { time: 0, cost: 0, pass: 0 })
    const trinityTotals = tierResults.reduce((s, r) => ({ time: s.time + r.trinity.timeMs, cost: s.cost + r.trinity.cost, pass: s.pass + (r.trinity.compiles ? 1 : 0) }), { time: 0, cost: 0, pass: 0 })

    const speedRatio = trinityTotals.time > 0 && claudeTotals.time > 0 ? (claudeTotals.time / trinityTotals.time).toFixed(1) : 'N/A'
    const costSavings = claudeTotals.cost > 0 ? ((1 - trinityTotals.cost / claudeTotals.cost) * 100).toFixed(0) : 'N/A'

    console.log(`\n${matchup.tier}:`)
    console.log(`  ${matchup.claudeLabel.padEnd(14)} | ${String(claudeTotals.time).padEnd(8)}ms | $${claudeTotals.cost.toFixed(4).padEnd(9)} | ${claudeTotals.pass}/3 compile`)
    console.log(`  ${matchup.trinityLabel.padEnd(14)} | ${String(trinityTotals.time).padEnd(8)}ms | $${trinityTotals.cost.toFixed(4).padEnd(9)} | ${trinityTotals.pass}/3 compile`)
    console.log(`  Speed: Trinity ${speedRatio}x ${trinityTotals.time < claudeTotals.time ? 'FASTER' : 'SLOWER'} | Cost savings: ${costSavings}%`)
  }

  console.log()

  // Save full outputs
  const outputPath = '/tmp/benchmark-trinity-results.json'
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2))
  console.log(`Full outputs saved to: ${outputPath}`)
}

run().catch(err => { console.error('Fatal:', err); process.exit(1) })
