# HelpDesk — Architecture Report

## 1. Overview

HelpDesk is an early-stage, full-stack ticketing app built as a Bun-based monorepo with two workspaces:

- **`client/`** — React 19 + TypeScript SPA, built with Vite, styled with Tailwind CSS v4 and shadcn/ui (Radix primitives).
- **`server/`** — Express 5 API (TypeScript, run directly via Bun), using Prisma 6's new TS-first client generator over PostgreSQL, with [better-auth](https://www.better-auth.com/) handling authentication.

The project is ~10 commits old (`Initial commit` → `add agent nav`). Functionality so far: email/password login, a single ticket list/create flow, and an ADMIN/AGENT role distinction that is only partially wired up server-side (see §7).

## 2. Repository Layout

```
helpdesk/
├── package.json          # root workspace manifest (bun workspaces: client, server)
├── bun.lock
├── README.md
├── client/                # Vite + React frontend
│   ├── src/
│   │   ├── main.tsx              # entrypoint, wraps <App/> in BrowserRouter
│   │   ├── App.tsx               # session check + role-gated routing
│   │   ├── components/
│   │   │   ├── NavBar.tsx
│   │   │   ├── Login.tsx         # react-hook-form + zod login form
│   │   │   └── ui/               # shadcn/ui primitives (button, card, input, label, field, badge, separator)
│   │   ├── pages/
│   │   │   ├── Home.tsx          # ticket list + create form, fetches /api/*
│   │   │   └── UsersPage.tsx     # placeholder, ADMIN-only route, no data yet
│   │   └── lib/
│   │       ├── auth-client.ts    # better-auth React client
│   │       └── utils.ts
│   ├── vite.config.ts            # dev proxy /api -> localhost:3001, '@' alias -> src/
│   └── components.json           # shadcn config (style: radix-nova, baseColor: neutral)
└── server/                # Express API
    ├── src/
    │   ├── index.ts              # Express app, routes, requireAuth/requireRole middleware
    │   ├── auth.ts                # better-auth config
    │   └── db.ts                  # Prisma client (driver adapter: @prisma/adapter-pg)
    ├── prisma/
    │   ├── schema.prisma
    │   ├── seed.ts                # seeds one ADMIN user from env vars
    │   └── migrations/            # init -> add_better_auth -> add_user_role
    ├── generated/prisma/          # generated Prisma client (custom output path, gitignored)
    └── .env.example
```

## 3. Backend Architecture (`server/`)

**Runtime**: Bun, running `src/index.ts` directly (no separate build step — `dev`/`start` both use `bun run`).

**`src/index.ts`** is the entire HTTP surface:

| Route | Middleware | Purpose |
|---|---|---|
| `ALL /api/auth/*splat` | — | Delegated entirely to better-auth via `toNodeHandler(auth)` |
| `GET /api/health` | — | Liveness check |
| `GET /api/tickets` | `requireAuth` | List all tickets |
| `POST /api/tickets` | `requireAuth` | Create a ticket from `{ subject }` |
| `*` (catch-all) | — | 404 JSON |

Middleware order matters: CORS → better-auth catch-all → `express.json()` → app routes. better-auth's handler is mounted *before* `express.json()` intentionally, since it parses its own request bodies.

Two auth middlewares exist:
- **`requireAuth`** — resolves the session via `auth.api.getSession()`; 401 if absent. Used by both ticket routes today.
- **`requireRole(...roles)`** — same session check, plus a 403 if the resolved `session.user.role` isn't in the allowed list. Defined but **not yet applied to any route** — added proactively ahead of the first admin-only endpoint (see §7).

CORS is locked to a single required `CLIENT_URL` origin with `credentials: true` (no wildcard, fails fast at startup if unset — matches the same fail-fast pattern in `auth.ts`).

