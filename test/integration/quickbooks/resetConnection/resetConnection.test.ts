import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { testApiHandler } from 'next-test-api-route-handler'
import { eq } from 'drizzle-orm'

import * as appHandler from '@/app/api/quickbooks/token/reset-connection/route'
import { db } from '@/db'
import { QBPortalConnection } from '@/db/schema/qbPortalConnections'
import { QBSetting } from '@/db/schema/qbSettings'
import { QBCustomers } from '@/db/schema/qbCustomers'
import { QBInvoiceSync } from '@/db/schema/qbInvoiceSync'
import { QBPaymentSync } from '@/db/schema/qbPaymentSync'
import { QBProductSync } from '@/db/schema/qbProductSync'
import { QBPayoutSync } from '@/db/schema/qbPayoutSync'
import { QBSyncLog } from '@/db/schema/qbSyncLogs'
import { QBConnectionLogs } from '@/db/schema/qbConnectionLogs'
import { truncateAllTestTables } from '@test/helpers/testDb'
import { installMockApis } from '@test/helpers/mocks'
import {
  seedHealthyPortal,
  seedQBCustomer,
  seedQBInvoiceSync,
  seedInvoiceCreatedLog,
  seedProductSync,
  TEST_PORTAL_ID,
  TEST_WEBHOOK_TOKEN,
} from '@test/helpers/seed'

const OTHER_PORTAL_ID = 'other-portal-99999999'

// Seeds one row in every portal-scoped table for the given portal.
async function seedFullPortal(portalId: string) {
  await seedHealthyPortal({
    portal: { portalId, intuitRealmId: `realm-${portalId}` },
    setting: { portalId },
  })
  await seedQBCustomer({ portalId })
  await seedQBInvoiceSync({ portalId })
  await seedInvoiceCreatedLog({ portalId })
  await seedProductSync({ portalId })
  await db.insert(QBConnectionLogs).values({ portalId })
  await db.insert(QBPaymentSync).values({
    portalId,
    invoiceNumber: 'INV-0001',
    totalAmount: '600.00',
    qbPaymentId: 'qb-pay-1',
    qbSyncToken: '0',
  })
  await db.insert(QBPayoutSync).values({
    portalId,
    payoutId: 'po_1',
    lineItems: [],
    netAmount: 1000,
    feeAmount: 30,
    arrivalDate: 1_700_000_000,
  })
}

describe('POST /api/quickbooks/token/reset-connection', () => {
  beforeEach(async () => {
    await truncateAllTestTables()
    installMockApis()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes the connection and all synced data for the authenticated portal', async () => {
    await seedFullPortal(TEST_PORTAL_ID)

    await testApiHandler({
      appHandler,
      url: `/api/quickbooks/token/reset-connection?token=${TEST_WEBHOOK_TOKEN}`,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST' })
        expect(res.status).toBe(200)
      },
    })

    const tables = [
      QBPortalConnection,
      QBSetting,
      QBCustomers,
      QBInvoiceSync,
      QBPaymentSync,
      QBProductSync,
      QBPayoutSync,
      QBSyncLog,
      QBConnectionLogs,
    ]
    for (const t of tables) {
      const rows = await db
        .select()
        .from(t)
        .where(eq(t.portalId, TEST_PORTAL_ID))
      expect(rows).toHaveLength(0)
    }
  })

  it('leaves other portals untouched', async () => {
    await seedFullPortal(TEST_PORTAL_ID)
    await seedFullPortal(OTHER_PORTAL_ID)

    await testApiHandler({
      appHandler,
      url: `/api/quickbooks/token/reset-connection?token=${TEST_WEBHOOK_TOKEN}`,
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'POST' })
        expect(res.status).toBe(200)
      },
    })

    const [otherConnection] = await db
      .select()
      .from(QBPortalConnection)
      .where(eq(QBPortalConnection.portalId, OTHER_PORTAL_ID))
    expect(otherConnection).toBeDefined()

    const otherCustomers = await db
      .select()
      .from(QBCustomers)
      .where(eq(QBCustomers.portalId, OTHER_PORTAL_ID))
    expect(otherCustomers.length).toBeGreaterThan(0)
  })
})
