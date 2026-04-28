// Doc: https://developer.intuit.com/app/developer/qbo/docs/develop/troubleshooting/error-codes
import { NotificationActions } from '@/app/api/core/types/notification'

export const AccountErrorCodes = [
  6190, // account suspended
  6000, // business validation error
]

export const OAuthErrorCodes = {
  INVALID_GRANT: 'invalid_grant',
} as const

/**
 * Maps QBO error codes to the IU notification action they should trigger.
 *
 * Scope: only codes that require a human to fix data/settings in QuickBooks.
 * Transient (429, 5xx) and auth (120, 401/invalid_grant) errors are handled
 * elsewhere — 429/5xx by retry, auth by AUTH_RECONNECT.
 *
 * Keyed by string because intuit Fault.Error.code arrives as a string in
 * payloads and we persist it as varchar in qb_sync_logs.error_code.
 */
export const UserActionableErrorCodes: Record<string, NotificationActions> = {
  '6140': NotificationActions.QB_DUPLICATE_DOC_NUMBER,
  '6240': NotificationActions.QB_DUPLICATE_NAME,
  '6210': NotificationActions.QB_CLOSED_PERIOD,
  '6540': NotificationActions.QB_DEPOSITED_TXN_LOCKED,
  '610': NotificationActions.QB_INACTIVE_REFERENCE,
  '2500': NotificationActions.QB_INACTIVE_REFERENCE,
  '6190': NotificationActions.QB_SUBSCRIPTION_INVALID,
  '6000': NotificationActions.QB_VALIDATION_FAILED,
  '5010': NotificationActions.QB_STALE_OBJECT,
  '620': NotificationActions.QB_TXN_LINK_FAILED,
  '2390': NotificationActions.QB_ITEM_INCOME_ACCOUNT_MISSING,
}
