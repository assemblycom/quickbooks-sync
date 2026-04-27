import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { assertSmokeEnv } from '@test/helpers/smokeEnv'

/**
 * Vitest globalSetup for smoke tests.
 *
 * Differences from `test/integration/globalSetup.ts`:
 * - Loads `.env.smoke.local` (gitignored; dev pulls from 1Password) instead
 *   of the committed `.env.test` stubs. In CI the file is absent and env
 *   comes from GitHub Actions secrets.
 * - Validates smoke-required vars via `assertSmokeEnv` before any DB or
 *   src/config imports evaluate — missing creds fail loud with a pointer
 *   to the docs, not a mysterious 401 mid-test.
 * - Uses the same testcontainers Postgres pattern so our app DB stays
 *   isolated from any developer's Supabase instance; only the external
 *   Intuit calls are real.
 *
 * `src/config/index.ts` skips `dotenv.config()` when NODE_ENV=test (which
 * Vitest sets automatically), so `.env` never leaks into smoke runs.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../src/db/migrations')
const ENV_SMOKE_FILE = path.resolve(__dirname, '../../.env.smoke.local')

let container: StartedPostgreSqlContainer | undefined

export default async function globalSetup() {
  if (fs.existsSync(ENV_SMOKE_FILE)) {
    dotenv.config({ path: ENV_SMOKE_FILE, override: true })
    console.info('[smoke globalSetup] Loaded .env.smoke.local')
  } else {
    console.info(
      '[smoke globalSetup] .env.smoke.local not found; expecting CI-injected env',
    )
  }

  assertSmokeEnv()

  console.info('[smoke globalSetup] Starting Postgres test container...')

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('smoke_db')
    .withUsername('smoke_user')
    .withPassword('smoke_pass')
    .start()

  const url = container.getConnectionUri()
  process.env.DATABASE_URL = url

  console.info('[smoke globalSetup] Running Drizzle migrations...')
  const migrationClient = postgres(url, { max: 1, prepare: false })
  const migrationDb = drizzle(migrationClient)
  await migrate(migrationDb, { migrationsFolder: MIGRATIONS_FOLDER })
  await migrationClient.end()

  console.info(`[smoke globalSetup] Ready: ${url}`)

  return async () => {
    console.info('[smoke globalSetup] Stopping Postgres test container...')
    await container?.stop()
  }
}
