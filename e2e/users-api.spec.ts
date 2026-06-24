import { test, expect } from '@playwright/test'
import { ADMIN, AGENT } from './credentials'

// Direct API-level checks for GET /api/users, complementing the UI-level
// checks in authorization.spec.ts (which prove the "Users" nav link is
// hidden from agents and that /user redirects them away). Those UI checks
// don't prove the underlying data is unreachable -- only that the app
// chooses not to show it. These tests hit the endpoint directly via the
// `request` fixture, independent of any page, to prove the data itself is
// gated server-side.
test.describe('GET /api/users authorization', () => {
  test('an unauthenticated request is rejected with 401', async ({ request }) => {
    const response = await request.get('/api/users')

    expect(response.status()).toBe(401)
  })

  test('a logged-in non-admin (agent) request is rejected with 403', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: AGENT.email, password: AGENT.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.get('/api/users')

    expect(response.status()).toBe(403)
  })

  test('a logged-in admin request succeeds with both seeded users', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.get('/api/users')
    expect(response.ok()).toBe(true)

    const users = await response.json()
    const admin = users.find((u: { email: string }) => u.email === ADMIN.email)
    const agent = users.find((u: { email: string }) => u.email === AGENT.email)

    expect(admin).toMatchObject({ name: 'Admin', email: ADMIN.email, role: 'ADMIN' })
    expect(agent).toMatchObject({ name: 'Agent', email: AGENT.email, role: 'AGENT' })

    // Explicit Prisma `select` on the backend -- assert no sensitive fields
    // (password hash, session/account internals, etc.) leak onto the shape.
    for (const user of [admin, agent]) {
      expect(Object.keys(user).sort()).toEqual(
        ['createdAt', 'email', 'emailVerified', 'id', 'name', 'role'].sort(),
      )
    }
  })
})

// Same requireRole(Role.ADMIN) gate as GET /api/users, proven directly
// against the endpoint rather than via the UI's Add user dialog.
test.describe('POST /api/users authorization', () => {
  test('an unauthenticated request is rejected with 401', async ({ request }) => {
    const response = await request.post('/api/users', {
      data: { name: 'Nobody', email: 'nobody@example.com', password: 'password123' },
    })

    expect(response.status()).toBe(401)
  })

  test('a logged-in non-admin (agent) request is rejected with 403', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: AGENT.email, password: AGENT.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.post('/api/users', {
      data: { name: 'Nobody', email: 'nobody@example.com', password: 'password123' },
    })

    expect(response.status()).toBe(403)
  })

  test('a logged-in admin request creates a new agent user', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const email = `e2e-api-user-${Date.now()}@example.com`
    const response = await request.post('/api/users', {
      data: { name: 'E2E Api User', email, password: 'password123' },
    })

    expect(response.status()).toBe(201)

    const user = await response.json()
    expect(user).toMatchObject({ name: 'E2E Api User', email, role: 'AGENT', emailVerified: true })

    // Explicit Prisma `select` on the backend -- assert no sensitive fields
    // (password hash, session/account internals, etc.) leak onto the shape.
    expect(Object.keys(user).sort()).toEqual(
      ['createdAt', 'email', 'emailVerified', 'id', 'name', 'role'].sort(),
    )
  })
})
