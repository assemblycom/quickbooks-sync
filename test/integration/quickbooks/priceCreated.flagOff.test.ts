import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { testApiHandler } from 'next-test-api-route-handler'

import { db } from '@/db'
import { QBProductSync } from '@/db/schema/qbProductSync'
import { QBSyncLog } from '@/db/schema/qbSyncLogs'
import * as appHandler from '@/app/api/quickbooks/webhook/route'

import priceCreatedPayload from '../../fixtures/priceCreated.webhook.json'
import { truncateAllTestTables } from '../../helpers/testDb'
import { seedHealthyPortal } from '../../helpers/seed'
import {
  installMockApis,
  type MockCopilotAPI,
  type MockIntuitAPI,
} from '../../helpers/mocks'

describe('POST /api/quickbooks/webhook — price.created (createNewProductFlag=false)', () => {
  let copilot: MockCopilotAPI
  let intuit: MockIntuitAPI

  beforeEach(async () => {
    await truncateAllTestTables()
    ;({ copilot, intuit } = installMockApis())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 without syncing, makes no product API calls, writes no rows', async () => {
    await seedHealthyPortal({ setting: { createNewProductFlag: false } })

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

    // The flag gate sits BEFORE the switch in WebhookService#handleWebhookEvent,
    // so no product-side API calls fire.
    expect(copilot.getProduct).not.toHaveBeenCalled()
    expect(intuit.getAnItem).not.toHaveBeenCalled()
    expect(intuit.createItem).not.toHaveBeenCalled()

    // And no mapping / sync log rows should exist.
    const productRows = await db.select().from(QBProductSync)
    expect(productRows).toHaveLength(0)

    const logRows = await db.select().from(QBSyncLog)
    expect(logRows).toHaveLength(0)
  })
})
