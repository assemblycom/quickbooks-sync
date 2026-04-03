import APIError from '@/app/api/core/exceptions/api'
import { BaseService } from '@/app/api/core/services/base.service'
import { SettingService } from '@/app/api/quickbooks/setting/setting.service'
import { AccountTypeObj } from '@/constant/qbConnection'
import { buildReturningFields } from '@/db/helper/drizzle.helper'
import {
  QBPortalConnectionCreateSchema,
  QBPortalConnectionCreateSchemaType,
  QBPortalConnection,
  QBPortalConnectionSelectSchemaType,
  QBPortalConnectionUpdateSchema,
  QBPortalConnectionUpdateSchemaType,
} from '@/db/schema/qbPortalConnections'
import { QBSetting, QBSettingsUpdateSchemaType } from '@/db/schema/qbSettings'
import { getPortalConnection } from '@/db/service/token.service'
import { AccountType, ChangeEnableStatusRequestType } from '@/type/common'
import IntuitAPI from '@/utils/intuitAPI'
import CustomLogger from '@/utils/logger'
import dayjs from 'dayjs'
import { and, eq, SQL } from 'drizzle-orm'
import httpStatus from 'http-status'

type WhereClause = SQL<unknown>

export class TokenService extends BaseService {
  async getOneByPortalId(
    portalId: string,
  ): Promise<QBPortalConnectionSelectSchemaType | null> {
    const portalConnection = await getPortalConnection(portalId)

    return portalConnection
  }

  async createQBPortalConnection(
    payload: QBPortalConnectionCreateSchemaType,
    returningFields?: (keyof typeof QBPortalConnection)[],
  ) {
    const parsedInsertPayload = QBPortalConnectionCreateSchema.parse(payload)
    const query = this.db.insert(QBPortalConnection).values(parsedInsertPayload)

    const [token] = returningFields?.length
      ? await query.returning(
          buildReturningFields(QBPortalConnection, returningFields),
        )
      : await query.returning()

    return token
  }

  async upsertQBPortalConnection(
    payload: QBPortalConnectionCreateSchemaType,
    returningFields?: (keyof typeof QBPortalConnection)[],
  ) {
    const parsedInsertPayload = QBPortalConnectionCreateSchema.parse(payload)
    const query = this.db
      .insert(QBPortalConnection)
      .values(parsedInsertPayload)
      .onConflictDoUpdate({
        target: QBPortalConnection.portalId,
        set: { ...parsedInsertPayload, updatedAt: dayjs().toDate() },
      })

    const [token] = returningFields?.length
      ? await query.returning(
          buildReturningFields(QBPortalConnection, returningFields),
        )
      : await query.returning()

    return token
  }

  async updateQBPortalConnection(
    payload: QBPortalConnectionUpdateSchemaType,
    conditions: WhereClause,
    returningFields?: (keyof typeof QBPortalConnection)[],
  ) {
    const parsedInsertPayload = QBPortalConnectionUpdateSchema.parse(payload)

    const query = this.db
      .update(QBPortalConnection)
      .set(parsedInsertPayload)
      .where(conditions)

    const [token] = returningFields?.length
      ? await query.returning(
          buildReturningFields(QBPortalConnection, returningFields),
        )
      : await query.returning()

    return token
  }

  async turnOffSync(intuitRealmId: string) {
    const portalId = this.user.workspaceId
    // update db sync status for the defined portal
    const whereConditions = eq(QBSetting.portalId, portalId)

    const updateSyncPayload: QBSettingsUpdateSchemaType = {
      syncFlag: false,
    }

    const settingService = new SettingService(this.user)
    const updateSync = await settingService.updateQBSettings(
      updateSyncPayload,
      whereConditions,
    )

    if (!updateSync) {
      throw new APIError(
        httpStatus.INTERNAL_SERVER_ERROR,
        `Cannot update sync status for portal ${portalId} and realmId ${intuitRealmId}.`,
      )
    }
    return updateSync
  }

  async changeEnableStatus(
    portalId: string,
    parsedBody: ChangeEnableStatusRequestType,
  ) {
    const whereConditions = and(
      eq(QBSetting.portalId, portalId),
      eq(QBSetting.syncFlag, true),
    ) as SQL

    const settingService = new SettingService(this.user)
    const portal = await settingService.updateQBSettings(
      {
        isEnabled: parsedBody.enable,
      },
      whereConditions,
    )

    if (!portal) {
      throw new APIError(
        httpStatus.BAD_REQUEST,
        `Cannot update sync status for portal ${portalId}.`,
      )
    }
    return portal
  }

