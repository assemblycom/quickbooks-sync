import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { testApiHandler } from 'next-test-api-route-handler'

import { db } from '@/db'
import { QBProductSync } from '@/db/schema/qbProductSync'
import { QBSyncLog } from '@/db/schema/qbSyncLogs'
import { EntityType, EventType, LogStatus } from '@/app/api/core/types/log'
import * as appHandler from '@/app/api/quickbooks/webhook/route'

import priceCreatedPayload from '../../fixtures/priceCreated.webhook.json'
import { truncateAllTestTables } from '../../helpers/testDb'
import { seedHealthyPortal, TEST_PORTAL_ID } from '../../helpers/seed'
import {
  createMockIntuitAPI,
  installMockApis,
  type MockCopilotAPI,
  type MockIntuitAPI,
} from '../../helpers/mocks'

/**
 * QB createItem failure: when the QB call fails inside the transaction,
 * the DB transaction rolls back (no qb_product_sync row, no SUCCESS log),
 * but the outer catch in WebhookService#handlePriceCreated writes a FAILED
 * sync log OUTSIDE the transaction so the incident is recorded.
 */
describe('POST /api/quickbooks/webhook — price.created (QB createItem fails)', () => {
  let copilot: MockCopilotAPI
  let intuit: MockIntuitAPI

  beforeEach(async () => {
    await truncateAllTestTables()

    ;({ copilot, intuit } = installMockApis({
      intuit: createMockIntuitAPI({
        createItem: vi
          .fn()
          .mockRejectedValue(new Error('QuickBooks is on fire')),
      }),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rolls back the tx, inserts no mapping row, and writes a FAILED sync log', async () => {
    await seedHealthyPortal()

    await testApiHandler({
      appHandler,
      url: '/api/quickbooks/webhook?token=test-token-xyz',
      test: async ({ fetch }) => {
        const res = await fetch({
          method: 'POST',
          body: JSON.stringify(priceCreatedPayload),
          headers: { 'content-type': 'application/json' },
        })
        // The service swallows the error and returns ok:true so Copilot doesn't
        // retry. The failure is observable only via qb_sync_logs.
        expect(res.status).toBe(200)
      },
    })

    // Order-of-operations regression guard: we got far enough to fetch the
    // Copilot product and attempt a QB item creation before the failure.
    expect(copilot.getProduct).toHaveBeenCalledWith(
      priceCreatedPayload.data.productId,
    )
    expect(intuit.createItem).toHaveBeenCalledTimes(1)

    // Transaction must have rolled back — no mapping row written
    const productRows = await db.select().from(QBProductSync)
    expect(productRows).toHaveLength(0)

    // FAILED log exists (written outside the tx in the catch block)
    const failedLogs = await db
      .select()
      .from(QBSyncLog)
      .where(eq(QBSyncLog.copilotPriceId, priceCreatedPayload.data.id))

    expect(failedLogs).toHaveLength(1)
    expect(failedLogs[0]).toMatchObject({
      portalId: TEST_PORTAL_ID,
      entityType: EntityType.PRODUCT,
      eventType: EventType.CREATED,
      status: LogStatus.FAILED,
      copilotId: priceCreatedPayload.data.productId,
      copilotPriceId: priceCreatedPayload.data.id,
    })
    expect(failedLogs[0].errorMessage).toContain('QuickBooks is on fire')
  })
})
