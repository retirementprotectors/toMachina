/**
 * Global teardown — re-exported from setup.ts for Vitest config compatibility.
 * The actual teardown logic lives in setup.ts's teardown() export.
 */
export { teardown as default } from './setup.js'
