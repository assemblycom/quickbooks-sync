import authenticate from '@/app/api/core/utils/authenticate'
import { TokenService } from '@/app/api/quickbooks/token/token.service'
import { changeEnableStatusRequestSchema } from '@/type/common'
import IntuitAPI from '@/utils/intuitAPI'
import CustomLogger from '@/utils/logger'
import {
  getValidQbTokens,
  QBReconnectRequiredError,
} from '@/utils/tokenRefresh'
import { NextRequest, NextResponse } from 'next/server'

export async function checkNonUsCompany(req: NextRequest) {
  const { workspaceId } = await authenticate(req)
  try {
    const intuitApi = new IntuitAPI(await getValidQbTokens(workspaceId))
    const companyInfo = await intuitApi.getCompanyInfo()
    return NextResponse.json({ nonUsCompany: companyInfo.Country !== 'US' })
  } catch (error) {
    if (!(error instanceof QBReconnectRequiredError)) throw error
    // AuthService.getQBPortalConnection owns the disable-sync + IU-notify cleanup on the webhook path.
    CustomLogger.info({
      message: `checkNonUsCompany | Refresh token revoked for portalId: ${workspaceId}. Deferring cleanup to webhook path.`,
    })
    return NextResponse.json({ nonUsCompany: false })
  }
}

export async function checkPortalConnection(req: NextRequest) {
  const user = await authenticate(req)
  const tokenService = new TokenService(user)
  const portalSync = await tokenService.getOneByPortalId(user.workspaceId)
  return NextResponse.json(portalSync)
}

export async function resetConnection(req: NextRequest) {
  const user = await authenticate(req)
  const tokenService = new TokenService(user)
  await tokenService.resetConnection()
  return NextResponse.json({ success: true })
}

export async function changeEnableStatus(req: NextRequest) {
  const user = await authenticate(req)
  const body = await req.json()
  const parsedBody = changeEnableStatusRequestSchema.parse(body)
  const tokenService = new TokenService(user)
  const portal = await tokenService.changeEnableStatus(
    user.workspaceId,
    parsedBody,
  )
  return NextResponse.json(portal)
}