**`src/db.ts`** wires Prisma to Postgres via the `@prisma/adapter-pg` driver adapter (`PrismaPg`), rather than Prisma's default binary engine — this pairs with the `provider = "prisma-client"` generator in `schema.prisma`, Prisma's newer TypeScript-first client generator that outputs plain `.ts` files to a custom path (`server/generated/prisma/`) instead of living inside `node_modules`.

## 4. Authentication (`server/src/auth.ts` + `client/src/lib/auth-client.ts`)

Backed by **better-auth** with the Prisma adapter. Key configuration choices:

- `emailAndPassword.disableSignUp: true` — no public registration; the only account-creation path is `prisma/seed.ts`.
- `requireEmailVerification: true` — login is blocked until verified (the seed script sets `emailVerified: true` directly, so the seeded admin bypasses this by construction, not by a code path bypass).
- `user.additionalFields.role` — a custom `role` field (`ADMIN | AGENT`, default `AGENT`) layered onto better-auth's User model, with **`input: false`**, meaning better-auth's own API layer hard-rejects any client-supplied value for it (verified against the installed package — `update-user`/`sign-up` throw `FIELD_NOT_ALLOWED` rather than silently dropping it). This is the load-bearing control preventing self-escalation to ADMIN.
- `trustedOrigins: [clientUrl]` — scoped to exactly one origin, sourced from the same `CLIENT_URL` env var as CORS.

On the client, `auth-client.ts` creates a better-auth React client with the `inferAdditionalFields` plugin so `role` is typed end-to-end, and re-exports `signIn`, `signUp`, `signOut`, `useSession`.

**Session trust boundary**: the server never trusts a client-asserted role. Every protected route re-derives the session (and thus `role`) from the session cookie via `auth.api.getSession()` on the server. Client-side role checks (`session.user.role === 'ADMIN'` in `App.tsx`/`NavBar.tsx`) only control UI rendering — they are not, and aren't intended to be, a security boundary.

## 5. Frontend Architecture (`client/`)

- **Routing**: `react-router-dom` `BrowserRouter`, with a single role-gated route (`/user` → `UsersPage`, redirects non-admins to `/`). `App.tsx` itself acts as the top-level auth gate: it shows `<Login/>` if `useSession()` has no session, otherwise renders the nav + routes.
- **Forms**: `react-hook-form` + `zod` via `@hookform/resolvers`, currently only used in `Login.tsx`.
- **UI system**: shadcn/ui (`style: radix-nova`, `baseColor: neutral`) generating local copies of Radix-based primitives into `src/components/ui/` (button, card, input, label, field, separator, badge). Icons via `lucide-react`. Tailwind v4 via `@tailwindcss/vite` (no separate `tailwind.config.*` — v4's CSS-first config lives in `index.css`).
- **Data fetching**: plain `fetch()` calls in `Home.tsx` against `/api/health` and `/api/tickets` — no query library (no React Query/SWR) yet; state is local `useState`/`useEffect`.
- **Dev proxy**: `vite.config.ts` proxies `/api/*` to `http://localhost:3001`, so the client never needs to know the API's absolute URL in development, and avoids CORS entirely in dev (CORS only matters once client/server are served from different origins, e.g. in production).

## 6. Data Model (`server/prisma/schema.prisma`)

```
Ticket            — id, subject, status (default "open")            [app domain model]
User              — id, name, email (unique), emailVerified, image, role (ADMIN|AGENT), timestamps
Session           — id, token (unique), expiresAt, ipAddress, userAgent, userId -> User (cascade)
Account           — id, accountId, providerId, userId -> User (cascade), password (for credential provider), OAuth token fields (unused today)
Verification      — id, identifier, value, expiresAt                  [email verification tokens]
```

`User`, `Session`, `Account`, `Verification` are better-auth's standard schema (mapped to lowercase table names via `@@map`); `Ticket` is the one app-specific model. There is currently no relation between `Ticket` and `User` (tickets aren't owned by or assigned to anyone yet).

**Migration history** tells the build order: `init` (Ticket table only) → `add_better_auth` (User/Session/Account/Verification) → `add_user_role` (Role enum + `User.role`). Auth was bolted on after the initial ticket prototype, and role-based access is the most recent addition — consistent with it being the least complete piece (see §7).

