import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'

test('a logged-in user can create a ticket and see it in the list', async ({ page }) => {
  await login(page, ADMIN.email, ADMIN.password)

  const subject = `e2e ticket ${Date.now()}`
  await page.getByLabel('Subject').fill(subject)
  await page.getByRole('button', { name: 'Add ticket' }).click()

  const ticketRow = page.getByRole('listitem').filter({ hasText: subject })
  await expect(ticketRow).toBeVisible()
  await expect(ticketRow.getByText('open', { exact: true })).toBeVisible()
})
