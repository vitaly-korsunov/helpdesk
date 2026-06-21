---
name: helpdesk_auth_architecture
description: How auth/authorization is wired in the helpdesk app (better-auth + Prisma + Express) — role enforcement pattern, where to check when new protected routes are added
metadata:
  type: project
---

This is a helpdesk app with an Express server (`server/src/index.ts`) and a React client, using
better-auth (`server/src/auth.ts`) with the Prisma adapter for sessions/users.

**Authorization middleware** lives in `server/src/middleware.ts`:
- `requireAuth` — only checks session presence (401 if none). Used on `/api/tickets` (GET/POST).
- `requireRole(...roles: Role[])` — checks session AND `session.user.role` membership (401 if no
  session, 403 if wrong role). This is the one that matters for admin-only routes.

A prior review of this codebase flagged that `/api/tickets` only used `requireAuth` and warned that
the day an admin-only endpoint appeared, it would need real role enforcement, not just client-side
hiding. That day came: `GET /api/users` in `server/src/index.ts` was added using
`requireRole(Role.ADMIN)` correctly. Verified as of 2026-06-21:
- Route uses `requireRole(Role.ADMIN)`, not `requireAuth` — confirmed correct, 401/403/200 paths all
  go through the real middleware (also covered by `server/src/middleware.test.ts`).
- `prisma.user.findMany` uses an explicit `select` (id, name, email, role, emailVerified,
  createdAt) — no password hash or session token fields possible since those live on separate
  `Account`/`Session` Prisma models, not on `User`. Grepped `server/src/` for other `prisma.user.*`
  calls — this is the only one, so there's no parallel unselected leak path.
- Critically, `role` cannot be self-assigned by a client: in `server/src/auth.ts`, the better-auth
  `user.additionalFields.role` config sets `input: false` (clients can't set it via signup/update
  calls) plus `defaultValue: Role.AGENT`. Also `emailAndPassword.disableSignUp: true` means public
  self-registration is off entirely. So `session.user.role` used by `requireRole` is trustworthy —
  it's never attacker-controlled.
- Client-side gating in `client/src/App.tsx` (`session.user.role === 'ADMIN' ? <UsersPage/> :
  <Navigate to="/" />`) and `UsersPage.tsx` itself are correctly just UX — thin display layer,
  fetches `/api/users` with cookies, renders the response, no client-trusted role/privilege logic
  that bypasses the server check.

**Pattern to keep checking for future endpoints in this codebase:** whenever a new route is added,
check whether it should use `requireAuth` (any logged-in user) or `requireRole(Role.X)` (specific
roles) — `requireAuth` alone is NOT sufficient for admin-only data. Also re-verify the better-auth
`additionalFields` config any time a new sensitive user field is added, to make sure `input: false`
(or equivalent protection) is set so it can't be client-supplied.

CORS is configured with a specific `CLIENT_URL` origin (not wildcard) plus `credentials: true` —
this is a pre-existing, correct pattern, not introduced by the `/api/users` change.
