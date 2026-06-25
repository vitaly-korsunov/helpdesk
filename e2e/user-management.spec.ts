import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'

// Dedicated happy-path coverage for the full user-management CRUD lifecycle,
// read as one continuous admin workflow against a single user. Validation
// errors, authorization failures, and other edge cases are already covered
// in e2e/ui.spec.ts ("add/edit/delete user dialog" describe blocks) and
// e2e/users-api.spec.ts -- this file deliberately does not duplicate those.
test.describe('user management (happy path)', () => {
  test('admin can create, view, update, and delete a user', async ({ page }) => {
    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')
    await usersLoaded

    const countLocator = page.getByText(/total$/)
    const before = await countLocator.textContent()
    const beforeCount = Number(before?.match(/^(\d+) total$/)?.[1])
    expect(Number.isNaN(beforeCount)).toBe(false)

    const originalEmail = `e2e-mgmt-${Date.now()}@example.com`
    const originalName = `E2E Mgmt User ${Date.now()}`
    const password = 'password123'

    // --- Create -----------------------------------------------------------
    await page.getByRole('button', { name: 'Add user' }).click()
    const addDialog = page.getByRole('dialog')
    await expect(addDialog.getByText('Add user')).toBeVisible()

    await addDialog.getByLabel('Name').fill(originalName)
    await addDialog.getByLabel('Email').fill(originalEmail)
    await addDialog.getByLabel('Password').fill(password)

    const userCreated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Create user' }).click()
    await userCreated

    await expect(addDialog).not.toBeVisible()
    await expect(countLocator).toHaveText(`${beforeCount + 1} total`)

    // --- Read ---------------------------------------------------------------
    // Verify the new row renders with correct data in every column: name,
    // email, an AGENT role badge, and a non-empty created date.
    const row = page.getByRole('row').filter({ hasText: originalEmail })
    await expect(row).toBeVisible()
    await expect(row.getByRole('cell').nth(0)).toHaveText(originalName)
    await expect(row.getByRole('cell').nth(1)).toHaveText(originalEmail)
    await expect(row.getByRole('cell', { name: 'AGENT', exact: true })).toBeVisible()
    await expect(row.getByRole('cell').nth(3)).not.toBeEmpty()

    // --- Update ---------------------------------------------------------------
    const updatedEmail = `e2e-mgmt-updated-${Date.now()}@example.com`
    // Deliberately avoid the substring "Name" in the new name (see
    // project memory: it would permanently collide with unscoped
    // getByLabel('Name') matching this row's "Edit <name>" button by
    // accessible-name substring in future runs against this never-reset DB).
    const updatedName = `E2E Mgmt Updated ${Date.now()}`

    await row.getByRole('button', { name: `Edit ${originalName}`, exact: true }).click()
    const editDialog = page.getByRole('dialog')
    await expect(editDialog.getByText('Edit user')).toBeVisible()
    await expect(page.locator('#edit-name')).toHaveValue(originalName)
    await expect(page.locator('#edit-email')).toHaveValue(originalEmail)
    await expect(page.locator('#edit-password')).toHaveValue('')

    await page.locator('#edit-name').fill(updatedName)
    await page.locator('#edit-email').fill(updatedEmail)
    // Password intentionally left blank -- update should not change it.

    const userUpdated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save changes' }).click()
    await userUpdated

    await expect(editDialog).not.toBeVisible()

    const updatedRow = page.getByRole('row').filter({ hasText: updatedEmail })
    await expect(updatedRow).toBeVisible()
    await expect(updatedRow.getByRole('cell').nth(0)).toHaveText(updatedName)
    await expect(updatedRow.getByRole('cell').nth(1)).toHaveText(updatedEmail)
    await expect(updatedRow.getByRole('cell', { name: 'AGENT', exact: true })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: originalEmail })).not.toBeVisible()

    // Table-wide total is unchanged by an update.
    await expect(countLocator).toHaveText(`${beforeCount + 1} total`)

    // --- Delete ---------------------------------------------------------------
    await updatedRow.getByRole('button', { name: `Delete ${updatedName}`, exact: true }).click()
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog.getByText('Delete user')).toBeVisible()
    await expect(
      alertDialog.getByText(`Are you sure you want to delete ${updatedName}? They will lose access immediately.`),
    ).toBeVisible()

    const userDeleted = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'DELETE',
    )
    await alertDialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await userDeleted

    await expect(alertDialog).not.toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: updatedEmail })).not.toBeVisible()
    await expect(countLocator).toHaveText(`${beforeCount} total`)
  })
})
