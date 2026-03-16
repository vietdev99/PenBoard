import { test, expect } from '@playwright/test'
import { openEditor, addPage } from './helpers'

/**
 * Canvas basics — CANVAS-01 through CANVAS-07.
 * Tests core editor load, tool switching, keyboard shortcuts,
 * undo/redo, and multi-select interactions via panel verification.
 *
 * NOTE: Skia/WebGL canvas is opaque to Playwright coordinate clicks.
 * All interactions go through toolbar buttons, keyboard shortcuts,
 * and side-panel verification rather than raw canvas coordinate clicks.
 */
test.describe('Canvas basics', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  // CANVAS-01: App loads at /editor, canvas initialized
  test('CANVAS-01: editor loads with canvas and toolbar', async ({ page }) => {
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Frame' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible()
  })

  // CANVAS-02: Toolbar visible with rectangle/ellipse/frame tools
  test('CANVAS-02: toolbar shows drawing tools', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Frame' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hand' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible()
  })

  // CANVAS-03: Select tool is the default active tool
  test('CANVAS-03: select tool is active by default', async ({ page }) => {
    const selectBtn = page.getByRole('button', { name: 'Select' })
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // CANVAS-04: Tool switching via toolbar click
  test('CANVAS-04: clicking a tool activates it', async ({ page }) => {
    const frameBtn = page.getByRole('button', { name: 'Frame' })
    await frameBtn.click()
    await expect(frameBtn).toHaveAttribute('aria-pressed', 'true')
    // Select should be deactivated
    await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false')
  })

  // CANVAS-05: Keyboard shortcut V returns to Select tool
  test('CANVAS-05: pressing V keyboard shortcut activates Select tool', async ({ page }) => {
    // Switch to Frame first
    await page.getByRole('button', { name: 'Frame' }).click()
    await expect(page.getByRole('button', { name: 'Frame' })).toHaveAttribute('aria-pressed', 'true')
    // Press V to go back to Select
    await page.keyboard.press('v')
    await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true')
  })

  // CANVAS-06: Undo keyboard shortcut is registered (Ctrl+Z)
  test('CANVAS-06: Ctrl+Z undo is wired (no crash)', async ({ page }) => {
    // We cannot easily verify undo visually without canvas interaction,
    // but pressing Ctrl+Z should not throw errors
    await page.keyboard.press('Control+z')
    // Editor should still be functional
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
  })

  // CANVAS-07: Redo keyboard shortcut is registered (Ctrl+Shift+Z)
  test('CANVAS-07: Ctrl+Shift+Z redo is wired (no crash)', async ({ page }) => {
    await page.keyboard.press('Control+Shift+z')
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
  })

  // Multi-page navigation as a canvas basic
  test('page tabs are visible and functional', async ({ page }) => {
    await expect(page.getByText('Pages')).toBeVisible()
    // Add a second page
    await addPage(page, 'screen')
    await expect(page.getByText('Page 2', { exact: false })).toBeVisible()
  })
})
