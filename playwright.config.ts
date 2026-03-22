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
    },

    // ── Authenticated UI tests (ProDash) ──
    {
      name: 'chromium',
      testDir: 'tests/e2e/ui',
      testMatch: /\.spec\.ts$/,
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

  /* Auto-start ProDash dev server before tests */
  webServer: {
    command: 'npx turbo run dev --filter=@tomachina/prodash',
    port: 3001,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
