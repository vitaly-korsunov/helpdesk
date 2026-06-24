# Client data fetching

The client (`client/`) uses **TanStack Query** (`@tanstack/react-query`) and **axios** for all server communication. Don't add raw `useEffect` + `fetch` data fetching — it's the pattern this codebase moved away from.

- **Queries/mutations**: use `useQuery`/`useMutation` from `@tanstack/react-query`. The `QueryClientProvider` is set up once in `client/src/main.tsx`. After a mutation that changes server state, invalidate the relevant query key (e.g. `queryClient.invalidateQueries({ queryKey: ['tickets'] })`) rather than manually patching local state.
- **HTTP calls**: use the shared `api` instance from `client/src/lib/api.ts` (`axios.create({ baseURL: '/api' })`) inside query/mutation functions — call it as `api.get('/tickets')`, `api.post('/tickets', body)`, etc. Don't call `axios` directly or reintroduce `fetch`.
- **`retry: false`**: set on queries where a failure should surface immediately (e.g. health checks, anything with an e2e test asserting an error state right after a mocked failed request) — TanStack Query's default retries (3, with backoff) will otherwise delay reaching the error state by several seconds.
- Reference implementations: `client/src/pages/Home.tsx` (health/tickets queries, ticket-creation mutation) and `client/src/pages/UsersPage.tsx` (users query).

# Data validation

Use **zod** (`zod`) for validating structured input on both sides of the stack — don't hand-roll regex/type checks.

- **Schemas shared between client and server** (anything validating a request body the client also submits, e.g. `createUserSchema`) **must be defined once in the `core/` workspace package and imported from there by both** — never redefine the same shape independently in `client/` and `server/`. Add a new file under `core/src/schemas/` (one schema per file, e.g. `core/src/schemas/user.ts`), export the `z.object({...})` schema plus its inferred type (`export type XInput = z.infer<typeof xSchema>`), and re-export both from `core/src/index.ts`. `core` has no build step — it's consumed as raw TypeScript source via the `workspace:*` dependency in `client/package.json` and `server/package.json`, so a new export is immediately importable as `import { xSchema, type XInput } from 'core'` from either side.
- **Client forms**: import the shared schema from `core` and wire it up with `react-hook-form`'s `useForm({ resolver: zodResolver(schema) })`. See `client/src/pages/UsersPage.tsx` for the pattern (`createUserSchema`/`CreateUserInput` from `core`), including how field-level messages flow into `FieldError`. A schema that's genuinely client-only (e.g. `loginSchema` in `client/src/components/Login.tsx`, which the server never parses directly since better-auth handles it) can stay local to the component.
- **Server request bodies**: import the same shared schema from `core` and validate with `schema.safeParse(req.body)`, returning `res.status(400).json({ message: parsed.error.issues[0].message })` on failure. See `app.post("/api/users", ...)` in `server/src/index.ts`. Because the schema is shared, client and server validation messages can't drift out of sync.
- Validation failures are distinct from business-rule failures (e.g. a duplicate email) — schema validation returns `400`; conflicts/business rules return their own status code (`409`, etc.) after the schema check passes.

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
