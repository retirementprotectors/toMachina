import { test, expect } from '@playwright/test'

test.describe('Home Redirect', () => {
  test('root path redirects to /contacts', async ({ page }) => {
    await page.goto('/', { waitUntil: 'commit' })

    // SSR redirect: redirect('/contacts') in page.tsx
    await page.waitForURL('**/contacts**', { timeout: 10000 })
    expect(page.url()).toContain('/contacts')
  })
})
