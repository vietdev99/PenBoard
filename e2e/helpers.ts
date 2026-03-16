import { type Page, expect } from '@playwright/test'

/**
 * Navigate to the editor and wait for the canvas to be ready.
 * CanvasKit/Skia WASM takes a moment to initialize.
 */
export async function openEditor(page: Page) {
  await page.goto('/editor')
  // Wait for the toolbar to be visible — indicates the editor has fully mounted
  await expect(page.getByRole('button', { name: 'Select' })).toBeVisible({ timeout: 15000 })
  // Collapse the AI chat panel if it's open — it can overlap toolbar buttons
  const collapseBtn = page.getByRole('button', { name: 'Collapse' })
  if (await collapseBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await collapseBtn.click()
    await page.waitForTimeout(150)
  }
}

/**
 * Click the "Add page" (+) button and select a page type from the dropdown.
 */
export async function addPage(page: Page, type: 'screen' | 'erd' | 'component') {
  const labelMap = { screen: 'Add screen', erd: 'Add ERD page', component: 'Component Page' }
  await page.getByTitle('Add page').click()
  await page.getByText(labelMap[type]).click()
}