  private async updateAccountMapping(
    accountType: AccountType,
    realmId: string,
    accountRef: string,
  ) {
    let payload = {}
    switch (accountType) {
      case AccountTypeObj.Income:
        payload = { incomeAccountRef: accountRef }
        break
      case AccountTypeObj.Expense:
        payload = { expenseAccountRef: accountRef }
        break
      case AccountTypeObj.Asset:
        payload = { assetAccountRef: accountRef }
        break
      default:
        throw new APIError(
          httpStatus.BAD_REQUEST,
          `Cannot update account mapping for account type ${accountType}`,
        )
    }
    await this.updateQBPortalConnection(
      payload,
      and(
        eq(QBPortalConnection.portalId, this.user.workspaceId),
        eq(QBPortalConnection.intuitRealmId, realmId),
      ) as WhereClause,
    )
  }

  private async manageIncomeAccountRef(intuitApi: IntuitAPI): Promise<string> {
    const existingIncomeAccRef = await intuitApi.getSingleIncomeAccount()
    if (existingIncomeAccRef?.Id) {
      return existingIncomeAccRef.Id
    }

    console.info(
      'TokenService#manageIncomeAccountRef | No existing income account found. Creating new one.',
    )

    const payload = {
      Name: 'Assembly SOP Income',
      Classification: 'Revenue',
      AccountType: 'Income',
      AccountSubType: 'SalesOfProductIncome',
      Active: true,
    }
    const incomeAccRef = await intuitApi.createAccount(payload)
    return incomeAccRef.Id
  }

  private async manageExpenseAccountRef(intuitApi: IntuitAPI): Promise<string> {
    const accName = 'Assembly Processing Fees'
    const existingAccount = await intuitApi.getAnAccount(accName)
    if (existingAccount?.Id) {
      return existingAccount.Id
    }

    const payload = {
      Name: accName,
      Classification: 'Expense',
      AccountType: 'Expense',
      AccountSubType: 'FinanceCosts',
      Active: true,
    }
    const expenseAccRef = await intuitApi.createAccount(payload)
    return expenseAccRef.Id
  }

  private async manageAssetAccountRef(intuitApi: IntuitAPI): Promise<string> {
    const accName = 'Assembly General Asset'
    const existingAccount = await intuitApi.getAnAccount(accName)
    if (existingAccount?.Id) {
      return existingAccount.Id
    }

    // Need to create this account as the source of cash for the company. This account will be referenced while creating a purchase as Expense for absorbed fee.
    // Docs: https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account#the-account-object
    const payload = {
      Name: accName,
      Classification: 'Asset',
      AccountType: 'Bank', // Create Bank account. Default account subtype is "CashOnHand".
      Active: true,
    }
    const assetAccRef = await intuitApi.createAccount(payload)
    return assetAccRef.Id
  }

  private async restoreAccountRef(
    accountType: AccountType,
    intuitApi: IntuitAPI,
  ): Promise<string> {
    switch (accountType) {
      case AccountTypeObj.Income:
        return this.manageIncomeAccountRef(intuitApi)
      case AccountTypeObj.Expense:
        return this.manageExpenseAccountRef(intuitApi)
      case AccountTypeObj.Asset:
        return this.manageAssetAccountRef(intuitApi)
      default:
        throw new APIError(
          httpStatus.BAD_REQUEST,
          `Cannot restore account ref for account type ${accountType}`,
        )
    }
  }

  async checkAndUpdateAccountStatus(
    accountType: AccountType,
    realmId: string,
    intuitApi: IntuitAPI,
    accountId?: string,
  ) {
    if (!accountId) {
      console.info(
        `TokenService#checkAndUpdateAccountStatus. No accountId provided for ${accountType}. Restoring account ref...`,
      )
      const restoredRef = await this.restoreAccountRef(accountType, intuitApi)
      await this.updateAccountMapping(accountType, realmId, restoredRef)
      return restoredRef
    }

    console.info(
      'TokenService#checkAndUpdateAccountStatus. Updating account status ...',
    )

    // 1. get account by ID
    let account = await intuitApi.getAnAccount(undefined, accountId, true)

    CustomLogger.info({
      obj: { account },
      message:
        'TokenService#checkAndUpdateAccountStatus. Account query response',
    })

    // if no account found, restore account ref
    if (!account) {
      console.info(
        `TokenService#checkAndUpdateAccountStatus. Account not found for Id ${accountId} in QuickBooks. Restoring account ref...`,
      )
      const restoredRef = await this.restoreAccountRef(accountType, intuitApi)
      await this.updateAccountMapping(accountType, realmId, restoredRef)
      return restoredRef
    } else if (!account.Active) {
      console.info(
        `TokenService#checkAndUpdateAccountStatus. Account with Id ${accountId} is inactive. Making it active...`,
      )
      // if item is inactive, make it active
      const updateRes = await intuitApi.updateAccount({
        Id: account.Id,
        Name: account.Name,
        SyncToken: account.SyncToken,
        Active: true,
        sparse: true,
      })
      account = updateRes.Account

      CustomLogger.info({
        obj: { account },
        message:
          'TokenService#checkAndUpdateAccountStatus. Account made active.',
      })
    }

    return account.Id
  }
}
