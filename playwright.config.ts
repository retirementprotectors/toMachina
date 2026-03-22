import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e/ui',
  testMatch: '**/*.spec.ts',

  /* Fail fast in CI, allow retries locally */
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  /* Screenshot every test, video on failure only */
  use: {
    baseURL: 'http://localhost:3001',
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    /* Auth state injected by global setup */
    storageState: 'tests/e2e/ui/.auth/storageState.json',
  },

  /* Chromium only — matches CI */
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { storageState: undefined },
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],

  /* HTML report — never auto-open */
  reporter: [['html', { open: 'never' }]],

  /* Start ProDash dev server if not already running */
  webServer: {
    command: 'npx turbo run dev --filter=@tomachina/prodash',
    port: 3001,
    reuseExistingServer: true,
    timeout: 60000,
  },
})
