import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { testApiHandler } from 'next-test-api-route-handler'

import { db } from '@/db'
import { QBProductSync } from '@/db/schema/qbProductSync'
import { QBSyncLog } from '@/db/schema/qbSyncLogs'
import * as appHandler from '@/app/api/quickbooks/webhook/route'

import priceCreatedPayload from '../../fixtures/priceCreated.webhook.json'
import { truncateAllTestTables } from '../../helpers/testDb'
import { seedHealthyPortal, TEST_PORTAL_ID } from '../../helpers/seed'
import {
  installMockApis,
  type MockCopilotAPI,
  type MockIntuitAPI,
} from '../../helpers/mocks'

/**
 * Idempotency: re-sending the same price.created webhook must not create a
 * duplicate mapping. ProductService#webhookPriceCreated short-circuits when it
 * finds an existing qb_product_sync row with the same productId AND priceId.
 */
describe('POST /api/quickbooks/webhook — price.created (idempotency)', () => {
  let copilot: MockCopilotAPI
  let intuit: MockIntuitAPI

  beforeEach(async () => {
    await truncateAllTestTables()
    ;({ copilot, intuit } = installMockApis())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('skips QB calls and writes no new rows when the price is already mapped', async () => {
    await seedHealthyPortal()

    // Pre-existing mapping for THIS exact productId + priceId.
    // Direct insert intentionally bypasses ProductService.createQBProduct so
    // the test doesn't exercise a second request path; if the duplicate-check
    // logic ever starts depending on extra fields (description, copilotName),
    // this seed may need to match those shape requirements.
    await db.insert(QBProductSync).values({
      portalId: TEST_PORTAL_ID,
      productId: priceCreatedPayload.data.productId,
      priceId: priceCreatedPayload.data.id,
      unitPrice: '60000.00',
      qbItemId: 'pre-existing-qb-item',
      qbSyncToken: '0',
      name: 'Test Product',
      copilotName: 'Test Product',
    })

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

    // Duplicate check runs BEFORE copilot.getProduct and any QB call, so
    // none of these external calls should fire at all.
    expect(copilot.getProduct).not.toHaveBeenCalled()
    expect(intuit.getAnItem).not.toHaveBeenCalled()
    expect(intuit.createItem).not.toHaveBeenCalled()

    // Still only one mapping row — the one we seeded — with its original qbItemId
    const productRows = await db.select().from(QBProductSync)
    expect(productRows).toHaveLength(1)
    expect(productRows[0].qbItemId).toBe('pre-existing-qb-item')

    // And no sync log row (early return skips logging)
    const logRows = await db.select().from(QBSyncLog)
    expect(logRows).toHaveLength(0)
  })
})
