import { test, expect } from '@playwright/test'
import { openEditor } from './helpers'

/**
 * Smoke tests: editor loads and core UI elements are present.
 */
test.describe('Editor — loads', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  test('renders the canvas element', async ({ page }) => {
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
  })

  test('renders the toolbar with core tools', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Select' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Text' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Frame' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hand' })).toBeVisible()
  })

  test('select tool is active by default', async ({ page }) => {
    const selectBtn = page.getByRole('button', { name: 'Select' })
    await expect(selectBtn).toHaveAttribute('aria-pressed', 'true')
  })

  test('renders the page tabs panel', async ({ page }) => {
    await expect(page.getByText('Pages')).toBeVisible()
  })

  test('renders the status bar', async ({ page }) => {
    // Status bar shows zoom percentage
    await expect(page.getByText(/%/)).toBeVisible()
  })
})
