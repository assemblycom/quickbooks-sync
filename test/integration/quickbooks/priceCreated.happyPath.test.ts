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
import { installMockApis } from '../../helpers/mocks'

describe('POST /api/quickbooks/webhook — price.created (happy path)', () => {
  beforeEach(async () => {
    await truncateAllTestTables()
    installMockApis()
  })

  afterEach(() => {
    // clearAllMocks (not restoreAllMocks) — the module-level mock factories in
    // test/integration/setup.ts must stay installed across tests; we only want
    // to reset call counts and implementations set in beforeEach.
    vi.clearAllMocks()
  })

  it('creates the QB item, writes qb_product_sync row, and logs SUCCESS', async () => {
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
        await expect(res.json()).resolves.toEqual({ ok: true })
      },
    })

    // ---- Assert the product mapping was persisted ----
    const productSyncRows = await db
      .select()
      .from(QBProductSync)
      .where(eq(QBProductSync.priceId, priceCreatedPayload.data.id))

    expect(productSyncRows).toHaveLength(1)
    expect(productSyncRows[0]).toMatchObject({
      portalId: TEST_PORTAL_ID,
      productId: priceCreatedPayload.data.productId,
      priceId: priceCreatedPayload.data.id,
      qbItemId: '999',
      qbSyncToken: '0',
      // price is stored in cents as a decimal string
      unitPrice: '60000.00',
      copilotName: 'Test Product',
    })

    // ---- Assert a SUCCESS sync log was written ----
    const syncLogs = await db
      .select()
      .from(QBSyncLog)
      .where(eq(QBSyncLog.copilotPriceId, priceCreatedPayload.data.id))

    expect(syncLogs).toHaveLength(1)
    expect(syncLogs[0]).toMatchObject({
      portalId: TEST_PORTAL_ID,
      entityType: EntityType.PRODUCT,
      eventType: EventType.CREATED,
      status: LogStatus.SUCCESS,
      copilotId: priceCreatedPayload.data.productId,
      copilotPriceId: priceCreatedPayload.data.id,
      quickbooksId: '999',
    })
  })
})
