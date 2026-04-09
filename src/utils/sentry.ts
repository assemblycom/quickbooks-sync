import * as Sentry from '@sentry/nextjs'

export function addSyncBreadcrumb(
  message: string,
  data?: Record<string, string | number | boolean | undefined>,
) {
  Sentry.addBreadcrumb({
    category: 'sync',
    message,
    data,
    level: 'info',
  })
}
