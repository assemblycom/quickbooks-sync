import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'
import { getAuthorizationUrl } from '@/app/api/quickbooks/auth/auth.controller'

export const maxDuration = 300 // 5 minutes

export const POST = withErrorHandler(getAuthorizationUrl)
