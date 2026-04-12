#!/usr/bin/env npx tsx
/**
 * MT-008 — onboard-partner.ts
 *
 * One-shot partner onboarding CLI. Creates a fully provisioned named Firestore
 * DB, deploys tenant-scoped security rules, seeds the partner_registry entry,
 * and runs a smoke test.
 *
 * Usage:
 *   npx tsx services/api/src/scripts/onboard-partner.ts <slug> <domain> "<display_name>"
 *   npm run onboard-partner -- midwest-medigap midwestmedigap.com "Midwest Medigap"
 *
 * Prerequisites:
 *   - gcloud CLI authenticated with an account that has the roles:
 *       roles/datastore.owner  (create named DBs + deploy rules)
 *       roles/firebase.admin   (or roles/firebaseAdmin)
 *   - firebase-admin available (pulled from this package's dependencies)
 *   - GOOGLE_APPLICATION_CREDENTIALS or ADC pointing to a service account
 *     (on MDJ_SERVER this is /home/jdm/mdj-agent/sa-key.json)
 *
 * Rules deployment approach:
 *   Named Firestore databases (non-default) do NOT yet support
 *   `firebase deploy --only firestore:rules` targeting a specific DB via
 *   firebase.json — the Firebase CLI only deploys rules to the "(default)" DB.
 *   The supported path for named DBs is the Firestore REST API:
 *     PATCH https://firestore.googleapis.com/v1/projects/{project}/databases/{db}
 *   However, that endpoint only sets database-level config, not security rules.
 *
 *   The correct mechanism is the Firebase Rules REST API:
 *     POST https://firebaserules.googleapis.com/v1/projects/{project}/rulesets
 *     PUT  https://firebaserules.googleapis.com/v1/projects/{project}/releases/cloud.firestore/{db}
 *   This is what this script uses (googleapis npm package, admin credentials).
 *
 *   If you later adopt the Firebase CLI v15+ which adds `--database` flag support
 *   for named DBs, the deploy step can be swapped to:
 *     firebase deploy --only firestore:rules --database partner-<slug>
 *
 * NOTE: This script lives in src/scripts/ which is excluded from the TypeScript
 * rootDir for the api service. It is executed via `npx tsx` (ts-node equivalent),
 * not compiled into the Cloud Run image. Types are runtime-compatible.
 */

import { execSync } from 'child_process'
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { google } from 'googleapis'

// ── Constants ─────────────────────────────────────────────────────────────────

const GCP_PROJECT = 'claude-mcp-484718'
const DB_LOCATION = 'nam5'           // Iowa (multi-region, matches existing default DB)
const SA_KEY_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || '/home/jdm/mdj-agent/sa-key.json'
const RULES_TEMPLATE_PATH = join(process.cwd(), 'firestore.partner.rules.template')

// ── Helpers ───────────────────────────────────────────────────────────────────

function banner(msg: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${msg}`)
  console.log(`${'─'.repeat(60)}`)
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`)
}

function fail(msg: string): never {
  console.error(`\n  ✗ ${msg}`)
  process.exit(1)
}

// ── Step 1: Validate inputs ───────────────────────────────────────────────────

function validateInputs(slug: string, domain: string, displayName: string) {
  banner('Step 1 — Validating inputs')

  if (!slug || !domain || !displayName) {
    fail('Usage: onboard-partner <slug> <domain> "<display_name>"')
  }

  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    fail(
      `slug "${slug}" is invalid. Must be lowercase, hyphen-separated, alphanumeric, no spaces. Example: midwest-medigap`
    )
  }

  if (!/^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
    fail(`domain "${domain}" is not a valid DNS domain. Example: midwestmedigap.com`)
  }

  if (!displayName.trim()) {
    fail('display_name cannot be blank')
  }

  ok(`slug: ${slug}`)
  ok(`domain: ${domain}`)
  ok(`display_name: ${displayName}`)
}

// ── Step 2: Create named Firestore database ───────────────────────────────────

