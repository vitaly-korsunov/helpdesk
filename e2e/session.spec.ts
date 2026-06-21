import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'

test('an authenticated session persists across a page reload', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password)

  await page.reload()

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText('Welcome back')).not.toBeVisible()
})

test('an unauthenticated user landing directly on a deep path sees the login form', async ({
  page,
}) => {
  await page.goto('/user')

  await expect(page.getByText('Welcome back')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).not.toBeVisible()
})
