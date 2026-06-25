import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'
import { login } from './helpers'

// Must match server/.env.test's INBOUND_EMAIL_SECRET. Hardcoded rather than
// read from the .env file at test time -- this is a fixed test-fixture value
// (not a real secret), and keeping it a plain literal avoids adding a dotenv
// dependency/file-parsing step just for one constant. If server/.env.test's
// value ever changes, this constant needs to be updated to match.
const INBOUND_SECRET = 'test-inbound-secret'

async function signInAdmin(request: import('@playwright/test').APIRequestContext) {
  const signIn = await request.post('/api/auth/sign-in/email', {
    data: { email: ADMIN.email, password: ADMIN.password },
  })
  expect(signIn.ok()).toBe(true)
}

// Auth gate: requireInboundSecret (server/src/middleware.ts) is a shared-secret
// header check, completely independent of session-based requireAuth/requireRole.
// Proven directly against the endpoint via the bare `request` fixture -- no
// sign-in needed since this route takes no cookies/session at all.
test.describe('POST /api/email/inbound auth gate', () => {
  test('a request with no secret header is rejected with 401 and creates no ticket', async ({
    request,
  }) => {
    const subject = `e2e inbound no-secret ${Date.now()}`

    const response = await request.post('/api/email/inbound', {
      data: { from: 'someone@example.com', subject, text: 'body text' },
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ message: 'Unauthorized' })

    await signInAdmin(request)
    const tickets = await request.get('/api/tickets')
    expect(tickets.ok()).toBe(true)
    const list = await tickets.json()
    expect(list.find((t: { subject: string }) => t.subject === subject)).toBeUndefined()
  })

  test('a request with the wrong secret value is rejected with 401 and creates no ticket', async ({
    request,
  }) => {
    const subject = `e2e inbound wrong-secret ${Date.now()}`

    const response = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': 'not-the-real-secret' },
      data: { from: 'someone@example.com', subject, text: 'body text' },
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ message: 'Unauthorized' })

    await signInAdmin(request)
    const tickets = await request.get('/api/tickets')
    expect(tickets.ok()).toBe(true)
    const list = await tickets.json()
    expect(list.find((t: { subject: string }) => t.subject === subject)).toBeUndefined()
  })
})

// Validation: isolates inboundEmailSchema (server/src/inboundEmail.ts) from the
// auth gate above by always sending the correct secret, so a 400 here can only
// be coming from zod, not the middleware.
test.describe('POST /api/email/inbound validation', () => {
  test('a malformed sender email is rejected with 400 and the format-error message', async ({
    request,
  }) => {
    const response = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': INBOUND_SECRET },
      data: { from: 'not-an-email', subject: 'Subject', text: 'body text' },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ message: 'Enter a valid sender email' })
  })

  test('an empty subject is rejected with 400 and the required-field message', async ({
    request,
  }) => {
    // Sent as an empty string rather than omitted entirely: zod's `z.string()`
    // type check runs before `.min(1, ...)`, so an actually-missing key
    // reports "Invalid input: expected string, received undefined" instead of
    // this field's intended required-field message. An empty string is a
    // valid string, so it reaches and fails the `.min(1)` check as intended.
    const response = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': INBOUND_SECRET },
      data: { from: 'someone@example.com', subject: '', text: 'body text' },
    })

    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ message: 'Subject is required' })
  })
})

