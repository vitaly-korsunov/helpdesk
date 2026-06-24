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

    // Table has exactly 4 columns, in this order, and nothing else.
    const headers = page.getByRole('columnheader')
    await expect(headers).toHaveText(['Name', 'Email', 'Role', 'Created'])

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

    await page.getByLabel('Name').fill(name)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('password123')

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

    await page.getByLabel('Name').fill('ab')
    await page.getByLabel('Email').fill(`e2e-user-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('password123')
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

    await page.getByLabel('Name').fill('E2E Test User')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password').fill('password123')
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

    await page.getByLabel('Name').fill('E2E Test User')
    await page.getByLabel('Email').fill(`e2e-user-${Date.now()}@example.com`)
    await page.getByLabel('Password').fill('short1')
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

    await page.getByLabel('Name').fill('Duplicate Email User')
    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Password').fill('password123')

    const usersCreated = page.waitForResponse(
      (res) => res.url().includes('/api/users') && res.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Create user' }).click()
    await usersCreated

    await expect(page.getByText('A user with this email already exists')).toBeVisible()
    await expect(dialog).toBeVisible()
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
})
