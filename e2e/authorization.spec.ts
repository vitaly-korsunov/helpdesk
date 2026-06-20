import { test, expect } from '@playwright/test'
import { AGENT } from './credentials'
import { login } from './helpers'

test('a non-admin agent does not see the Users link and cannot reach /user', async ({ page }) => {
  await login(page, AGENT.email, AGENT.password)

  await expect(page.getByRole('link', { name: 'Users' })).not.toBeVisible()

  await page.goto('/user')
  await expect(page).toHaveURL('/')
  await expect(page.getByRole('heading', { name: 'Users' })).not.toBeVisible()
})
