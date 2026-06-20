# Testing

This project has two separate test suites: server unit tests (Bun) and end-to-end tests (Playwright), run against different databases.

## Server unit tests

- Runner: Bun's built-in test runner (no Jest/Vitest).
- Location: co-located with source as `*.test.ts` (e.g. `server/src/middleware.test.ts`).
- Run: `cd server && bun test`, or from root `bun run test:server`.
- These must not hit a real database or start the real server. Mock dependencies with `bun:test`'s `mock.module()` (see `middleware.test.ts` for the pattern: mock `./auth`'s `getSession`, then `await import` the module under test).
- `server/src/index.ts` has a top-level `app.listen()` side effect, so it can't be imported by tests. Testable logic (middleware, helpers) belongs in separate modules that `index.ts` imports — extract before testing, don't import `index.ts` directly.

## End-to-end tests (Playwright)

**Always delegate to the `playwright-e2e-writer` subagent for anything involving the `e2e/` suite** — writing new specs, extending existing ones, or fixing a failing/flaky test. Use the Agent tool with `subagent_type: "playwright-e2e-writer"`. Don't write or edit Playwright spec files directly from the main thread; this agent has the project's e2e setup, conventions, and known gotchas built into its instructions, and keeps that knowledge up to date in its own memory.

Setup, conventions, and project-specific details for the `e2e/` suite live in the agent's definition (`.claude/agents/playwright-e2e-writer.md`), not here.
