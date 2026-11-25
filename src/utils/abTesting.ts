import { abFeatureTestingPortals } from '@/config'

/**
 * Hard-off flag: the QBO automatic bank reconciliation beta has been wound down
 * (OUT-4262). Set to `true` to re-enable the feature with the allowlist gate.
 */
const BANK_DEPOSIT_FEATURE_ENABLED = false

/**
 * Whether a portal may use the bank deposit feature. The feature is currently
 * disabled for all portals (OUT-4262 wind-down). When BANK_DEPOSIT_FEATURE_ENABLED
 * is true, an empty/unset allowlist means enabled for all; otherwise only
 * listed portals get it.
 */
export function isPortalInBankDepositABTest(_portalId: string): boolean {
  if (!BANK_DEPOSIT_FEATURE_ENABLED) return false
  if (abFeatureTestingPortals.length === 0) return true
  return abFeatureTestingPortals.includes(_portalId)
}
