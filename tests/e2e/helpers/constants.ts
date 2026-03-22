/**
 * E2E Test Constants
 * Populated by seed-test-client.ts. IDs reference real Firestore docs + Drive folders.
 */

// ── Test Client ──
export const TEST_CLIENT_ID = 'e2e-test-client-llc'
export const TEST_CLIENT_NAME = 'E2E Test Client LLC'

// ── Test ACF Folder (Shared Drive) ──
// These are populated after running seed-test-client.ts
// Parent: Claude Code Shared Drive (0AFUXPgL0EWC6Uk9PVA)
export const SHARED_DRIVE_PARENT_ID = '0AFUXPgL0EWC6Uk9PVA'
export let TEST_ACF_FOLDER_ID = '1fvQuEom-BuQ8gvp41U6LagyUU2dOgbsm'
export let TEST_ACF_SUBFOLDER_IDS: Record<string, string> = {
  Client: '1abvoFjV8WofnloWVXnoMds_7j5UZwg2R',
  Cases: '1ICrDs4i_eXwZUZjHexDxWK_P_U76iwAb',
  NewBiz: '1Awkhi1KFCw0y947RMxt9I9DjL1nKpati',
  Account: '1AZVBlHQKPcTWID8g4nLp6jU6sPPnGF-S',
  Reactive: '1PCPAjiwbfaQ5mJKAOutP10LFu_UWpDzX',
}

// ── Intake Folder IDs (production folders) ──
export const MAIL_INTAKE_INCOMING_FOLDER_ID = '1LV32r7w1k98B0S_zfJoavzpLQgsAB1Dg'
export const SPC_INTAKE_FOLDER_ID = '1NczjcEifjXuc2uMBN70lHE_ZbtmeFOaU'

// ── Auth ──
export const TEST_USER_EMAIL = 'e2e-test@retireprotected.com'
export const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || ''
export const GCP_PROJECT_ID = 'claude-mcp-484718'

// ── API ──
// Backend E2E tests require Cloud Run (SUPER_PREPARE needs Drive download context).
// Locally: not runnable. CI: runs after deploy-api with TEST_API_URL from Cloud Run.
export const TEST_API_URL = process.env.TEST_API_URL || 'http://localhost:8080'

// ── Test Run Marker ──
export const TEST_FILE_PREFIX = 'e2e-test-'

// ── Setter for seed script ──
export function setTestACFIds(folderId: string, subfolderIds: Record<string, string>) {
  TEST_ACF_FOLDER_ID = folderId
  TEST_ACF_SUBFOLDER_IDS = subfolderIds
}
