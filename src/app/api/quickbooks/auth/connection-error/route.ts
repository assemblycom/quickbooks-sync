import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'
import { handleConnectionError } from '@/app/api/quickbooks/auth/auth.controller'

export const maxDuration = 180 // 3 minutes

export const POST = withErrorHandler(handleConnectionError)
