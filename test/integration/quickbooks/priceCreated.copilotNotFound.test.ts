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
  createMockCopilotAPI,
  installMockApis,
  type MockCopilotAPI,
  type MockIntuitAPI,
} from '../../helpers/mocks'

/**
 * Copilot product not found (deleted between webhook firing and handler
 * running, or stale cache). ProductService throws APIError(404). The
 * transaction rolls back, and the outer catch in WebhookService writes a
 * FAILED sync log.
 */
describe('POST /api/quickbooks/webhook — price.created (copilot product 404)', () => {
  let copilot: MockCopilotAPI
  let intuit: MockIntuitAPI

  beforeEach(async () => {
    await truncateAllTestTables()

    ;({ copilot, intuit } = installMockApis({
      copilot: createMockCopilotAPI({
        // Real CopilotAPI.getProduct returns undefined when the product
        // doesn't exist; the service treats that as a 404.
        getProduct: vi.fn().mockResolvedValue(undefined),
      }),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('writes a FAILED sync log and never touches QB', async () => {
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
        expect(res.status).toBe(200)
      },
    })

    // Pin down that the 404 path actually went through Copilot — a future
    // refactor that returns early before calling getProduct would otherwise
    // still pass the "no QB calls" assertions below.
    expect(copilot.getProduct).toHaveBeenCalledWith(
      priceCreatedPayload.data.productId,
    )

    // The 404 is raised BEFORE any QB call
    expect(intuit.getAnItem).not.toHaveBeenCalled()
    expect(intuit.createItem).not.toHaveBeenCalled()

    // No mapping row
    const productRows = await db.select().from(QBProductSync)
    expect(productRows).toHaveLength(0)

    // FAILED sync log
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
    expect(failedLogs[0].errorMessage).toMatch(/Product not found/i)
  })
})
