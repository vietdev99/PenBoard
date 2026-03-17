import { test, expect } from '@playwright/test'
import { openEditor } from './helpers'

/**
 * Canvas tool switching via toolbar buttons.
 * Validates aria-pressed state changes when tools are selected.
 */
test.describe('Canvas tools', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  test('clicking Text tool activates it', async ({ page }) => {
    const textBtn = page.getByRole('button', { name: 'Text' })
    await textBtn.click()
    await expect(textBtn).toHaveAttribute('aria-pressed', 'true')
    // Select tool should no longer be active
    await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('clicking Frame tool activates it', async ({ page }) => {
    const frameBtn = page.getByRole('button', { name: 'Frame' })
    await frameBtn.click()
    await expect(frameBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('clicking Hand tool activates it', async ({ page }) => {
    const handBtn = page.getByRole('button', { name: 'Hand' })
    await handBtn.click()
    await expect(handBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('pressing V keyboard shortcut activates Select tool', async ({ page }) => {
    // First activate a different tool
    await page.getByRole('button', { name: 'Frame' }).click()
    // Press V to switch back to Select
    await page.keyboard.press('v')
    await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('pressing F keyboard shortcut activates Frame tool', async ({ page }) => {
    await page.keyboard.press('f')
    await expect(page.getByRole('button', { name: 'Frame' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('pressing T keyboard shortcut activates Text tool', async ({ page }) => {
    await page.keyboard.press('t')
    await expect(page.getByRole('button', { name: 'Text' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('pressing H keyboard shortcut activates Hand tool', async ({ page }) => {
    await page.keyboard.press('h')
    await expect(page.getByRole('button', { name: 'Hand' })).toHaveAttribute('aria-pressed', 'true')
  })
})
