import { test, expect } from '@playwright/test'
import { openEditor, addPage } from './helpers'

/**
 * Highlight mode — SHARED-02 (connection highlight / show-connections toggle).
 * Tests Shift+H toggles the "Show Connections" mode and the toolbar button
 * reflects the active state. No screenshot comparison needed — state-based tests.
 */
test.describe('Highlight mode (Show Connections)', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  // Verify the "Show Connections" button exists in the toolbar
  test('HIGHLIGHT-01: Show Connections button is visible in toolbar', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    await expect(showConnBtn).toBeVisible()
  })

  // Shift+H activates highlight mode
  test('HIGHLIGHT-02: Shift+H toggles Show Connections on', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    // Initially off
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'false')
    // Press Shift+H
    await page.keyboard.press('Shift+H')
    // Button should now be active
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // Shift+H again turns it off
  test('HIGHLIGHT-03: Shift+H toggles Show Connections off', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    // Turn on
    await page.keyboard.press('Shift+H')
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'true')
    // Turn off
    await page.keyboard.press('Shift+H')
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'false')
  })

  // Clicking the button toggles state
  test('HIGHLIGHT-04: clicking Show Connections button toggles it', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'false')
    await showConnBtn.click()
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'true')
    await showConnBtn.click()
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'false')
  })

  // No JS errors when highlight mode is active with multiple pages
  test('HIGHLIGHT-05: highlight mode with multiple pages does not throw', async ({ page }) => {
    // Listen for uncaught exceptions
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await addPage(page, 'screen')
    await page.keyboard.press('Shift+H')
    // Wait a moment for any rendering to complete
    await page.waitForTimeout(500)

    expect(errors).toHaveLength(0)
  })

  // Highlight mode survives page navigation
  test('HIGHLIGHT-06: highlight mode toggles off cleanly after page switch', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    await page.keyboard.press('Shift+H')
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'true')

    // Add and navigate to another page
    await addPage(page, 'screen')
    // Editor should still be functional
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()

    // Toggle off
    await page.keyboard.press('Shift+H')
    await expect(showConnBtn).toHaveAttribute('aria-pressed', 'false')
  })
})
