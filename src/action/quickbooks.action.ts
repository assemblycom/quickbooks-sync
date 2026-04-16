'use server'

import { AuthStatus } from '@/app/api/core/types/auth'
import { PortalConnectionWithSettingType } from '@/db/schema/qbPortalConnections'
import { QBSettingsSelectSchemaType } from '@/db/schema/qbSettings'
import {
  getPortalConnection,
  getPortalSettings,
} from '@/db/service/token.service'
import IntuitAPI from '@/utils/intuitAPI'
import CustomLogger from '@/utils/logger'
import { refreshAndPersistQBToken } from '@/utils/tokenRefresh'
import dayjs from 'dayjs'
import { z } from 'zod'

export async function checkPortalConnection(
  portalId: string,
): Promise<PortalConnectionWithSettingType | null> {
  try {
    return await getPortalConnection(portalId)
  } catch (err) {
    console.error('checkPortalConnection#getPortalConnection | Error =', err)
    return null
  }
}

export async function checkSyncStatus(portalId: string): Promise<boolean> {
  try {
    const syncedPortal: QBSettingsSelectSchemaType | null =
      await getPortalSettings(portalId)
    return syncedPortal?.syncFlag || false
  } catch (err) {
    console.error('checkSyncStatus#getPortalSettings | Error =', err)
    return false
  }
}

export async function checkForNonUsCompany(portalId: string) {
  CustomLogger.info({
    message: 'checkForNonUsCompany | Checking for non-US company',
  })

  const portalConnection = await getPortalConnection(portalId)
  if (!portalConnection) {
    throw new Error(
      `checkForNonUsCompany | Portal connection not found for portalId: ${portalId}`,
    )
  }

  const { tokenSetTime, expiresIn } = portalConnection

  // Refresh token if expired (treat missing tokenSetTime as expired)
  const isExpired =
    !tokenSetTime ||
    dayjs().isAfter(dayjs(tokenSetTime).add(expiresIn, 'seconds'))

  const tokenInfo = isExpired
    ? await refreshAndPersistQBToken(portalId)
    : {
        accessToken: portalConnection.accessToken,
        refreshToken: portalConnection.refreshToken,
        intuitRealmId: portalConnection.intuitRealmId,
        incomeAccountRef: portalConnection.incomeAccountRef,
        expenseAccountRef: portalConnection.expenseAccountRef,
        assetAccountRef: portalConnection.assetAccountRef,
        serviceItemRef: portalConnection.serviceItemRef,
        clientFeeRef: portalConnection.clientFeeRef,
      }

  const intuitApi = new IntuitAPI(tokenInfo)
  const companyInfo = await intuitApi.getCompanyInfo()

  CustomLogger.info({
    obj: { companyInfo },
    message: 'checkForNonUsCompany | Company Info',
  })

  return companyInfo.Country !== 'US'
}

export async function reconnectIfCta(type?: string) {
  if (!type) {
    return false
  }
  const parsedType = z.string().safeParse(type)
  if (parsedType.success && parsedType?.data === AuthStatus.RECONNECT)
    return true
  return false
}
