import { test, expect } from '@playwright/test'

test.describe('Navigation — Sidebar + Header', () => {
  test('sidebar renders section labels and action bar', async ({ page }) => {
    await page.goto('/')

    // Sidebar root element (PortalSidebar renders as <aside>)
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 15000 })

    // ProDashX logo should be present (img with "prodashx" in src)
    const logo = sidebar.locator('img[src*="prodashx"]')
    await expect(logo).toBeVisible()

    // Core nav section: "Workspaces" header should always be visible
    const workspacesHeader = sidebar.getByText('Workspaces', { exact: false })
    await expect(workspacesHeader).toBeVisible()

    // Workspaces section defaults to collapsed — expand it to verify nav items
    await workspacesHeader.click()
    await expect(sidebar.locator('a[href="/contacts"]')).toBeVisible({ timeout: 5000 })
    await expect(sidebar.locator('a[href="/accounts"]')).toBeVisible()

    // Action bar buttons at bottom of sidebar (using title attributes)
    await expect(sidebar.locator('button[title="Communications"]')).toBeVisible()
    await expect(sidebar.locator('button[title="RPI Connect"]')).toBeVisible()
    await expect(sidebar.locator('button[title="Notifications"]')).toBeVisible()
  })

  test('header renders search and user profile', async ({ page }) => {
    await page.goto('/')

    // Wait for header (TopBar renders a <header> inside a wrapper div)
    const header = page.locator('header')
    await expect(header).toBeVisible({ timeout: 15000 })

    // Global search bar (SmartSearch component)
    const search = page.locator('input[type="search"], input[placeholder*="earch"]')
    await expect(search.first()).toBeVisible()

    // User profile link to /myrpi (TopBar renders a Link to /myrpi with title="My RPI")
    const profileLink = page.locator('a[href="/myrpi"]')
    await expect(profileLink).toBeVisible()

    // Sign out button (title="Sign Out")
    await expect(page.locator('button[title="Sign Out"]')).toBeVisible()
  })
})
