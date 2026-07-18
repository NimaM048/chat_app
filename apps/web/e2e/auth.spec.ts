import { expect, test } from '@playwright/test'

test.describe('auth smoke', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible()
    await expect(page.getByLabel(/email or username/i)).toBeVisible()
  })
})