// Create -> reply -> replay: one continuous flow sharing messageId/ticketId
// state across its three phases, mirroring how this exact sequence happens in
// production (an inbound email, then a threaded reply, then the mail provider
// retrying delivery of the original). Kept as one test rather than three
// dependent tests since the shared state (ticketId, messageId) is simplest to
// pass via plain `let`/local variables within a single test function, and the
// three phases only make sense read together as one scenario.
test.describe('POST /api/email/inbound threading and deduplication', () => {
  test('a fresh email creates a ticket, a reply threads onto it, and a replay is deduplicated', async ({
    request,
  }) => {
    const uniqueId = Date.now()
    const from = `inbound-${uniqueId}@example.com`
    const subject = `E2E Inbound Subject ${uniqueId}`
    const firstMessageId = `msg-${uniqueId}-1@example.com`

    // Phase 1: fresh inbound email -> new ticket (201)
    const firstResponse = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': INBOUND_SECRET },
      data: { from, subject, text: 'First message body', messageId: firstMessageId },
    })

    expect(firstResponse.status()).toBe(201)
    const firstBody = await firstResponse.json()
    expect(typeof firstBody.ticketId).toBe('number')
    expect(firstBody).toMatchObject({ threaded: false, deduplicated: false })
    const ticketId = firstBody.ticketId as number

    await signInAdmin(request)
    const afterFirst = await request.get('/api/tickets')
    expect(afterFirst.ok()).toBe(true)
    const afterFirstList = await afterFirst.json()
    const ticketAfterFirst = afterFirstList.find((t: { id: number }) => t.id === ticketId)
    expect(ticketAfterFirst).toBeDefined()
    expect(ticketAfterFirst.requesterEmail).toBe(from)
    expect(ticketAfterFirst.messages).toHaveLength(1)
    expect(ticketAfterFirst.messages[0].fromEmail).toBe(from)
    await request.post('/api/auth/sign-out')

    // Phase 2: a reply referencing the first message threads onto the same ticket (200)
    const replyResponse = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': INBOUND_SECRET },
      data: {
        from,
        subject: `Re: ${subject}`,
        text: 'Reply body',
        messageId: `msg-${uniqueId}-2@example.com`,
        inReplyTo: firstMessageId,
      },
    })

    expect(replyResponse.status()).toBe(200)
    const replyBody = await replyResponse.json()
    expect(replyBody).toEqual({ ticketId, threaded: true, deduplicated: false })

    await signInAdmin(request)
    const afterReply = await request.get('/api/tickets')
    expect(afterReply.ok()).toBe(true)
    const afterReplyList = await afterReply.json()
    const matchingTickets = afterReplyList.filter(
      (t: { subject: string }) => normalizeForCompare(t.subject) === normalizeForCompare(subject),
    )
    expect(matchingTickets).toHaveLength(1)
    expect(matchingTickets[0].id).toBe(ticketId)
    expect(matchingTickets[0].messages).toHaveLength(2)
    await request.post('/api/auth/sign-out')

    // Phase 3: replaying the exact first request again is deduplicated (200), no new message
    const replayResponse = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': INBOUND_SECRET },
      data: { from, subject, text: 'First message body', messageId: firstMessageId },
    })

    expect(replayResponse.status()).toBe(200)
    const replayBody = await replayResponse.json()
    expect(replayBody).toEqual({ ticketId, threaded: false, deduplicated: true })

    await signInAdmin(request)
    const afterReplay = await request.get('/api/tickets')
    expect(afterReplay.ok()).toBe(true)
    const afterReplayList = await afterReplay.json()
    const ticketAfterReplay = afterReplayList.find((t: { id: number }) => t.id === ticketId)
    expect(ticketAfterReplay.messages).toHaveLength(2)
  })
})

// Helper local to this file's threading test above: a loose subject
// normalization (case-insensitive, ignores a "Re:" prefix) just for comparing
// the original and reply subjects in the assertion -- not testing
// normalizeSubject() itself (that's covered by server unit tests), just using
// an equivalent comparison so the filter-by-subject assertion works regardless
// of which of the two subject strings is used as the comparison key.
function normalizeForCompare(subject: string): string {
  return subject.trim().toLowerCase().replace(/^re:\s*/, '')
}

// UI check: a separate, independent ticket (fresh unique data, not reusing the
// threading test's fixtures) created via direct API POST, then verified
// through the actual Home page rendering -- the "via email" sender line and
// the expandable message list described in client/src/pages/Home.tsx.
test.describe('inbound email rendering in the ticket list', () => {
  test('a ticket created from an inbound email shows the sender and its message on the Home page', async ({
    page,
    request,
  }) => {
    const uniqueId = Date.now()
    const from = `inbound-ui-${uniqueId}@example.com`
    const subject = `E2E Inbound UI Subject ${uniqueId}`
    const body = `UI body text ${uniqueId}`

    const createResponse = await request.post('/api/email/inbound', {
      headers: { 'X-Inbound-Secret': INBOUND_SECRET },
      data: { from, subject, text: body, messageId: `msg-ui-${uniqueId}@example.com` },
    })
    expect(createResponse.status()).toBe(201)

    await login(page, ADMIN.email, ADMIN.password)

    const ticketRow = page.getByRole('listitem').filter({ hasText: subject })
    await expect(ticketRow).toBeVisible()
    await expect(ticketRow.getByText(`via email · ${from}`)).toBeVisible()

    const toggleButton = ticketRow.getByRole('button', { name: 'Show 1 message', exact: true })
    await expect(toggleButton).toBeVisible()
    await toggleButton.click()

    await expect(
      ticketRow.getByRole('button', { name: 'Hide 1 message', exact: true }),
    ).toBeVisible()
    await expect(ticketRow.getByText(`${from}: ${body}`)).toBeVisible()
  })
})
