import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    pool: 'forks',
    testTimeout: 120_000,
    hookTimeout: 60_000,
    include: ['tests/e2e/**/*.test.ts', '!tests/e2e/{que,types}/**/*.test.ts'],
    globalSetup: ['tests/e2e/setup.ts'],
  },
})
