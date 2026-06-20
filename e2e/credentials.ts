// Matches the accounts seeded into helpdesk_test via `bun run db:test:seed`
// (server/.env.test: ADMIN_EMAIL/ADMIN_PASSWORD, AGENT_EMAIL/AGENT_PASSWORD).
export const ADMIN = { email: 'admin@example.com', password: 'password123' }
export const AGENT = { email: 'agent@example.com', password: 'password123' }
