import { defineConfig, devices } from '@playwright/test'

const CLIENT_PORT = 4173
const SERVER_PORT = 3002

export default defineConfig({
  testDir: './e2e',
  // All specs share one server process (one DB, one in-memory rate-limit bucket) —
  // run sequentially to avoid cross-test interference.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${CLIENT_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      name: 'server',
      command: 'bun --env-file=.env.test run dev',
      cwd: 'server',
      url: `http://localhost:${SERVER_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      name: 'client',
      command: `bun run dev -- --port ${CLIENT_PORT} --strictPort`,
      cwd: 'client',
      url: `http://localhost:${CLIENT_PORT}`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        API_PROXY_TARGET: `http://localhost:${SERVER_PORT}`,
      },
    },
  ],
})
