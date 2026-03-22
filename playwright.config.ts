import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for toMachina E2E tests.
 *
 * Three project groups:
 *   1. Auth setup (shared, runs first)
 *   2. Per-portal smoke tests (prodash, riimo, sentinel)
 *   3. Authenticated UI tests (chromium, depends on setup)
 *
 * Usage:
 *   npm run test:e2e              # Run all tests
 *   npm run test:e2e:ui           # Open Playwright UI mode
 *   npx playwright test --project=prodash   # Smoke tests for ProDash only
 *   npx playwright test --project=chromium  # Authenticated UI tests only
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,

  /* Fail fast in CI, allow retries locally */
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  /* Screenshot every test, video on failure only */
  use: {
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    // ── Auth setup (runs before authenticated tests) ──
    {
      name: 'setup',
      testDir: 'tests/e2e/ui',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },

    // ── Smoke tests per portal (no auth required) ──
    {
      name: 'prodash',
      testDir: 'tests/e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
        storageState: undefined,
      },
    },
    {
      name: 'riimo',
      testDir: 'tests/e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3002',
        storageState: undefined,
      },
    },
    {
      name: 'sentinel',
      testDir: 'tests/e2e/smoke',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3003',
        storageState: undefined,
      },
    },

    // ── Authenticated UI tests (ProDash only for now) ──
    {
      name: 'chromium',
      testDir: 'tests/e2e/ui',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
        storageState: 'tests/e2e/ui/.auth/storageState.json',
      },
      dependencies: ['setup'],
    },
  ],

  /* HTML report — never auto-open */
  reporter: [['html', { open: 'never' }]],

  // ── Web server config ──
  // Uncomment to auto-start dev servers before running tests.
  // Tests assume dev servers are already running (npm run dev).
  //
  // webServer: [
  //   {
  //     command: 'npm run dev',
  //     port: 3001,
  //     reuseExistingServer: true,
  //     timeout: 120_000,
  //   },
  // ],
})
