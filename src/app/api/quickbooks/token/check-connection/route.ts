import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'
import { checkPortalConnection } from '@/app/api/quickbooks/token/token.controller'

export const maxDuration = 300 // 5 minutes

export const GET = withErrorHandler(checkPortalConnection)
