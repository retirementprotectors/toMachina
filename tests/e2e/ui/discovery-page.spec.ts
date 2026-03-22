import { test, expect } from '@playwright/test'

test.describe('Discovery Kit', () => {
  test('wizard renders', async ({ page }) => {
    await page.goto('/discovery', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.getByText('Discovery Kit').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Client discovery questionnaire/).first()).toBeVisible()
  })

  test('step indicator and controls present', async ({ page }) => {
    await page.goto('/discovery', { waitUntil: 'commit' })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await expect(page.locator('input[placeholder*="earch"]').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/Step \d+ of 5/).first()).toBeVisible()

    // Next button visible but disabled on step 0 (no client selected)
    const nextBtn = page.getByRole('button', { name: /Next/ }).first()
    await expect(nextBtn).toBeVisible()
    await expect(nextBtn).toBeDisabled()
  })
})
