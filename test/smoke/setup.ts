import { vi } from 'vitest'

/**
 * Per-test setup for smoke.
 *
 * Mocks only CopilotAPI — IntuitAPI and Sentry remain real because the whole
 * point of smoke is to exercise real QB sandbox calls and get real Sentry
 * breadcrumbs on failure. Copilot is mocked because its node SDK only exposes
 * read operations (no product create/update/delete), which means we can't
 * generate unique product names per run to sidestep QB's Item.Name uniqueness
 * constraint. See `docs/nightly-qb-smoke-test.md` for the full rationale.
 *
 * Per-test behavior is wired by `installSmokeCopilotMock` in
 * `test/helpers/smokeMocks.ts`, which injects a runId-scoped name so the
 * derived QB item name is unique per run.
 */

vi.mock('@/utils/copilotAPI', () => ({
  CopilotAPI: vi.fn(),
}))
