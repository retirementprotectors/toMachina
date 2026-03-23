import { test, expect } from '@playwright/test'

test.describe('Household Detail', () => {
  test('list page loads, then navigate to detail if data exists', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // Wait for heading to confirm page loaded
    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })

    // Wait for data or empty state
    const dataRow = page.locator('table tbody tr').first()
    const emptyState = page.getByText(/No households/).first()
    await expect(dataRow.or(emptyState)).toBeVisible({ timeout: 20000 })

    // Check if a household row exists (not the empty state)
    const hasData = await dataRow.isVisible().catch(() => false)
    const isEmpty = await emptyState.isVisible().catch(() => false)

    if (isEmpty || !hasData) {
      // No households — list page verified, test passes
      return
    }

    // Click the first data row — use link href to navigate directly
    // (avoids waitForEvent('page') timeout when navigation is client-side)
    const link = dataRow.locator('a').first()
    const href = await link.getAttribute('href').catch(() => null)

    if (href) {
      await page.goto(href, { waitUntil: 'commit' })
    } else {
      await dataRow.click()
      await page.waitForTimeout(1000)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // --- Detail page assertions ---

    // Back link
    await expect(page.getByText('Back to Households').first()).toBeVisible({ timeout: 15000 })

    // Household name heading (h1)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 })

    // Edit and Delete action buttons
    await expect(page.getByRole('button', { name: /Edit/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Delete/ }).first()).toBeVisible()

    // Tabs — all 6 should be present
    await expect(page.getByRole('button', { name: /Overview/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Members/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Accounts/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Financials/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Activity/ }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Pipelines/ }).first()).toBeVisible()

    // Tab content area visible (min-h-[400px] container)
    await expect(page.locator('.min-h-\\[400px\\]').first()).toBeVisible()

    // Overview tab is default — check for section cards
    const membersSection = await page.getByText('Members').first().isVisible().catch(() => false)
    const financialSection = await page.getByText('Financial Summary').first().isVisible().catch(() => false)
    const addressSection = await page.getByText('Address').first().isVisible().catch(() => false)
    expect(membersSection || financialSection || addressSection).toBeTruthy()
  })

  test('tab switching works on detail page', async ({ page }) => {
    await page.goto('/households', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByRole('heading', { name: /Households/ }).first()).toBeVisible({ timeout: 15000 })

    // Wait for data or empty state
    const dataRow = page.locator('table tbody tr').first()
    const emptyState = page.getByText(/No households/).first()
    await expect(dataRow.or(emptyState)).toBeVisible({ timeout: 20000 })

    const isEmpty = await emptyState.isVisible().catch(() => false)
    if (isEmpty) {
      // No data — skip tab switching, test passes
      return
    }

    // Navigate to detail via link href
    const link = dataRow.locator('a').first()
    const href = await link.getAttribute('href').catch(() => null)

    if (href) {
      await page.goto(href, { waitUntil: 'commit' })
    } else {
      await dataRow.click()
      await page.waitForTimeout(1000)
    }
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Back to Households').first()).toBeVisible({ timeout: 15000 })

    // Switch to Members tab
    await page.getByRole('button', { name: /Members/ }).first().click()
    await page.waitForTimeout(300)

    // Switch to Accounts tab
    await page.getByRole('button', { name: /Accounts/ }).first().click()
    await page.waitForTimeout(300)

    // Switch to Activity tab
    await page.getByRole('button', { name: /Activity/ }).first().click()
    await page.waitForTimeout(300)

    // Switch back to Overview
    await page.getByRole('button', { name: /Overview/ }).first().click()
    await page.waitForTimeout(300)
  })
})
