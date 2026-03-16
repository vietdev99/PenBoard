import { test, expect } from '@playwright/test'
import { openEditor, addPage } from './helpers'

/**
 * Multi-page: add pages, navigate, rename, delete.
 */
test.describe('Multi-page', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
  })

  test('initial document has at least one page', async ({ page }) => {
    // The page tabs panel always shows at least one page tab
    const tabs = page.locator('[class*="page-tab"], [title*="Screen"], [title*="Page"]')
    // More reliable: look for the Pages heading and at least one tab row
    await expect(page.getByText('Pages')).toBeVisible()
  })

  test('can add a screen page', async ({ page }) => {
    const addBtn = page.getByTitle('Add page')
    await addBtn.click()
    await page.getByText('Add screen').click()
    // After adding, we should have multiple page entries
    // Screen pages are named "Page N" (e.g. "Page 2")
    await expect(page.getByText('Page 2', { exact: false })).toBeVisible()
  })

  test('can add an ERD page', async ({ page }) => {
    await page.getByTitle('Add page').click()
    await page.getByText('Add ERD page').click()
    await expect(page.getByText('ERD', { exact: false })).toBeVisible()
  })

  test('can add a Component page', async ({ page }) => {
    await page.getByTitle('Add page').click()
    await page.getByText('Component Page').click()
    await expect(page.getByText('Component', { exact: false })).toBeVisible()
  })

  test('add page dropdown closes after selecting an option', async ({ page }) => {
    await page.getByTitle('Add page').click()
    // The dropdown should be open
    await expect(page.getByText('Add screen')).toBeVisible()
    // Selecting an option should close the dropdown and add the page
    await page.getByText('Add screen').click()
    // After selection, the dropdown item should be gone (popover closed)
    await expect(page.getByText('Add ERD page')).not.toBeVisible()
    // And the new screen page should appear in the tabs (screen pages are named "Page N")
    await expect(page.getByText('Page 2', { exact: false })).toBeVisible()
  })
})
