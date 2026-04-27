import { db } from '@/db'
import { QBPortalConnection } from '@/db/schema/qbPortalConnections'
import { QBSetting } from '@/db/schema/qbSettings'

/**
 * Stable portal ID for smoke runs. Safe to reuse across runs because the
 * smoke DB is truncated in beforeAll.
 */
export const SMOKE_PORTAL_ID = 'smoke-portal-00000001'

/**
 * Seed a portal + settings row that points at the real Intuit sandbox
 * company via `INTUIT_SMOKE_REALM_ID` and `INTUIT_SMOKE_REFRESH_TOKEN`.
 *
 * `tokenSetTime` is set to epoch so `isTokenFresh` returns false and the
 * very first Intuit call forces a real OAuth refresh — that refresh is one
 * of the things smoke is specifically checking for drift.
 *
 * Env vars are required here (already validated by `assertSmokeEnv` in
 * globalSetup), so the non-null assertions are safe.
 */
export async function seedSmokeHealthyPortal() {
  const intuitRealmId = process.env.INTUIT_SMOKE_REALM_ID!
  const refreshToken = process.env.INTUIT_SMOKE_REFRESH_TOKEN!
  const incomeAccountRef = process.env.INTUIT_SMOKE_INCOME_ACCOUNT_REF!
  const assetAccountRef = process.env.INTUIT_SMOKE_ASSET_ACCOUNT_REF!
  const expenseAccountRef = process.env.INTUIT_SMOKE_EXPENSE_ACCOUNT_REF!

  const [portal] = await db
    .insert(QBPortalConnection)
    .values({
      portalId: SMOKE_PORTAL_ID,
      intuitRealmId,
      accessToken: 'smoke-stale-access-token',
      refreshToken,
      expiresIn: 3600,
      XRefreshTokenExpiresIn: 8_726_400,
      tokenSetTime: new Date(0),
      intiatedBy: 'smoke-internal-user-id',
      incomeAccountRef,
      assetAccountRef,
      expenseAccountRef,
    })
    .returning()

  const [setting] = await db
    .insert(QBSetting)
    .values({
      portalId: SMOKE_PORTAL_ID,
      absorbedFeeFlag: false,
      useCompanyNameFlag: false,
      createNewProductFlag: true,
      initialInvoiceSettingMap: true,
      initialProductSettingMap: true,
      syncFlag: true,
      isEnabled: true,
    })
    .returning()

  return { portal, setting }
}
