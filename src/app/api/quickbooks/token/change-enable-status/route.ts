import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'
import { changeEnableStatus } from '@/app/api/quickbooks/token/token.controller'

export const maxDuration = 180 // 3 minutes

export const POST = withErrorHandler(changeEnableStatus)
