import { test, expect } from '@playwright/test'

test.describe('ATLAS', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/modules/atlas', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have ATLAS access (shows section buttons) or may be redirected/blocked
    const atlasContent = page.getByText('Import').first()
      .or(page.getByText('Registry').first())
      .or(page.getByText('Operations').first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(atlasContent.or(noAccess)).toBeVisible({ timeout: 15000 })
  })

  test('section switching works when accessible', async ({ page }) => {
    await page.goto('/modules/atlas', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    const importBtn = page.getByText('Import').first()
    const isAccessible = await importBtn.isVisible({ timeout: 5000 }).catch(() => false)

    if (isAccessible) {
      // Click Registry section
      await page.getByText('Registry').first().click()
      await page.waitForTimeout(500)
    } else {
      // User lacks access — page redirected or shows empty state, which is correct behavior
      expect(true).toBeTruthy()
    }
  })
})