function createNamedDatabase(slug: string) {
  banner('Step 2 — Creating named Firestore database')

  const dbName = `partner-${slug}`
  const cmd = [
    'gcloud firestore databases create',
    `--database=${dbName}`,
    `--location=${DB_LOCATION}`,
    `--type=firestore-native`,
    `--project=${GCP_PROJECT}`,
    '--quiet',
  ].join(' ')

  console.log(`  $ ${cmd}`)

  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    console.log(output.trim())
    ok(`Database partner-${slug} created in ${DB_LOCATION}`)
  } catch (err) {
    const errMsg = (err as { stderr?: string; message?: string }).stderr
      || (err as { message?: string }).message
      || String(err)

    // gcloud exits non-zero if the DB already exists — treat as idempotent
    if (errMsg.includes('already exists') || errMsg.includes('ALREADY_EXISTS')) {
      ok(`Database partner-${slug} already exists — continuing (idempotent)`)
    } else {
      console.error(errMsg)
      fail(
        `Failed to create database partner-${slug}. ` +
        'Ensure gcloud is authenticated and the service account has roles/datastore.owner.'
      )
    }
  }

  return dbName
}

// ── Step 3: Deploy Firestore security rules ───────────────────────────────────

async function deployRules(slug: string, dbName: string, auth: InstanceType<typeof google.auth.GoogleAuth>) {
  banner('Step 3 — Deploying Firestore security rules')

  if (!existsSync(RULES_TEMPLATE_PATH)) {
    fail(
      `Rules template not found at ${RULES_TEMPLATE_PATH}. ` +
      'Ensure firestore.partner.rules.template exists at the repo root.'
    )
  }

  const template = readFileSync(RULES_TEMPLATE_PATH, 'utf-8')
  const rendered = template.replace(/PARTNER_SLUG/g, slug)

  // Write to a temp file (useful for debugging)
  const tempRulesPath = join(process.cwd(), `.tmp-rules-${slug}.firestore`)
  writeFileSync(tempRulesPath, rendered, 'utf-8')
  ok(`Rules template rendered → ${tempRulesPath}`)

  // Deploy via Firebase Rules REST API (googleapis)
  // Named DB rules must be deployed via the Rules API, not `firebase deploy --only firestore:rules`
  // (Firebase CLI v14 only targets the default DB; named DB support is v15+ with --database flag)
  try {
    const rulesClient = google.firebaserules({ version: 'v1', auth })

    // 1. Create a new ruleset
    const createRes = await rulesClient.projects.rulesets.create({
      name: `projects/${GCP_PROJECT}`,
      requestBody: {
        source: {
          files: [
            {
              name: `firestore.partner.${slug}.rules`,
              content: rendered,
            },
          ],
        },
      },
    })

    const rulesetName = createRes.data.name
    if (!rulesetName) fail('Firebase Rules API returned no ruleset name')
    ok(`Ruleset created: ${rulesetName}`)

    // 2. Create or update the release for this named DB
    // Release name format: cloud.firestore/<database-id>
    const releaseName = `projects/${GCP_PROJECT}/releases/cloud.firestore/${dbName}`

    // Try update first; if not found, create
    try {
      await rulesClient.projects.releases.update({
        name: releaseName,
        requestBody: { name: releaseName, rulesetName },
      })
      ok(`Rules release updated for ${dbName}`)
    } catch (_updateErr) {
      // Release doesn't exist yet — create it
      await rulesClient.projects.releases.create({
        name: `projects/${GCP_PROJECT}`,
        requestBody: { name: releaseName, rulesetName },
      })
      ok(`Rules release created for ${dbName}`)
    }
  } catch (err) {
    console.error(err)
    fail(
      'Failed to deploy rules via Firebase Rules API. ' +
      'Ensure the service account has roles/firebasedataconnect.serviceAgent or roles/firebaseAdmin. ' +
      `Rendered rules saved to ${tempRulesPath} for manual deployment.`
    )
  } finally {
    // Clean up temp file on success
    try { unlinkSync(tempRulesPath) } catch { /* non-fatal */ }
  }

  ok('Security rules deployed successfully')
}

// ── Step 4: Seed partner_registry in default DB ───────────────────────────────

