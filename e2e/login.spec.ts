import { test, expect } from '@playwright/test'
import { ADMIN } from './credentials'

test('admin can log in with seeded credentials', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Welcome back')).toBeVisible()

  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByLabel('Password').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await expect(page.getByText('Welcome back')).not.toBeVisible()
})

test.describe('client-side field validation', () => {
  test('submitting with an empty email shows a required-field error and makes no request', async ({
    page,
  }) => {
    let signInRequested = false
    await page.route('**/api/auth/sign-in/email', (route) => {
      signInRequested = true
      return route.continue()
    })

    await page.goto('/')
    await page.getByLabel('Password').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Email is required')).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
    expect(signInRequested).toBe(false)
  })

  test('submitting a malformed email shows a format error', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByLabel('Password').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Enter a valid email')).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('submitting with an empty password shows a required-field error', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Password is required')).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
  })
})

test.describe('failed sign-in attempts', () => {
  test('wrong password for a real account shows a generic error and stays on the login form', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('a non-existent email shows the same generic error (no enumeration leak)', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill('no-such-user@example.com')
    await page.getByLabel('Password').fill('whatever-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible()
    await expect(page.getByText('Welcome back')).toBeVisible()
  })

  test('wrong-password and unknown-email errors render identical text', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    const wrongPasswordError = await page.getByRole('alert').last().textContent()

    await page.reload()
    await page.getByLabel('Email').fill('no-such-user@example.com')
    await page.getByLabel('Password').fill('whatever-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    const unknownEmailError = await page.getByRole('alert').last().textContent()

    expect(unknownEmailError).toBe(wrongPasswordError)
  })

  test('failed sign-in leaves the form populated, ready to retry', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Email').fill(ADMIN.email)
    await page.getByLabel('Password').fill('definitely-wrong-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText(/invalid email or password/i)).toBeVisible()

    // Retry with the correct password without re-filling the email field.
    await page.getByLabel('Password').fill(ADMIN.password)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  })
})

test('submitting valid credentials shows a submitting state on the button', async ({ page }) => {
  // Delay the sign-in response so the "Signing in…" state has time to render
  // and be asserted before the real request would normally resolve.
  await page.route('**/api/auth/sign-in/email', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.continue()
  })

  await page.goto('/')
  await page.getByLabel('Email').fill(ADMIN.email)
  await page.getByLabel('Password').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  const submitButton = page.getByRole('button', { name: 'Signing in…' })
  await expect(submitButton).toBeVisible()
  await expect(submitButton).toBeDisabled()

  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
})
