/**
 * Coverage for PayoutService#reconcile — the deposit-creating step, shared by
 * the payout webhook and the resync cron.
 *
 * OUT-4262: The AB gate was removed from this method so existing invoices with
 * isBatchedDeposit=true can still have their deposits created and Stripe fees
 * booked. The freeze point (InvoiceService#readBankDepositFeeFlag) blocks new
 * invoices from being batched, so this method naturally winds down.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { QBPayoutSyncSelectSchemaType } from '@/db/schema/qbPayoutSync'
import type { IntuitAPITokensType } from '@/utils/intuitAPI'

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  addBreadcrumb: vi.fn(),
  init: vi.fn(),
}))
vi.mock('@/db', () => ({ db: {}, client: {} }))
vi.mock('@/utils/assemblyAPI', () => ({ AssemblyAPI: vi.fn() }))
vi.mock('@/utils/intuitAPI', () => ({ default: vi.fn() }))
vi.mock('@/app/api/quickbooks/syncLog/syncLog.service', () => ({
  SyncLogService: vi.fn(function () {
    return {}
  }),
}))

const { validateAccessToken } = vi.hoisted(() => ({
  validateAccessToken: vi.fn(),
}))
vi.mock('@/utils/auth', () => ({ validateAccessToken }))

import { PayoutService } from '@/app/api/quickbooks/payout/payout.service'
import User from '@/app/api/core/models/User.model'

const stubUser = { workspaceId: 'test-portal-00000001' } as unknown as User
const stubRow = {
  payoutId: 'po_123',
} as unknown as QBPayoutSyncSelectSchemaType
const stubTokens = {} as IntuitAPITokensType

describe('PayoutService#reconcile — no AB gate (OUT-4262)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('proceeds directly to token validation without an AB gate check', async () => {
    // Force a stop at token validation to confirm the method proceeds.
    validateAccessToken.mockImplementation(() => {
      throw new Error('advanced to token validation')
    })

    await expect(
      new PayoutService(stubUser).reconcile(stubRow, stubTokens, {
        runIdempotencyCheck: true,
      }),
    ).rejects.toThrow('advanced to token validation')
    expect(validateAccessToken).toHaveBeenCalledTimes(1)
  })
})
