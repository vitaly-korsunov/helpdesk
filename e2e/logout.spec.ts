import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'

test('signing out clears the session', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByText('Welcome back')).toBeVisible()

  // Reload to confirm the session was actually cleared server-side,
  // not just hidden by client-side UI state.
  await page.reload()
  await expect(page.getByText('Welcome back')).toBeVisible()
})
