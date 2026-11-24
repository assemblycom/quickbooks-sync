import { describe, it, expect } from 'vitest'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { QBSyncLog } from '@/db/schema/qbSyncLogs'
import { EventType, LogStatus } from '@/app/api/core/types/log'
import { InvoiceStatus } from '@/app/api/core/types/invoice'

import { invoiceDeletedPayload } from '@test/fixtures/invoiceDeleted.webhook'
import {
  seedHealthyPortal,
  seedQBCustomer,
  seedQBInvoiceSync,
  seedInvoiceCreatedLog,
  TEST_INVOICE_NUMBER,
  TEST_COPILOT_INVOICE_ID,
} from '@test/helpers/seed'
import { setupInvoiceDeletedTest } from '@test/helpers/invoiceDeletedTestSetup'
import { postWebhook } from '@test/helpers/webhook'

const SUFFIXED_DOC_NUMBER = `${TEST_INVOICE_NUMBER}-1`

const getDeletedLogs = () =>
  db
    .select()
    .from(QBSyncLog)
    .where(
      and(
        eq(QBSyncLog.copilotId, TEST_COPILOT_INVOICE_ID),
        eq(QBSyncLog.eventType, EventType.DELETED),
      ),
    )

describe('POST /api/quickbooks/webhook — invoice.deleted (QBO DocNumber was suffixed on create)', () => {
  const apis = setupInvoiceDeletedTest()

  it('looks the invoice up in QuickBooks by the stored DocNumber', async () => {
    await seedHealthyPortal()
    const customer = await seedQBCustomer()
    await seedQBInvoiceSync({
      customerId: customer.id,
      status: InvoiceStatus.VOID,
      qbDocNumber: SUFFIXED_DOC_NUMBER,
    })
    await seedInvoiceCreatedLog()

    const res = await postWebhook(invoiceDeletedPayload)
    expect(res.status).toBe(200)

    expect(apis.intuit.getInvoice).toHaveBeenCalledWith(SUFFIXED_DOC_NUMBER)
    expect(apis.intuit.deleteInvoice).toHaveBeenCalledTimes(1)
    const [log] = await getDeletedLogs()
    expect(log.status).toBe(LogStatus.SUCCESS)
  })

  it('treats an already-deleted sync row as done, even when another QBO invoice has the Copilot number', async () => {
    await seedHealthyPortal()
    const customer = await seedQBCustomer()
    await seedQBInvoiceSync({
      customerId: customer.id,
      status: InvoiceStatus.DELETED,
      qbDocNumber: SUFFIXED_DOC_NUMBER,
    })
    await seedInvoiceCreatedLog()

    const res = await postWebhook(invoiceDeletedPayload)
    expect(res.status).toBe(200)

    expect(apis.intuit.getInvoice).not.toHaveBeenCalled()
    expect(apis.intuit.deleteInvoice).not.toHaveBeenCalled()
    const logs = await getDeletedLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe(LogStatus.SUCCESS)
    expect(logs[0].errorMessage).toBeNull()
  })
})
