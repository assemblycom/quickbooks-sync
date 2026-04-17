import authenticate from '@/app/api/core/utils/authenticate'
import { AuthService } from '@/app/api/quickbooks/auth/auth.service'
import IntuitAPI from '@/utils/intuitAPI'
import { NextRequest, NextResponse } from 'next/server'

export async function getBankAccounts(req: NextRequest) {
  const user = await authenticate(req)
  const authService = new AuthService(user)
  const qbTokenInfo = await authService.getQBPortalConnection(
    user.workspaceId,
    true,
  )
  if (!qbTokenInfo || !qbTokenInfo.accessToken) {
    throw new Error('Tokens expired. Reauthorization required.')
  }
  const intuitApi = new IntuitAPI(qbTokenInfo)
  const result = await intuitApi.customQuery(
    `SELECT Id, Name FROM Account WHERE AccountType = 'Bank' AND Active = true`,
  )
  return NextResponse.json({ accounts: result?.Account || [] })
}
