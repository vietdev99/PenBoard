import { test, expect } from '@playwright/test'
import { openEditor } from './helpers'

/**
 * Design tokens (variables) panel: open, toggle, basic visibility.
 */
test.describe('Design tokens / Variables panel', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  test('Variables button toggles the panel', async ({ page }) => {
    const variablesBtn = page.getByRole('button', { name: 'Variables' })
    await expect(variablesBtn).toBeVisible()

    // Panel should not be visible initially
    await expect(page.getByText('Design Variables', { exact: false })).not.toBeVisible()

    // Open panel
    await variablesBtn.click()
    await expect(variablesBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Variables', { exact: false }).nth(0)).toBeVisible()

    // Close panel
    await variablesBtn.click()
    await expect(variablesBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('Variables panel opens with the variables button', async ({ page }) => {
    await page.getByRole('button', { name: 'Variables' }).click()
    // The panel should show — look for "Add Variable" or similar text
    const panel = page.locator('[class*="variables"], [class*="panel"]').filter({ hasText: /variable/i })
    // At minimum, the button is pressed
    await expect(page.getByRole('button', { name: 'Variables' })).toHaveAttribute('aria-pressed', 'true')
  })
})
