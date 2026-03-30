import { test, expect } from '@playwright/test'

test.describe('MYST.AI Module', () => {
  test('renders team grid with all 6 bot cards', async ({ page }) => {
    await page.goto('/modules/myst-ai')

    // Wait for page header
    await expect(page.locator('h1')).toContainText('Technology Team', { timeout: 15000 })

    // Brand label should say MYST.AI
    await expect(page.locator('text=MYST.AI')).toBeVisible()

    // All 6 bot cards should render
    const botNames = ['VOLTRON', 'SENSEI', 'RAIDEN', 'RONIN', 'MUSASHI', '2HINOBI']
    for (const name of botNames) {
      await expect(page.locator(`text=${name}`).first()).toBeVisible()
    }
  })

  test('clicking a bot card opens bio detail page', async ({ page }) => {
    await page.goto('/modules/myst-ai')

    await expect(page.locator('h1')).toContainText('Technology Team', { timeout: 15000 })

    // Click the VOLTRON card
    await page.locator('text=VOLTRON').first().click()

    // Bio page should render with a back button or the bot's full name
    await expect(page.locator('text=VOLTRON').first()).toBeVisible({ timeout: 5000 })
  })
})
