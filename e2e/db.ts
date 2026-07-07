import path from 'node:path'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../server/generated/prisma/client'

// playwright.config.ts's webServer entry passes --env-file=.env.test to the
// *spawned server* subprocess only -- that env var never reaches this
// Playwright test-runner process. Load it here too so DATABASE_URL is
// available when this module constructs its own PrismaClient. Loading the
// whole file (not just DATABASE_URL) is harmless and simpler than picking
// out one var.
process.loadEnvFile(path.resolve(__dirname, '../server/.env.test'))

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
export const prisma = new PrismaClient({ adapter })
