import {
  QBPortalConnection,
  QBPortalConnectionUpdateSchemaType,
} from '@/db/schema/qbPortalConnections'
import { getPortalConnection } from '@/db/service/token.service'
import Intuit from '@/utils/intuit'
import { IntuitAPITokensType } from '@/utils/intuitAPI'
import CustomLogger from '@/utils/logger'
import { db } from '@/db'
import { and, eq } from 'drizzle-orm'
import dayjs from 'dayjs'

/**
 * Refreshes a QBO access token via the Intuit SDK and persists
 * the new token set back to `qb_portal_connections`.
 *
 * Fetches the portal connection internally — callers only need to
 * supply the portalId (an extra DB read on the refresh path is
 * acceptable given the Intuit API call that follows).
 *
 * Callers are responsible for:
 * - Deciding *when* to refresh (e.g. checking expiry first).
 * - Handling domain-specific errors (e.g. INVALID_GRANT → turn off sync).
 */
export async function getRefreshedQbTokenInfo(
  portalId: string,
): Promise<IntuitAPITokensType> {
  const portalConnection = await getPortalConnection(portalId)
  if (!portalConnection) {
    throw new Error(
      `getRefreshedQbTokenInfo | Portal connection not found for portalId: ${portalId}`,
    )
  }

  const {
    refreshToken,
    intuitRealmId,
    incomeAccountRef,
    expenseAccountRef,
    assetAccountRef,
    serviceItemRef,
    clientFeeRef,
    bankAccountRef,
  } = portalConnection

  CustomLogger.info({
    message: `getRefreshedQbTokenInfo | Refreshing access token for portalId: ${portalId}`,
  })

  const refreshedToken =
    await Intuit.getInstance().getRefreshedQBToken(refreshToken)

  const updatedTokens: IntuitAPITokensType = {
    accessToken: refreshedToken.access_token,
    refreshToken: refreshedToken.refresh_token,
    intuitRealmId,
    incomeAccountRef,
    expenseAccountRef,
    assetAccountRef,
    serviceItemRef,
    clientFeeRef,
    bankAccountRef,
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
      `getRefreshedQbTokenInfo | No row updated for portalId=${portalId}, realmId=${intuitRealmId}`,
    )
  }

  return updatedTokens
}
