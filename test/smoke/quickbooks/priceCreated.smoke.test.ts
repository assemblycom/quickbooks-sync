import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { QBProductSync } from '@/db/schema/qbProductSync'
import { QBSyncLog } from '@/db/schema/qbSyncLogs'
import { EntityType, EventType, LogStatus } from '@/app/api/core/types/log'

import priceCreatedPayload from '@test/fixtures/priceCreated.webhook.json'
import { truncateAllTestTables } from '@test/helpers/testDb'
import { seedSmokeHealthyPortal, SMOKE_PORTAL_ID } from '@test/helpers/smokeSeed'
import { installSmokeCopilotMock } from '@test/helpers/smokeMocks'
import { postWebhook } from '@test/helpers/webhook'

/**
 * End-to-end smoke covering the `price.created` webhook against real QB
 * sandbox + real DB (testcontainers). Copilot is mocked — see
 * `docs/nightly-qb-smoke-test.md` for why.
 *
 * The runId suffix in the mocked product name makes the derived QB item
 * name unique per run, so archived items from prior runs can't collide
 * with this one's Item.Name uniqueness constraint.
 */
describe('POST /api/quickbooks/webhook — price.created (smoke)', () => {
  const runId = process.env.GITHUB_RUN_ID ?? randomUUID()
  let productId: string
  let priceId: string

  beforeAll(async () => {
    await truncateAllTestTables()
    await seedSmokeHealthyPortal()
    const handle = installSmokeCopilotMock({ runId })
    productId = handle.productId
    priceId = handle.priceId
  })

  it('creates a QB item in the sandbox and persists the mapping', async () => {
    // Clone the fixture so we can inject our run-scoped IDs without mutating
    // the shared JSON import (Vitest caches JSON imports across tests).
    const payload = {
      ...priceCreatedPayload,
      data: {
        ...priceCreatedPayload.data,
        id: priceId,
        productId,
      },
    }

    const res = await postWebhook(payload)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true })

    const productSyncRows = await db
      .select()
      .from(QBProductSync)
      .where(eq(QBProductSync.priceId, priceId))

    expect(productSyncRows).toHaveLength(1)
    const row = productSyncRows[0]
    expect(row.portalId).toBe(SMOKE_PORTAL_ID)
    expect(row.productId).toBe(productId)
    // Real QB assigns the Id — just check it's present and non-empty.
    expect(row.qbItemId).toMatch(/^\d+$/)
    expect(row.qbSyncToken).toBeDefined()

    const syncLogs = await db
      .select()
      .from(QBSyncLog)
      .where(eq(QBSyncLog.copilotPriceId, priceId))

    expect(syncLogs).toHaveLength(1)
    expect(syncLogs[0]).toMatchObject({
      portalId: SMOKE_PORTAL_ID,
      entityType: EntityType.PRODUCT,
      eventType: EventType.CREATED,
      status: LogStatus.SUCCESS,
      copilotPriceId: priceId,
    })
  })
})
