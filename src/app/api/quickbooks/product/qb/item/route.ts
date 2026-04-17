import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'
import { getItemsFromQB } from '@/app/api/quickbooks/product/product.controller'

export const maxDuration = 300 // 5 minutes

export const GET = withErrorHandler(getItemsFromQB)
