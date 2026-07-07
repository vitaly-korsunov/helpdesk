import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'
import { prisma } from './db'

// Helper matchers kept local (this suite's convention is one set of small
// helpers per file, not a shared test-utils module -- see prior entries in
// the playwright-e2e-writer memory for the same call made explicitly
// elsewhere). `endsWith` (not `includes`) is required here: the list
// endpoint (`/api/tickets`) is a literal prefix of the detail endpoint
// (`/api/tickets/123`), so an `includes('/api/tickets')` check -- the
// pattern used throughout tickets-page.spec.ts -- would also match detail
// requests and vice versa. `endsWith` disambiguates them cleanly since
// ticket ids are always the final path segment with no trailing slash or
// query string (confirmed via `TicketDetailPage.tsx`'s plain
// `api.get('/tickets/${id}')` call).
function ticketsListResponse(page: import('@playwright/test').Page, method: 'GET') {
  return page.waitForResponse(
    (res) => res.url().endsWith('/api/tickets') && res.request().method() === method,
  )
}

function ticketDetailResponse(
  page: import('@playwright/test').Page,
  id: number,
  method: 'GET' | 'PATCH',
) {
  return page.waitForResponse(
    (res) => res.url().endsWith(`/api/tickets/${id}`) && res.request().method() === method,
  )
}

