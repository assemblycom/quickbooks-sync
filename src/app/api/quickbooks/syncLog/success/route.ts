import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'
import { getLatestSyncSuccessLog } from '@/app/api/quickbooks/syncLog/syncLog.controller'

export const maxDuration = 300 // 5 minutes

export const GET = withErrorHandler(getLatestSyncSuccessLog)
