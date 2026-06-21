import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'

test.describe('navigation', () => {
  test('an admin can click the Users link and land on the Users page', async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password)

    await page.getByRole('link', { name: 'Users' }).click()

    await expect(page).toHaveURL('/user')
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
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