test.describe('ticket detail page', () => {
  test('clicking a ticket subject on the tickets list navigates to its detail page', async ({
    page,
  }) => {
    const ticket = await prisma.ticket.create({
      data: { subject: `e2e-detail-nav-${Date.now()}` },
    })

    // Home (login()'s landing page) fires its own GET /api/tickets on mount.
    // Register+await this wait before/after login() so no in-flight request
    // is left to falsely satisfy the next wait registered below (the same
    // race class documented at length elsewhere in this suite's memory).
    const homeTicketsLoaded = ticketsListResponse(page, 'GET')
    await login(page, ADMIN.email, ADMIN.password)
    await homeTicketsLoaded

    const ticketsLoadedOnPage = ticketsListResponse(page, 'GET')
    await page.goto('/tickets')
    await ticketsLoadedOnPage

    const row = page.getByRole('row').filter({ hasText: ticket.subject })
    await expect(row).toBeVisible()

    const ticketLoaded = ticketDetailResponse(page, ticket.id, 'GET')
    await row.getByRole('link').click()
    await ticketLoaded

    await expect(page).toHaveURL(`/tickets/${ticket.id}`)
    await expect(page.getByText(`#${ticket.id}`)).toBeVisible()
    // Not `exact: true`: the subject is a plain text node rendered as a
    // sibling of the "#<id>" chip inside the same CardTitle div, so the
    // div's full text content is "#<id> <subject>", not the subject alone.
    await expect(page.getByText(ticket.subject)).toBeVisible()
  })

  test('renders category, requester info, and the message thread in order', async ({ page }) => {
    const requesterEmail = `e2e-detail-thread-${Date.now()}@example.com`
    const ticket = await prisma.ticket.create({
      data: {
        subject: `e2e-detail-thread-${Date.now()}`,
        category: 'BUG',
        requesterName: 'Jane E2E Requester',
        requesterEmail,
      },
    })
    await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, fromEmail: 'first-sender@example.com', body: 'First message body' },
    })
    await prisma.ticketMessage.create({
      data: { ticketId: ticket.id, fromEmail: 'second-sender@example.com', body: 'Second message body' },
    })

    const homeTicketsLoaded = ticketsListResponse(page, 'GET')
    await login(page, ADMIN.email, ADMIN.password)
    await homeTicketsLoaded

    const ticketLoaded = ticketDetailResponse(page, ticket.id, 'GET')
    await page.goto(`/tickets/${ticket.id}`)
    await ticketLoaded

    await expect(page.getByText('BUG', { exact: true })).toBeVisible()
    await expect(page.getByText('Jane E2E Requester')).toBeVisible()
    await expect(page.getByText(`<${requesterEmail}>`)).toBeVisible()

    // Messages render as a real <ol>/<li> thread (implicit list/listitem
    // ARIA roles) -- confirmed via TicketDetailPage.tsx's `<ol><li>` markup.
    const messages = page.getByRole('listitem')
    await expect(messages).toHaveCount(2)
    await expect(messages.nth(0)).toContainText('first-sender@example.com')
    await expect(messages.nth(0)).toContainText('First message body')
    await expect(messages.nth(1)).toContainText('second-sender@example.com')
    await expect(messages.nth(1)).toContainText('Second message body')
  })

  test('changing the status via the detail page dropdown persists and is reflected on the tickets list', async ({
    page,
  }) => {
    const ticket = await prisma.ticket.create({
      data: { subject: `e2e-detail-status-${Date.now()}` },
    })

    const homeTicketsLoaded = ticketsListResponse(page, 'GET')
    await login(page, ADMIN.email, ADMIN.password)
    await homeTicketsLoaded

    const ticketLoaded = ticketDetailResponse(page, ticket.id, 'GET')
    await page.goto(`/tickets/${ticket.id}`)
    await ticketLoaded

    const statusSelect = page.getByRole('combobox', { name: 'Ticket status' })
    await expect(statusSelect).toHaveText('open')

    const statusUpdated = ticketDetailResponse(page, ticket.id, 'PATCH')
    await statusSelect.click()
    await page.getByRole('option', { name: 'resolved', exact: true }).click()
    await statusUpdated

    // Reload (a fresh mount, fresh fetch) rather than trusting the client
    // cache's optimistic UI, to prove the change genuinely persisted
    // server-side.
    const ticketReloaded = ticketDetailResponse(page, ticket.id, 'GET')
    await page.reload()
    await ticketReloaded
    await expect(page.getByRole('combobox', { name: 'Ticket status' })).toHaveText('resolved')

    const ticketsListLoaded = ticketsListResponse(page, 'GET')
    await page.goto('/tickets')
    await ticketsListLoaded

    const row = page.getByRole('row').filter({ hasText: ticket.subject })
    await expect(
      row.getByRole('combobox', { name: `Status for ${ticket.subject}` }),
    ).toHaveText('resolved')
  })

  test('the Back to tickets link returns to the tickets list', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: { subject: `e2e-detail-back-${Date.now()}` },
    })

    const homeTicketsLoaded = ticketsListResponse(page, 'GET')
    await login(page, ADMIN.email, ADMIN.password)
    await homeTicketsLoaded

    const ticketLoaded = ticketDetailResponse(page, ticket.id, 'GET')
    await page.goto(`/tickets/${ticket.id}`)
    await ticketLoaded

    const ticketsListLoaded = ticketsListResponse(page, 'GET')
    await page.getByRole('link', { name: 'Back to tickets' }).click()
    await ticketsListLoaded

    await expect(page).toHaveURL('/tickets')
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible()
  })

  test('a ticket with no messages shows the empty-conversation message', async ({ page }) => {
    const ticket = await prisma.ticket.create({
      data: { subject: `e2e-detail-empty-${Date.now()}` },
    })

    const homeTicketsLoaded = ticketsListResponse(page, 'GET')
    await login(page, ADMIN.email, ADMIN.password)
    await homeTicketsLoaded

    const ticketLoaded = ticketDetailResponse(page, ticket.id, 'GET')
    await page.goto(`/tickets/${ticket.id}`)
    await ticketLoaded

    await expect(page.getByText('No messages on this ticket yet.')).toBeVisible()
  })

  test('visiting a nonexistent ticket id shows the not-found message', async ({ page }) => {
    // `helpdesk_test` is never truncated between runs, so pick an id well
    // beyond the current autoincrement high-water mark rather than a fixed
    // guess -- avoids ever colliding with a real row from a prior session.
    const { _max } = await prisma.ticket.aggregate({ _max: { id: true } })
    const nonexistentId = (_max.id ?? 0) + 1_000_000

    const homeTicketsLoaded = ticketsListResponse(page, 'GET')
    await login(page, ADMIN.email, ADMIN.password)
    await homeTicketsLoaded

    const ticketLoaded = ticketDetailResponse(page, nonexistentId, 'GET')
    await page.goto(`/tickets/${nonexistentId}`)
    await ticketLoaded

    await expect(
      page.getByText("This ticket doesn't exist. It may have been removed."),
    ).toBeVisible()
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
