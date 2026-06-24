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

// Same requireRole(Role.ADMIN) gate as GET/POST /api/users. Uses a
// disposable target user (created via POST as admin) rather than the
// seeded ADMIN/AGENT fixtures, which other specs depend on staying stable.
test.describe('PATCH /api/users/:id authorization', () => {
  async function createDisposableUser(request: import('@playwright/test').APIRequestContext) {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const email = `e2e-api-patch-target-${Date.now()}@example.com`
    const response = await request.post('/api/users', {
      data: { name: 'E2E Api Patch Target', email, password: 'password123' },
    })
    expect(response.status()).toBe(201)
    const user = await response.json()

    // Drop the admin session so callers start from a clean, unauthenticated
    // request context for whichever role they actually want to test.
    await request.post('/api/auth/sign-out')

    return user as { id: string; email: string }
  }

  test('an unauthenticated request is rejected with 401', async ({ request }) => {
    const target = await createDisposableUser(request)

    const response = await request.patch(`/api/users/${target.id}`, {
      data: { name: 'Updated Name', email: target.email, password: '' },
    })

    expect(response.status()).toBe(401)
  })

  test('a logged-in non-admin (agent) request is rejected with 403', async ({ request }) => {
    const target = await createDisposableUser(request)

    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: AGENT.email, password: AGENT.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.patch(`/api/users/${target.id}`, {
      data: { name: 'Updated Name', email: target.email, password: '' },
    })

    expect(response.status()).toBe(403)
  })

  test('a logged-in admin request succeeds with 200', async ({ request }) => {
    const target = await createDisposableUser(request)

    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const newName = 'E2E Api Patch Target Updated'
    const response = await request.patch(`/api/users/${target.id}`, {
      data: { name: newName, email: target.email, password: '' },
    })

    expect(response.status()).toBe(200)

    const user = await response.json()
    expect(user).toMatchObject({
      id: target.id,
      name: newName,
      email: target.email,
      role: 'AGENT',
      emailVerified: true,
    })

    // Explicit Prisma `select` on the backend -- assert no sensitive fields
    // (password hash, session/account internals, etc.) leak onto the shape.
    expect(Object.keys(user).sort()).toEqual(
      ['createdAt', 'email', 'emailVerified', 'id', 'name', 'role'].sort(),
    )
  })
})

// Same requireRole(Role.ADMIN) gate as GET/POST/PATCH /api/users. Uses a
// disposable target user (created via POST as admin) rather than the
// seeded ADMIN/AGENT fixtures, which other specs depend on staying stable.
test.describe('DELETE /api/users/:id authorization', () => {
  async function createDisposableUser(request: import('@playwright/test').APIRequestContext) {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const email = `e2e-api-delete-target-${Date.now()}@example.com`
    const response = await request.post('/api/users', {
      data: { name: 'E2E Api Delete Target', email, password: 'password123' },
    })
    expect(response.status()).toBe(201)
    const user = await response.json()

    // Drop the admin session so callers start from a clean, unauthenticated
    // request context for whichever role they actually want to test.
    await request.post('/api/auth/sign-out')

    return user as { id: string; email: string }
  }

  test('an unauthenticated request is rejected with 401', async ({ request }) => {
    const target = await createDisposableUser(request)

    const response = await request.delete(`/api/users/${target.id}`)

    expect(response.status()).toBe(401)
  })

  test('a logged-in non-admin (agent) request is rejected with 403', async ({ request }) => {
    const target = await createDisposableUser(request)

    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: AGENT.email, password: AGENT.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.delete(`/api/users/${target.id}`)

    expect(response.status()).toBe(403)
  })

  test('a logged-in admin request succeeds with 204 and the user disappears from the list', async ({
    request,
  }) => {
    const target = await createDisposableUser(request)

    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.delete(`/api/users/${target.id}`)

    expect(response.status()).toBe(204)
    expect(response.ok()).toBe(true)

    const list = await request.get('/api/users')
    expect(list.ok()).toBe(true)
    const users = await list.json()
    expect(users.find((u: { id: string }) => u.id === target.id)).toBeUndefined()
  })
})

// Behavioral assertions for DELETE /api/users/:id that go beyond the
// authorization matrix above: admins can't delete other admins, and
// deleting an already-deleted (or nonexistent) id 404s, proving soft-delete
// semantics rather than a hard row removal.
test.describe('DELETE /api/users/:id behavior', () => {
  test('an admin cannot delete another admin, with a 403 and a clear message', async ({
    request,
  }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const list = await request.get('/api/users')
    expect(list.ok()).toBe(true)
    const users = await list.json()
    const admin = users.find((u: { email: string }) => u.email === ADMIN.email)
    expect(admin).toBeDefined()

    const response = await request.delete(`/api/users/${admin.id}`)

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ message: 'Admin users cannot be deleted' })
  })

  test('deleting an already-deleted user 404s on the second attempt', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const email = `e2e-api-delete-twice-${Date.now()}@example.com`
    const created = await request.post('/api/users', {
      data: { name: 'E2E Api Delete Twice', email, password: 'password123' },
    })
    expect(created.status()).toBe(201)
    const user = await created.json()

    const firstDelete = await request.delete(`/api/users/${user.id}`)
    expect(firstDelete.status()).toBe(204)

    const secondDelete = await request.delete(`/api/users/${user.id}`)
    expect(secondDelete.status()).toBe(404)
    const body = await secondDelete.json()
    expect(body).toEqual({ message: 'User not found' })
  })

  test('deleting a nonexistent id 404s', async ({ request }) => {
    const signIn = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signIn.ok()).toBe(true)

    const response = await request.delete('/api/users/nonexistent-id-12345')

    expect(response.status()).toBe(404)
    const body = await response.json()
    expect(body).toEqual({ message: 'User not found' })
  })

  test('a soft-deleted user can no longer sign in', async ({ request }) => {
    const signInAsAdmin = await request.post('/api/auth/sign-in/email', {
      data: { email: ADMIN.email, password: ADMIN.password },
    })
    expect(signInAsAdmin.ok()).toBe(true)

    const email = `e2e-api-delete-signin-${Date.now()}@example.com`
    const password = 'password123'
    const created = await request.post('/api/users', {
      data: { name: 'E2E Api Delete Signin Target', email, password },
    })
    expect(created.status()).toBe(201)
    const user = await created.json()

    const deleted = await request.delete(`/api/users/${user.id}`)
    expect(deleted.status()).toBe(204)

    await request.post('/api/auth/sign-out')

    const signInAttempt = await request.post('/api/auth/sign-in/email', {
      data: { email, password },
    })
    expect(signInAttempt.ok()).toBe(false)
    expect(signInAttempt.status()).toBeGreaterThanOrEqual(400)
    expect(signInAttempt.status()).toBeLessThan(500)
  })
})
