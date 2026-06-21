# Client data fetching

The client (`client/`) uses **TanStack Query** (`@tanstack/react-query`) and **axios** for all server communication. Don't add raw `useEffect` + `fetch` data fetching — it's the pattern this codebase moved away from.

- **Queries/mutations**: use `useQuery`/`useMutation` from `@tanstack/react-query`. The `QueryClientProvider` is set up once in `client/src/main.tsx`. After a mutation that changes server state, invalidate the relevant query key (e.g. `queryClient.invalidateQueries({ queryKey: ['tickets'] })`) rather than manually patching local state.
- **HTTP calls**: use the shared `api` instance from `client/src/lib/api.ts` (`axios.create({ baseURL: '/api' })`) inside query/mutation functions — call it as `api.get('/tickets')`, `api.post('/tickets', body)`, etc. Don't call `axios` directly or reintroduce `fetch`.
- **`retry: false`**: set on queries where a failure should surface immediately (e.g. health checks, anything with an e2e test asserting an error state right after a mocked failed request) — TanStack Query's default retries (3, with backoff) will otherwise delay reaching the error state by several seconds.
- Reference implementations: `client/src/pages/Home.tsx` (health/tickets queries, ticket-creation mutation) and `client/src/pages/UsersPage.tsx` (users query).

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
