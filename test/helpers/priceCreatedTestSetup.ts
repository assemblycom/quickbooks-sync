import { beforeEach, afterEach, vi } from 'vitest'
import { truncateAllTestTables } from '@test/helpers/testDb'
import {
  installMockApis,
  type MockCopilotAPI,
  type MockIntuitAPI,
} from '@test/helpers/mocks'

type InstallOpts = Parameters<typeof installMockApis>[0]

export interface PriceCreatedTestHandle {
  copilot: MockCopilotAPI
  intuit: MockIntuitAPI
}

/**
 * Registers the standard `beforeEach` (truncate + installMockApis) and
 * `afterEach` (clearAllMocks) hooks used by every price.created integration
 * test. Returns a live handle whose `copilot` / `intuit` properties are
 * replaced with fresh mock instances before each test.
 *
 * The `optsFactory` is invoked once per test so callers can supply overrides
 * whose underlying `vi.fn()`s are freshly instantiated — a static opts object
 * would be broken by the `vi.clearAllMocks()` call in afterEach.
 *
 * IMPORTANT: `handle.copilot` and `handle.intuit` are only defined inside
 * `it` / `test` callbacks (after `beforeEach` has run). Accessing them at
 * `describe`-scope will yield `undefined` at runtime.
 */
export function setupPriceCreatedTest(
  optsFactory?: () => InstallOpts,
): PriceCreatedTestHandle {
  const handle = {} as PriceCreatedTestHandle

  beforeEach(async () => {
    await truncateAllTestTables()
    const { copilot, intuit } = installMockApis(optsFactory?.())
    handle.copilot = copilot
    handle.intuit = intuit
  })

  afterEach(() => {
    // clearAllMocks (not restoreAllMocks) — the module-level mock factories in
    // test/integration/setup.ts must stay installed across tests; we only want
    // to reset call counts and implementations set in beforeEach.
    vi.clearAllMocks()
  })

  return handle
}
