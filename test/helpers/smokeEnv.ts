/**
 * Smoke-test env contract.
 *
 * Required vars must come from CI secrets or `.env.smoke.local` (gitignored).
 * Non-secret defaults are filled in here so devs don't need to mirror every
 * stub from `.env.test` just to run smoke locally.
 *
 * See `docs/nightly-qb-smoke-test.md` for rotation procedures and the full
 * secret inventory.
 */

const DOCS = 'docs/nightly-qb-smoke-test.md'

const REQUIRED_SECRETS = [
  'INTUIT_CLIENT_ID',
  'INTUIT_CLIENT_SECRET',
  'INTUIT_SMOKE_REALM_ID',
  'INTUIT_SMOKE_REFRESH_TOKEN',
  'INTUIT_SMOKE_INCOME_ACCOUNT_REF',
  'INTUIT_SMOKE_ASSET_ACCOUNT_REF',
  'INTUIT_SMOKE_EXPENSE_ACCOUNT_REF',
  'COPILOT_API_KEY',
] as const

const NON_SECRET_DEFAULTS: Record<string, string> = {
  INTUIT_REDIRECT_URI_PATH: '/api/quickbooks/auth/callback',
  INTUIT_SANDBOX_API_URL: 'https://sandbox-quickbooks.api.intuit.com',
  INTUIT_PRODUCTION_API_URL: 'https://quickbooks.api.intuit.com',
  INTUIT_API_MINOR_VERSION: '75',
  NEXT_PUBLIC_COPILOT_DASHBOARD_URL: 'https://app.copilot.com',
  NEXT_PUBLIC_COPILOT_APP_API_KEY: 'smoke-copilot-app-key',
  NEXT_PUBLIC_SUPABASE_PROJECT_URL: 'https://smoke.supabase.local',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'smoke-anon-key',
  COPILOT_ENV: 'smoke',
  VERCEL_URL: 'localhost:3000',
  CRON_SECRET: 'smoke-cron-secret',
}

export function assertSmokeEnv(): void {
  // INTUIT_ENVIRONMENT must be 'sandbox' — prevents accidentally pointing
  // smoke at production even if a wrong secret is wired up.
  const intuitEnv = process.env.INTUIT_ENVIRONMENT
  if (intuitEnv !== 'sandbox') {
    throw new Error(
      `Smoke refuses to run with INTUIT_ENVIRONMENT=${intuitEnv ?? '(unset)'}. ` +
        `Must be 'sandbox'. See ${DOCS}.`,
    )
  }

  const missing = REQUIRED_SECRETS.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === '',
  )
  if (missing.length > 0) {
    throw new Error(
      `Smoke is missing required env vars: ${missing.join(', ')}. ` +
        `Populate them in .env.smoke.local (local) or GitHub Actions secrets (CI). ` +
        `See ${DOCS}.`,
    )
  }

  for (const [key, value] of Object.entries(NON_SECRET_DEFAULTS)) {
    if (!process.env[key]) process.env[key] = value
  }
}
