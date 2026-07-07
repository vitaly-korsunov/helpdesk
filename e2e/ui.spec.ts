import { test, expect } from '@playwright/test'
import { ADMIN, AGENT } from './credentials'
import { login } from './helpers'

test.describe('navigation', () => {
  test('an admin can click the Users link and land on the Users page', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await page.getByRole('link', { name: 'Users' }).click()
    await usersLoaded

    await expect(page).toHaveURL('/user')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  })
})

test.describe('users page', () => {
  test('lists both seeded users with their email and role badge', async ({ page }) => {
    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')
    await usersLoaded

    await expect(page.getByText('Loading…')).not.toBeVisible()

    // Table has exactly 5 columns, in this order, and nothing else. The
    // trailing "Actions" column header has visually-hidden text
    // (`<span className="sr-only">`) for the row-level edit button, but is
    // still exposed to getByRole('columnheader') via its accessible name.
    const headers = page.getByRole('columnheader')
    await expect(headers).toHaveText(['Name', 'Email', 'Role', 'Created', 'Actions'])

    // Seeded users are named literally "Admin" and "Agent"; the backend
    // sorts by name ascending, so "Admin" renders before "Agent".
    // getByRole('row') also matches the header row, but filtering by the
    // seeded emails (which only appear in data rows) excludes it naturally.
    const adminRow = page.getByRole('row').filter({ hasText: ADMIN.email })
    const agentRow = page.getByRole('row').filter({ hasText: AGENT.email })

    await expect(adminRow).toBeVisible()
    await expect(adminRow).toContainText('Admin')
    await expect(adminRow.getByRole('cell', { name: 'ADMIN', exact: true })).toBeVisible()

    await expect(agentRow).toBeVisible()
    await expect(agentRow).toContainText('Agent')
    await expect(agentRow.getByRole('cell', { name: 'AGENT', exact: true })).toBeVisible()

    // Backend sorts by name ascending ("Admin" < "Agent"), so the admin row
    // should precede the agent row regardless of how many other users exist.
    const adminIndex = await adminRow.evaluate((el) =>
      Array.from(el.parentElement?.children ?? []).indexOf(el),
    )
    const agentIndex = await agentRow.evaluate((el) =>
      Array.from(el.parentElement?.children ?? []).indexOf(el),
    )
    expect(adminIndex).toBeLessThan(agentIndex)
  })

  test('shows an error state when the request fails', async ({ page }) => {
    await page.route('**/api/users', (route) => route.fulfill({ status: 500, body: '{}' }))

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    await expect(page.getByText('Failed to load users.')).toBeVisible()
  })
})

