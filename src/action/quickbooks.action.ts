'use server'

import { AuthStatus } from '@/app/api/core/types/auth'
import { PortalConnectionWithSettingType } from '@/db/schema/qbPortalConnections'
import { getPortalConnection } from '@/db/service/token.service'
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

export async function reconnectIfCta(type?: string) {
  if (!type) {
    return false
  }
  const parsedType = z.string().safeParse(type)
  if (parsedType.success && parsedType?.data === AuthStatus.RECONNECT)
    return true
  return false
}
