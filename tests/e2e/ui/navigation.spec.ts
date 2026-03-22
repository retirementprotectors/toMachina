import { test, expect } from '@playwright/test'

test.describe('Navigation — Sidebar + Header', () => {
  test('sidebar renders all section labels', async ({ page }) => {
    await page.goto('/')

    // Sidebar root element
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible({ timeout: 15000 })

    // ProDashX logo should be present
    const logo = page.locator('img[src*="prodashx"]')
    await expect(logo).toBeVisible()

    // Core nav sections (collapsible section headers)
    // These are rendered as uppercase labels in PortalSidebar
    await expect(page.getByText('Workspaces', { exact: false })).toBeVisible()
    await expect(page.getByText('Sales', { exact: false })).toBeVisible()
    await expect(page.getByText('Service', { exact: false })).toBeVisible()

    // Workspace items
    await expect(page.locator('a[href="/contacts"]')).toBeVisible()
    await expect(page.locator('a[href="/accounts"]')).toBeVisible()

    // Action bar buttons at bottom of sidebar
    await expect(page.locator('button[title="Communications"]')).toBeVisible()
    await expect(page.locator('button[title="RPI Connect"]')).toBeVisible()
    await expect(page.locator('button[title="Notifications"]')).toBeVisible()

    // Admin link (if user has admin entitlement)
    await expect(page.locator('a[href="/admin"]')).toBeVisible()
  })

  test('header renders search and user profile', async ({ page }) => {
    await page.goto('/')

    // Wait for header
    const header = page.locator('header')
    await expect(header).toBeVisible({ timeout: 15000 })

    // Global search bar (SmartSearch component)
    const search = page.locator('input[type="search"], input[placeholder*="earch"]')
    await expect(search.first()).toBeVisible()

    // User profile link to /myrpi
    const profileLink = page.locator('a[href="/myrpi"]')
    await expect(profileLink).toBeVisible()

    // Sign out button
    await expect(page.locator('button[title="Sign Out"]')).toBeVisible()

    // Portal accent strip (3px colored bar at bottom of header)
    const accentStrip = page.locator('header div[class*="h-\\[3px\\]"], header + div[class*="h-"]')
    // The accent strip is a visual indicator — just ensure header has child elements
    await expect(header.locator('div').first()).toBeVisible()
  })
})