test.describe('add user dialog', () => {
  test('creating a user with valid details adds a row and increments the total count', async ({
    page,
  }) => {
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

    const email = `e2e-user-${Date.now()}@example.com`
    const name = `E2E User ${Date.now()}`

    await page.getByRole('button', { name: 'Add user' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Add user')).toBeVisible()

    await dialog.getByLabel('Name').fill(name)
    await dialog.getByLabel('Email').fill(email)
    await dialog.getByLabel('Password').fill('password123')

    const usersCreated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Create user' }).click()
    await usersCreated

    await expect(dialog).not.toBeVisible()

    const newRow = page.getByRole('row').filter({ hasText: email })
    await expect(newRow).toBeVisible()
    await expect(newRow).toContainText(name)
    await expect(newRow.getByRole('cell', { name: 'AGENT', exact: true })).toBeVisible()

    await expect(countLocator).toHaveText(`${beforeCount + 1} total`)
  })

  test('shows a validation error and does not submit when the name is too short', async ({
    page,
  }) => {
    let userRequested = false
    await page.route('**/api/users', (route) => {
      if (route.request().method() === 'POST') {
        userRequested = true
      }
      return route.continue()
    })

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    await page.getByRole('button', { name: 'Add user' }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('Name').fill('ab')
    await dialog.getByLabel('Email').fill(`e2e-user-${Date.now()}@example.com`)
    await dialog.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Create user' }).click()

    await expect(page.getByText('Name must be at least 3 characters')).toBeVisible()
    expect(userRequested).toBe(false)
    await expect(dialog).toBeVisible()
  })

  test('shows a validation error and does not submit when the email is malformed', async ({
    page,
  }) => {
    let userRequested = false
    await page.route('**/api/users', (route) => {
      if (route.request().method() === 'POST') {
        userRequested = true
      }
      return route.continue()
    })

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    await page.getByRole('button', { name: 'Add user' }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('Name').fill('E2E Test User')
    await dialog.getByLabel('Email').fill('not-an-email')
    await dialog.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Create user' }).click()

    await expect(page.getByText('Enter a valid email')).toBeVisible()
    expect(userRequested).toBe(false)
    await expect(dialog).toBeVisible()
  })

  test('shows a validation error and does not submit when the password is too short', async ({
    page,
  }) => {
    let userRequested = false
    await page.route('**/api/users', (route) => {
      if (route.request().method() === 'POST') {
        userRequested = true
      }
      return route.continue()
    })

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    await page.getByRole('button', { name: 'Add user' }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('Name').fill('E2E Test User')
    await dialog.getByLabel('Email').fill(`e2e-user-${Date.now()}@example.com`)
    await dialog.getByLabel('Password').fill('short1')
    await page.getByRole('button', { name: 'Create user' }).click()

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    expect(userRequested).toBe(false)
    await expect(dialog).toBeVisible()
  })

  test('shows a server-side conflict error when the email is already taken', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    await page.getByRole('button', { name: 'Add user' }).click()
    const dialog = page.getByRole('dialog')

    await dialog.getByLabel('Name').fill('Duplicate Email User')
    await dialog.getByLabel('Email').fill(ADMIN.email)
    await dialog.getByLabel('Password').fill('password123')

    const usersCreated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Create user' }).click()
    await usersCreated

    await expect(page.getByText('A user with this email already exists')).toBeVisible()
    await expect(dialog).toBeVisible()
  })
})

test.describe('edit user dialog', () => {
  test('opens pre-filled with the row\'s current name and email, and an empty password', async ({
    page,
  }) => {
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    const agentRow = page.getByRole('row').filter({ hasText: AGENT.email })
    await agentRow.getByRole('button', { name: 'Edit Agent', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Edit user')).toBeVisible()
    await expect(
      dialog.getByText("Update the user's details. Leave the password blank to keep it unchanged."),
    ).toBeVisible()

    await expect(page.locator('#edit-name')).toHaveValue('Agent')
    await expect(page.locator('#edit-email')).toHaveValue(AGENT.email)
    await expect(page.locator('#edit-password')).toHaveValue('')
  })

  test('changing name and email with a blank password updates the row and leaves the password unchanged', async ({
    page,
    request,
  }) => {
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    // Create a disposable user via page.request (shares the page's
    // authenticated session cookie) rather than mutating the seeded
    // ADMIN/AGENT fixtures, which other specs depend on staying stable.
    const originalEmail = `e2e-edit-${Date.now()}@example.com`
    const originalPassword = 'password123'
    const created = await page.request.post('/api/users', {
      data: { name: 'E2E Edit Target', email: originalEmail, password: originalPassword },
    })
    expect(created.ok()).toBe(true)

    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await page.reload()
    await usersLoaded

    const newEmail = `e2e-edit-updated-${Date.now()}@example.com`
    // Deliberately avoid the substring "Name" here: it would become a
    // permanent row in the (never-reset) test DB and collide with
    // getByLabel('Name') matching this row's "Edit <name>" aria-label button
    // by accessible-name substring in any future test that doesn't scope
    // getByLabel to a specific dialog.
    const newName = `E2E Edited User ${Date.now()}`

    const row = page.getByRole('row').filter({ hasText: originalEmail })
    await row.getByRole('button', { name: 'Edit E2E Edit Target', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await page.locator('#edit-name').fill(newName)
    await page.locator('#edit-email').fill(newEmail)
    await expect(page.locator('#edit-password')).toHaveValue('')

    const userUpdated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save changes' }).click()
    await userUpdated

    await expect(dialog).not.toBeVisible()

    const updatedRow = page.getByRole('row').filter({ hasText: newEmail })
    await expect(updatedRow).toBeVisible()
    await expect(updatedRow).toContainText(newName)
    await expect(page.getByRole('row').filter({ hasText: originalEmail })).not.toBeVisible()

    // API-level proof (not UI login) that the original password still works
    // -- confirms the blank password field left the credential untouched.
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: newEmail, password: originalPassword },
    })
    expect(signIn.ok()).toBe(true)
  })

  test('shows a validation error and does not submit when the name is too short', async ({
    page,
  }) => {
    let userPatched = false
    await page.route('**/api/users/**', (route) => {
      if (route.request().method() === 'PATCH') {
        userPatched = true
      }
      return route.continue()
    })

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    const agentRow = page.getByRole('row').filter({ hasText: AGENT.email })
    await agentRow.getByRole('button', { name: 'Edit Agent', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await page.locator('#edit-name').fill('ab')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Name must be at least 3 characters')).toBeVisible()
    expect(userPatched).toBe(false)
    await expect(dialog).toBeVisible()
  })

  test('shows a validation error and does not submit when the email is malformed', async ({
    page,
  }) => {
    let userPatched = false
    await page.route('**/api/users/**', (route) => {
      if (route.request().method() === 'PATCH') {
        userPatched = true
      }
      return route.continue()
    })

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    const agentRow = page.getByRole('row').filter({ hasText: AGENT.email })
    await agentRow.getByRole('button', { name: 'Edit Agent', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await page.locator('#edit-email').fill('not-an-email')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Enter a valid email')).toBeVisible()
    expect(userPatched).toBe(false)
    await expect(dialog).toBeVisible()
  })

  test('shows a validation error and does not submit when a non-empty password is too short', async ({
    page,
  }) => {
    let userPatched = false
    await page.route('**/api/users/**', (route) => {
      if (route.request().method() === 'PATCH') {
        userPatched = true
      }
      return route.continue()
    })

    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    const agentRow = page.getByRole('row').filter({ hasText: AGENT.email })
    await agentRow.getByRole('button', { name: 'Edit Agent', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await page.locator('#edit-password').fill('short1')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible()
    expect(userPatched).toBe(false)
    await expect(dialog).toBeVisible()
  })

  test('shows a server-side conflict error when editing the email to match a different user', async ({
    page,
  }) => {
    // Disposable target user, created via the API so the seeded fixtures
    // are never mutated.
    const targetEmail = `e2e-edit-conflict-${Date.now()}@example.com`

    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')
    await usersLoaded

    const usersCreated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Add user' }).click()
    const addDialog = page.getByRole('dialog')
    await addDialog.getByLabel('Name').fill('Conflict Target')
    await addDialog.getByLabel('Email').fill(targetEmail)
    await addDialog.getByLabel('Password').fill('password123')
    await page.getByRole('button', { name: 'Create user' }).click()
    await usersCreated
    await expect(page.getByRole('dialog')).not.toBeVisible()

    // Edit the target user's email to collide with the already-existing
    // AGENT fixture's email.
    const row = page.getByRole('row').filter({ hasText: targetEmail })
    await row.getByRole('button', { name: 'Edit Conflict Target', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await page.locator('#edit-email').fill(AGENT.email)

    const userPatchAttempt = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: 'Save changes' }).click()
    await userPatchAttempt

    await expect(page.getByText('A user with this email already exists')).toBeVisible()
    await expect(dialog).toBeVisible()
  })
})

test.describe('delete user dialog', () => {
  test('cancelling the confirmation leaves the row untouched and fires no request', async ({
    page,
  }) => {
    // Disposable target user, created via the API so the seeded fixtures
    // are never mutated.
    const targetEmail = `e2e-delete-cancel-${Date.now()}@example.com`
    const targetName = `E2E Delete Cancel Target ${Date.now()}`

    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')
    await usersLoaded

    const created = await page.request.post('/api/users', {
      data: { name: targetName, email: targetEmail, password: 'password123' },
    })
    expect(created.ok()).toBe(true)

    await page.reload()
    await page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )

    let deleteRequested = false
    await page.route('**/api/users/**', (route) => {
      if (route.request().method() === 'DELETE') {
        deleteRequested = true
      }
      return route.continue()
    })

    const row = page.getByRole('row').filter({ hasText: targetEmail })
    await row.getByRole('button', { name: `Delete ${targetName}`, exact: true }).click()

    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog.getByText('Delete user')).toBeVisible()
    await expect(
      alertDialog.getByText(`Are you sure you want to delete ${targetName}? They will lose access immediately.`),
    ).toBeVisible()

    await alertDialog.getByRole('button', { name: 'Cancel', exact: true }).click()

    await expect(alertDialog).not.toBeVisible()
    expect(deleteRequested).toBe(false)
    await expect(row).toBeVisible()
  })

  test('confirming deletion removes the row, decrements the total count, and the user can no longer sign in', async ({
    page,
    request,
  }) => {
    const targetEmail = `e2e-delete-confirm-${Date.now()}@example.com`
    const targetName = `E2E Delete Confirm Target ${Date.now()}`
    const targetPassword = 'password123'

    const usersLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')
    await usersLoaded

    const created = await page.request.post('/api/users', {
      data: { name: targetName, email: targetEmail, password: targetPassword },
    })
    expect(created.ok()).toBe(true)

    const usersReloaded = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'GET',
    )
    await page.reload()
    await usersReloaded

    const countLocator = page.getByText(/total$/)
    const before = await countLocator.textContent()
    const beforeCount = Number(before?.match(/^(\d+) total$/)?.[1])
    expect(Number.isNaN(beforeCount)).toBe(false)

    const row = page.getByRole('row').filter({ hasText: targetEmail })
    await row.getByRole('button', { name: `Delete ${targetName}`, exact: true }).click()

    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible()

    const userDeleted = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'DELETE',
    )
    await alertDialog.getByRole('button', { name: 'Delete', exact: true }).click()
    await userDeleted

    await expect(alertDialog).not.toBeVisible()
    await expect(row).not.toBeVisible()
    await expect(countLocator).toHaveText(`${beforeCount - 1} total`)

    // A soft-deleted user can no longer sign in.
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: targetEmail, password: targetPassword },
    })
    expect(signIn.ok()).toBe(false)
    expect(signIn.status()).toBeGreaterThanOrEqual(400)
    expect(signIn.status()).toBeLessThan(500)
  })

  test("the seeded Admin row's delete button is disabled", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)
    await page.goto('/user')

    const adminRow = page.getByRole('row').filter({ hasText: ADMIN.email })
    await expect(adminRow.getByRole('button', { name: 'Delete Admin', exact: true })).toBeDisabled()
  })
})

test.describe('health badge', () => {
  test('shows the API as reachable on a normal page load', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    await expect(page.getByText('API: ok')).toBeVisible()
  })
})

test.describe('ticket form', () => {
  test('submitting an empty subject does not create a ticket or fire a request', async ({
    page,
  }) => {
    let ticketRequested = false
    await page.route('**/api/tickets', (route) => {
      if (route.request().method() === 'POST') {
        ticketRequested = true
      }
      return route.continue()
    })

    const ticketsLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/tickets') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await ticketsLoaded

    const countText = await page.getByText(/total$/).textContent()

    await page.getByRole('button', { name: 'Add ticket' }).click()

    expect(ticketRequested).toBe(false)
    await expect(page.getByText(/total$/)).toHaveText(countText ?? '')
  })

  test('submitting a whitespace-only subject does not create a ticket or fire a request', async ({
    page,
  }) => {
    let ticketRequested = false
    await page.route('**/api/tickets', (route) => {
      if (route.request().method() === 'POST') {
        ticketRequested = true
      }
      return route.continue()
    })

    const ticketsLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/tickets') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await ticketsLoaded

    const countText = await page.getByText(/total$/).textContent()

    await page.getByLabel('Subject').fill('   ')
    await page.getByRole('button', { name: 'Add ticket' }).click()

    expect(ticketRequested).toBe(false)
    await expect(page.getByText(/total$/)).toHaveText(countText ?? '')
  })

  test('creating a ticket increments the total count by one', async ({ page }) => {
    const ticketsLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/tickets') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await ticketsLoaded

    const countLocator = page.getByText(/total$/)
    const before = await countLocator.textContent()
    const beforeCount = Number(before?.match(/^(\d+) total$/)?.[1])
    expect(Number.isNaN(beforeCount)).toBe(false)

    const subject = `e2e ticket ${Date.now()}`
    await page.getByLabel('Subject').fill(subject)
    await page.getByRole('button', { name: 'Add ticket' }).click()

    await expect(page.getByRole('listitem').filter({ hasText: subject })).toBeVisible()
    await expect(countLocator).toHaveText(`${beforeCount + 1} total`)
  })

  test('newer tickets appear before older tickets in the list', async ({ page }) => {
    const ticketsLoaded = page.waitForResponse(
      (res) => res.url().includes('/api/tickets') && res.request().method() === 'GET',
    )
    await login(page, ADMIN.email, ADMIN.password)
    await ticketsLoaded

    const subjectA = `e2e order check A ${Date.now()}`
    const subjectB = `e2e order check B ${Date.now()}`

    await page.getByLabel('Subject').fill(subjectA)
    await page.getByRole('button', { name: 'Add ticket' }).click()
    const ticketA = page.getByRole('listitem').filter({ hasText: subjectA })
    await expect(ticketA).toBeVisible()

    await page.getByLabel('Subject').fill(subjectB)
    await page.getByRole('button', { name: 'Add ticket' }).click()
    const ticketB = page.getByRole('listitem').filter({ hasText: subjectB })
    await expect(ticketB).toBeVisible()

    // B was created after A, so it has a higher id. The backend now orders
    // tickets by id descending, so B's row should precede A's row regardless
    // of how many other tickets exist in the (never-truncated) test DB.
    const indexA = await ticketA.evaluate((el) =>
      Array.from(el.parentElement?.children ?? []).indexOf(el),
    )
    const indexB = await ticketB.evaluate((el) =>
      Array.from(el.parentElement?.children ?? []).indexOf(el),
    )
    expect(indexB).toBeLessThan(indexA)
  })
})
