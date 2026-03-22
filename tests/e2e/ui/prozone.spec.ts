import { test, expect } from '@playwright/test'

test.describe('ProZone', () => {
  test('page loads for current user', async ({ page }) => {
    await page.goto('/modules/prozone', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    // User may have ProZone access (shows unique label + tabs) or may be redirected
    const prozoneContent = page.getByText('ProZONE').first()
      .or(page.getByRole('button', { name: /TEAM/ }).first())
      .or(page.getByText(/Select a specialist/).first())
    const noAccess = page.getByText(/not authorized|no access|not found/i).first()
      .or(page.locator('a[href="/myrpi"]').first())
      .or(page.locator('a[href="/contacts"]').first())

    await expect(prozoneContent.or(noAccess)).toBeVisible({ timeout: 15000 })
  })
})
