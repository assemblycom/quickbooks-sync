import { abFeatureTestingPortals } from '@/config'

/**
 * Checks if a portal is eligible for the bank deposit feature.
 * When AB_FEATURE_TESTING_PORTALS is empty/unset, the feature is available to all portals.
 * When it has values, only listed portals get the feature.
 */
export function isPortalInBankDepositABTest(portalId: string): boolean {
  if (abFeatureTestingPortals.length === 0) return true
  return abFeatureTestingPortals.includes(portalId)
}