## 7. Current State of Authorization (Known Gap)

This is the most important architectural fact for anyone extending the app: **role checking exists at the schema and middleware level, but is not enforced on any route yet.**

- `/api/tickets` (GET/POST) only require *a* valid session — any authenticated user, ADMIN or AGENT, can read/write all tickets. This may be intentional (shared queue model) but hasn't been decided explicitly.
- `UsersPage.tsx` is a static placeholder with no backend endpoint behind it yet. The `/user` route and "Users" nav link are gated client-side only (`role === 'ADMIN'`), which is correct as *UX* but provides no enforcement.
- A `requireRole(...roles: Role[])` middleware now exists in `server/src/index.ts` specifically so the first admin-only endpoint (e.g. `GET /api/users`) doesn't repeat the mistake of using session-only `requireAuth`. It is not wired to anything yet.
- Rate limiting on `/api/auth/sign-in/email` is still effectively off: better-auth only enables its built-in rate limiter when `NODE_ENV === "production"`, and nothing in this repo sets `NODE_ENV` or passes `rateLimit: { enabled: true }` explicitly in `auth.ts`. This was flagged in a prior security review and has **not** been remediated — login is currently brute-forceable.

## 8. Request Flow (typical authenticated ticket fetch)

```
Browser (Home.tsx)
  → fetch('/api/tickets')                        [credentials: same-origin cookie]
  → Vite dev proxy (dev only) ──────────────────→ http://localhost:3001/api/tickets
       Express: cors() → requireAuth
         → auth.api.getSession(cookie)  ─────→  Postgres `session` + `user` tables (via better-auth + Prisma adapter)
         → if valid: prisma.ticket.findMany()  →  Postgres `Ticket` table
       ← JSON ticket array
  ← rendered in <Home/>
```

## 9. Environment & Local Dev

| Var | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Postgres connection string (driver adapter) |
| `BETTER_AUTH_SECRET` | server | Session/cookie signing |
| `BETTER_AUTH_URL` | server | better-auth's self-reference URL |
| `CLIENT_URL` | server | Required; drives both CORS `origin` and `trustedOrigins` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | server (seed only) | Seeds the one ADMIN account |

Ports: server `3001`, client `5173` (Vite default). `.env` is correctly gitignored at the root (`.gitignore` covers `.env`/`.env.local`); only `.env.example` is committed.

Root scripts (`package.json`): `dev:client`, `dev:server` (run in separate terminals — no concurrently/turbo orchestration yet), `build` (client only; server has no build step since Bun runs the TS directly).

## 10. Notable Tooling Choices

- **Bun** as the JS runtime/package manager for both workspaces (not Node+npm/pnpm).
- **Prisma's `prisma-client` generator** (not the classic `prisma-client-js`) + `@prisma/adapter-pg`, generating plain TS output outside `node_modules`.
- **Tailwind v4** CSS-first config (no JS config file) + **shadcn/ui** for component scaffolding rather than a hand-rolled design system.
- A project-local Claude Code **`security-reviewer` agent** (`.claude/agents/security-vulnerability-reviewer.md`) and a **better-auth-best-practices** skill (`.agents/skills/`) are checked into the repo, indicating AI-assisted review/development is part of this project's workflow, separate from the app architecture itself.

## 11. Summary of Open Architectural Decisions

1. **Ticket ownership/visibility** — should tickets be scoped per-user, or is a shared queue (current behavior) intended?
2. **Admin API surface** — `UsersPage` implies a `/api/users` (and likely user-management mutation) endpoint is coming; `requireRole` is ready for it.
3. **Rate limiting** — needs to be explicitly enabled in `auth.ts` before this app is exposed beyond local dev.
4. **No CI** — no `.github/workflows` currently present despite earlier commit messages referencing Claude review/PR workflows; there's no automated lint/typecheck/test gate on changes yet.
