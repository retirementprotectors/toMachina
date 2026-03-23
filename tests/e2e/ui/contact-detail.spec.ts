import { test, expect } from '@playwright/test'

test.describe('Contact Detail — CLIENT360', () => {
  test('header and tabs render', async ({ page }) => {
    // Navigate directly to seeded test client
    await page.goto('/contacts/e2e-test-client-llc', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Wait for page to load (back link confirms we're on detail, not 404)
    await expect(page.getByText('Back to Contacts').first()).toBeVisible({ timeout: 15000 })

    // All 8 tab buttons present
    await expect(page.getByRole('button', { name: /Connect/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Personal/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Estate/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Accounts/ }).first()).toBeVisible()
    await expect(page.getByText('ACF').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Relationships/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Access/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Activity/ }).first()).toBeVisible()

    // AI3 button
    await expect(page.getByRole('button', { name: /AI3/ }).first()).toBeVisible()
  })

  test('tab switching works', async ({ page }) => {
    await page.goto('/contacts/e2e-test-client-llc', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Back to Contacts').first()).toBeVisible({ timeout: 15000 })

    // Click Personal tab
    await page.getByRole('button', { name: /Personal/ }).first().click()
    await page.waitForTimeout(300)

    // Click Activity tab
    await page.getByRole('button', { name: /Activity/ }).first().click()
    await page.waitForTimeout(300)
  })
})
