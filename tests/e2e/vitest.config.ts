import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
    // Vitest 4: poolOptions moved to top-level forks config
    forks: {
      singleFork: true,
    },
    testTimeout: 120_000,
    hookTimeout: 60_000,
    include: ['tests/e2e/intake/**/*.test.ts'],
    globalSetup: ['tests/e2e/setup.ts'],
  },
})