async function seedPartnerRegistry(
  slug: string,
  domain: string,
  displayName: string,
  dbName: string,
  adminApp: App
) {
  banner('Step 4 — Seeding partner_registry (default DB)')

  const db = getFirestore(adminApp)
  const docRef = db.collection('partner_registry').doc(slug)

  const now = new Date()
  const entry = {
    slug,
    db_name: dbName,
    domain,
    display_name: displayName,
    status: 'active',
    created_at: now.toISOString(),
    _created_at_ts: Timestamp.fromDate(now),
  }

  await docRef.set(entry, { merge: false })
  ok(`partner_registry/${slug} written to default DB`)
  ok(`  slug: ${entry.slug}`)
  ok(`  db_name: ${entry.db_name}`)
  ok(`  domain: ${entry.domain}`)
  ok(`  display_name: ${entry.display_name}`)
  ok(`  status: ${entry.status}`)
}

// ── Step 5: Smoke test the new named DB ───────────────────────────────────────

async function smokeTest(dbName: string, adminApp: App): Promise<boolean> {
  banner('Step 5 — Smoke test (named DB write + read + delete)')

  let passed = false

  try {
    // Access the named DB directly via Admin SDK
    // getFirestore with a database ID string targets the named DB
    const partnerDb = getFirestore(adminApp, dbName)

    const testDocRef = partnerDb.collection('_provisioning_test').doc('smoke')
    const payload = {
      test: 'onboard-partner smoke test',
      ts: new Date().toISOString(),
      db: dbName,
    }

    // Write
    await testDocRef.set(payload)
    ok('Write succeeded')

    // Read back
    const snap = await testDocRef.get()
    if (!snap.exists) throw new Error('Read returned no document after write')
    const data = snap.data()
    if (data?.test !== payload.test) throw new Error('Read data mismatch')
    ok('Read verified')

    // Delete
    await testDocRef.delete()
    ok('Cleanup deleted test doc')

    passed = true
  } catch (err) {
    console.error(`  ✗ Smoke test failed:`, err)
  }

  return passed
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const [slug, domain, displayName] = process.argv.slice(2)

  // Step 1: Validate
  validateInputs(slug, domain, displayName)

  // Step 2: Create DB
  const dbName = createNamedDatabase(slug)

  // Initialise Firebase Admin (SA key auth)
  let adminApp: App
  if (getApps().length > 0) {
    adminApp = getApps()[0]
  } else {
    if (!existsSync(SA_KEY_PATH)) {
      fail(
        `Service account key not found at ${SA_KEY_PATH}. ` +
        'Set GOOGLE_APPLICATION_CREDENTIALS env var or ensure sa-key.json is in place.'
      )
    }
    const serviceAccount = JSON.parse(readFileSync(SA_KEY_PATH, 'utf-8'))
    adminApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: GCP_PROJECT,
    })
  }

  // Google Auth client (same SA key) for googleapis calls
  const auth = new google.auth.GoogleAuth({
    keyFile: SA_KEY_PATH,
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase',
    ],
  })

  // Step 3: Deploy rules
  await deployRules(slug, dbName, auth)

  // Step 4: Seed registry
  await seedPartnerRegistry(slug, domain, displayName, dbName, adminApp)

  // Step 5: Smoke test
  const smokePass = await smokeTest(dbName, adminApp)

  // ── Summary ──────────────────────────────────────────────────────────────────
  banner('Onboarding Summary')
  console.log(`  Partner slug   : ${slug}`)
  console.log(`  DB id          : ${dbName}`)
  console.log(`  DB location    : ${DB_LOCATION}`)
  console.log(`  Domain         : ${domain}`)
  console.log(`  Display name   : ${displayName}`)
  console.log(`  Rules deployed : ✓`)
  console.log(`  Registry entry : ✓`)
  console.log(`  Smoke test     : ${smokePass ? '✓ PASS' : '✗ FAIL'}`)
  console.log()

  if (!smokePass) {
    console.error('  WARNING: Smoke test failed. The DB was created but write access may need investigation.')
    console.error('  Check IAM bindings for the service account on the named DB.')
    process.exit(1)
  }

  console.log(`  Partner "${displayName}" is ready. Users signing in from @${domain} will`)
  console.log(`  receive { role: 'partner_agent', partner_id: '${slug}' } claims automatically.`)
  console.log()
}

main().catch((err) => {
  console.error('onboard-partner fatal error:', err)
  process.exit(1)
})
