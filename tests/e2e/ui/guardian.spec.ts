import { test, expect } from '@playwright/test'

test.describe('Guardian — Data Integrity', () => {
  test('page header renders', async ({ page }) => {
    await page.goto('/admin/guardian', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('GUARDIAN').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Data integrity monitoring/).first()).toBeVisible()
  })

  test('all 5 tabs render', async ({ page }) => {
    await page.goto('/admin/guardian', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Health Overview').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Write Gate').first()).toBeVisible()
    await expect(page.getByText('Audit History').first()).toBeVisible()
    await expect(page.getByText('Alerts').first()).toBeVisible()
    await expect(page.getByText('Baselines').first()).toBeVisible()
  })

  test('tab switching works', async ({ page }) => {
    await page.goto('/admin/guardian', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Health Overview').first()).toBeVisible({ timeout: 15000 })

    // Click Write Gate tab
    await page.getByText('Write Gate').first().click()
    await page.waitForTimeout(300)

    // Click Audit History tab
    await page.getByText('Audit History').first().click()
    await page.waitForTimeout(300)
  })
})
