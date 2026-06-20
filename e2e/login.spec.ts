import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'

test('admin can log in with seeded credentials', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Welcome back')).toBeVisible()

  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByLabel('Password').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText('Welcome back')).not.toBeVisible()
})
