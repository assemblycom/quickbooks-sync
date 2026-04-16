import {
  QBPortalConnection,
  QBPortalConnectionUpdateSchemaType,
} from '@/db/schema/qbPortalConnections'
import Intuit from '@/utils/intuit'
import { IntuitAPITokensType } from '@/utils/intuitAPI'
import { db } from '@/db'
import { and, eq } from 'drizzle-orm'
import dayjs from 'dayjs'

/**
 * Refreshes a QBO access token via the Intuit SDK and persists
 * the new token set back to `qb_portal_connections`.
 *
 * Callers are responsible for:
 * - Deciding *when* to refresh (e.g. checking expiry first).
 * - Handling domain-specific errors (e.g. INVALID_GRANT → turn off sync).
 */
export async function refreshAndPersistQBToken(
  portalId: string,
  intuitRealmId: string,
  currentTokens: IntuitAPITokensType,
): Promise<IntuitAPITokensType> {
  const refreshedToken = await Intuit.getInstance().getRefreshedQBToken(
    currentTokens.refreshToken,
  )

  const updatedTokens: IntuitAPITokensType = {
    ...currentTokens,
    accessToken: refreshedToken.access_token,
    refreshToken: refreshedToken.refresh_token,
  }

  const updatedPayload: QBPortalConnectionUpdateSchemaType = {
    accessToken: updatedTokens.accessToken,
    refreshToken: updatedTokens.refreshToken,
    expiresIn: refreshedToken.expires_in,
    XRefreshTokenExpiresIn: refreshedToken.x_refresh_token_expires_in,
    tokenSetTime: dayjs().toDate(),
    updatedAt: dayjs().toDate(),
  }

  const [updated] = await db
    .update(QBPortalConnection)
    .set(updatedPayload)
    .where(
      and(
        eq(QBPortalConnection.intuitRealmId, intuitRealmId),
        eq(QBPortalConnection.portalId, portalId),
      ),
    )
    .returning({ id: QBPortalConnection.id })

  if (!updated) {
    throw new Error(
      `refreshAndPersistQBToken | No row updated for portalId=${portalId}, realmId=${intuitRealmId}`,
    )
  }

  return updatedTokens
}
