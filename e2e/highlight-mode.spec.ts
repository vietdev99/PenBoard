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

  // Shift+H toggles highlight mode (state-agnostic)
  test('HIGHLIGHT-02: Shift+H toggles Show Connections state', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    // Read current state
    const initialState = await showConnBtn.getAttribute('aria-pressed')
    // Press Shift+H — should flip the state
    await page.keyboard.press('Shift+H')
    const expectedAfter = initialState === 'true' ? 'false' : 'true'
    await expect(showConnBtn).toHaveAttribute('aria-pressed', expectedAfter)
  })

  // Shift+H twice returns to original state
  test('HIGHLIGHT-03: Shift+H double-toggle returns to original state', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    const initialState = await showConnBtn.getAttribute('aria-pressed')
    await page.keyboard.press('Shift+H')
    await page.keyboard.press('Shift+H')
    await expect(showConnBtn).toHaveAttribute('aria-pressed', initialState!)
  })

  // Clicking the button toggles state
  test('HIGHLIGHT-04: clicking Show Connections button toggles it', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    const initialState = await showConnBtn.getAttribute('aria-pressed')
    await showConnBtn.click()
    const expectedAfter = initialState === 'true' ? 'false' : 'true'
    await expect(showConnBtn).toHaveAttribute('aria-pressed', expectedAfter)
    // Toggle back
    await showConnBtn.click()
    await expect(showConnBtn).toHaveAttribute('aria-pressed', initialState!)
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
  test('HIGHLIGHT-06: highlight mode toggles cleanly after page switch', async ({ page }) => {
    const showConnBtn = page.getByRole('button', { name: /show connections|toggle connections/i })
    const initialState = await showConnBtn.getAttribute('aria-pressed')
    // Toggle on (flip state once)
    await page.keyboard.press('Shift+H')
    const stateAfterFirst = initialState === 'true' ? 'false' : 'true'
    await expect(showConnBtn).toHaveAttribute('aria-pressed', stateAfterFirst)

    // Add and navigate to another page
    await addPage(page, 'screen')
    // Editor should still be functional
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()

    // Toggle back to original
    await page.keyboard.press('Shift+H')
    await expect(showConnBtn).toHaveAttribute('aria-pressed', initialState!)
  })
})
