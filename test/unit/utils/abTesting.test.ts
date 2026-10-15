import { describe, it, expect, afterEach, vi } from 'vitest'

// abFeatureTestingPortals is parsed from the env var at module load, so each
// case stubs the env, resets the module registry, and re-imports to pick up
// the fresh parse.
async function loadGate(envValue?: string) {
  vi.resetModules()
  if (envValue === undefined) {
    vi.stubEnv('AB_FEATURE_TESTING_PORTALS', '')
  } else {
    vi.stubEnv('AB_FEATURE_TESTING_PORTALS', envValue)
  }
  const { isPortalInBankDepositABTest } = await import('@/utils/abTesting')
  return isPortalInBankDepositABTest
}

describe('isPortalInBankDepositABTest', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // OUT-4262: Bank deposit feature is now disabled via hard-off flag.
  // The following tests verify the hard-off behavior. When the feature is
  // re-enabled, revert these to the original assertions.

  it('blocks every portal when the hard-off flag is set (feature disabled)', async () => {
    const isInTest = await loadGate(undefined)
    expect(isInTest('portal-abc')).toBe(false)
  })

  it('blocks every portal even with allowlist when hard-off is set', async () => {
    const isInTest = await loadGate('portal-abc,portal-def')
    expect(isInTest('portal-abc')).toBe(false)
    expect(isInTest('portal-def')).toBe(false)
  })

  it('blocks portals not on allowlist when hard-off is set', async () => {
    const isInTest = await loadGate('portal-abc,portal-def')
    expect(isInTest('portal-xyz')).toBe(false)
  })
})
