import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { testApiHandler } from 'next-test-api-route-handler'

import { db } from '@/db'
import { QBProductSync } from '@/db/schema/qbProductSync'
import * as appHandler from '@/app/api/quickbooks/webhook/route'

import priceCreatedPayload from '../../fixtures/priceCreated.webhook.json'
import { truncateAllTestTables } from '../../helpers/testDb'
import { seedHealthyPortal, TEST_PORTAL_ID } from '../../helpers/seed'
import { installMockApis, type MockIntuitAPI } from '../../helpers/mocks'

/**
 * Multi-price: when a product already has a price mapped to QB, a new price
 * for the SAME product gets a " (N)" suffix on the QB item name so the two
 * QB items are distinguishable (QB item names must be unique per company).
 *
 * N = number of existing mappings for that productId.
 */
describe('POST /api/quickbooks/webhook — price.created (second price for same product)', () => {
  // Copilot mock is installed (required for auth + getProduct) but this test
  // does not assert on it directly — behavior is visible via the QB item name.
  let intuit: MockIntuitAPI

  beforeEach(async () => {
    await truncateAllTestTables()
    ;({ intuit } = installMockApis())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('suffixes the new QB item name with " (1)" and inserts a new mapping row', async () => {
    await seedHealthyPortal()

    // Existing mapping: same productId, DIFFERENT priceId (first price already mapped)
    const existingPriceId = 'C-existing-price-id'
    await db.insert(QBProductSync).values({
      portalId: TEST_PORTAL_ID,
      productId: priceCreatedPayload.data.productId,
      priceId: existingPriceId,
      unitPrice: '10000.00',
      qbItemId: 'qb-item-first',
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

    // The QB lookup + create should both use the suffixed name
    const suffixedName = 'Test Product (1)'
    expect(intuit.getAnItem).toHaveBeenCalledWith(suffixedName, undefined, true)
    expect(intuit.createItem).toHaveBeenCalledTimes(1)
    expect(intuit.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: suffixedName,
        UnitPrice: 600, // 60000 cents / 100
      }),
    )

    // Two mapping rows now exist; the new one carries the suffixed name
    const allRows = await db.select().from(QBProductSync)
    expect(allRows).toHaveLength(2)

    const newRow = await db
      .select()
      .from(QBProductSync)
      .where(eq(QBProductSync.priceId, priceCreatedPayload.data.id))
    expect(newRow).toHaveLength(1)
    expect(newRow[0]).toMatchObject({
      productId: priceCreatedPayload.data.productId,
      priceId: priceCreatedPayload.data.id,
      name: suffixedName,
      qbItemId: '999',
    })
  })
})
