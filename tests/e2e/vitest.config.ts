import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
    testTimeout: 120_000,
    hookTimeout: 60_000,
    include: [
      'tests/e2e/**/*.test.ts',
      // Excluded from CI — pure tests run separately, others need specific infrastructure
      '!tests/e2e/{que,types}/**/*.test.ts',     // run by vitest.pure.config.ts
      '!tests/e2e/shinobi/**/*.test.ts',          // needs MDJ_SERVER (mdj-agent:4200)
      '!tests/e2e/mdj/**/*.test.ts',              // needs MDJ_SERVER
      '!tests/e2e/accuracy/**/*.test.ts',          // new — needs test data seeded first
      '!tests/e2e/rangers/**/*.test.ts',           // new — needs Rangers API running
    ],
    globalSetup: ['tests/e2e/setup.ts'],
  },
})
