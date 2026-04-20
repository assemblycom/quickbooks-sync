import { useApp } from '@/app/context/AppContext'
import { BankAccountType } from '@/hook/useSettings'
import { InvoiceSettingType } from '@/type/common'
import { getWorkspaceLabel } from '@/utils/workspace'
import { Checkbox, Spinner } from 'copilot-design-system'
import { useEffect, useRef, useState } from 'react'

type InvoiceDetailProps = {
  settingState: InvoiceSettingType
  changeSettings: (flag: keyof InvoiceSettingType, state: boolean) => void
  isLoading: boolean
  bankDepositEnabled: boolean
  bankAccounts: BankAccountType[]
  isBankAccountsLoading: boolean
  selectBankAccount: (ref: string) => void
}

export default function InvoiceDetail({
  settingState,
  changeSettings,
  isLoading,
  bankDepositEnabled,
  bankAccounts,
  isBankAccountsLoading,
  selectBankAccount,
}: InvoiceDetailProps) {
  const { workspace } = useApp()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (isLoading) {
    return <Spinner size={5} />
  }

  const selectedAccount = bankAccounts.find(
    (acc) => acc.Id === settingState.bankAccountRef,
  )

  return (
    <>
      <div className="mt-2 mb-6">
        <div className="mb-5">
          <Checkbox
            label="Add absorbed fees to an Expense Account in QuickBooks"
            description="Record Assembly processing fees as expenses in the 'Assembly Processing Fees' expense account in QuickBooks."
            checked={settingState.absorbedFeeFlag}
            onChange={() => {
              const newValue = !settingState.absorbedFeeFlag
              changeSettings('absorbedFeeFlag', newValue)
              // Turn off bank deposit flag if absorbed fees is being disabled
              // Only cascade when the bank deposit feature is visible to the user
              if (
                bankDepositEnabled &&
                !newValue &&
                settingState.bankDepositFeeFlag
              ) {
                changeSettings('bankDepositFeeFlag', false)
              }
            }}
          />
        </div>
        {bankDepositEnabled && settingState.absorbedFeeFlag && (
          <div className="mb-5 ml-6">
            <Checkbox
              label="Create bank deposits for automatic bank reconciliation"
              description="When payments are received, create QuickBooks bank deposits that match the net amount deposited to your bank (after Stripe fees), making bank transaction matching automatic."
              checked={settingState.bankDepositFeeFlag}
              onChange={() =>
                changeSettings(
                  'bankDepositFeeFlag',
                  !settingState.bankDepositFeeFlag,
                )
              }
            />
          </div>
        )}
        {bankDepositEnabled &&
          settingState.absorbedFeeFlag &&
          settingState.bankDepositFeeFlag && (
            <div className="mb-5 ml-6" ref={dropdownRef}>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Bank account for deposits
              </label>
              <p className="text-body-xs text-gray-500 mb-2">
                Select the QuickBooks bank account where Stripe deposits land.
              </p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full max-w-[320px] flex items-center justify-between rounded-sm border border-gray-200 bg-white px-3 py-2 text-sm text-left hover:bg-gray-100 transition-colors"
                >
                  <span
                    className={
                      selectedAccount ? 'text-gray-700' : 'text-gray-400'
                    }
                  >
                    {isBankAccountsLoading
                      ? 'Loading accounts...'
                      : selectedAccount
                        ? selectedAccount.Name
                        : 'Select a bank account...'}
                  </span>
                  <svg
                    className={`h-4 w-4 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isDropdownOpen && (
                  <div className="absolute z-100 mt-1 w-full max-w-[320px] bg-white border border-gray-150 rounded-sm shadow-popover-050">
                    {isBankAccountsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Spinner size={5} />
                      </div>
                    ) : bankAccounts.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No bank accounts found in QuickBooks
                      </div>
                    ) : (
                      bankAccounts.map((account) => (
                        <button
                          key={account.Id}
                          type="button"
                          onClick={() => {
                            selectBankAccount(account.Id)
                            setIsDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors cursor-pointer ${
                            account.Id === settingState.bankAccountRef
                              ? 'bg-gray-100 text-gray-700 font-medium'
                              : 'text-gray-600'
                          }`}
                        >
                          {account.Name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {!isBankAccountsLoading &&
                !settingState.bankAccountRef &&
                bankAccounts.length > 0 && (
                  <p className="text-body-xs text-amber-600 mt-1">
                    Please select a bank account to enable bank deposits.
                  </p>
                )}
            </div>
          )}
        <div className="mb-6">
          <Checkbox
            label={`Use ${getWorkspaceLabel(workspace).groupTerm} name when syncing invoices billed to ${getWorkspaceLabel(workspace).groupTermPlural}`}
            description={`Create QuickBooks customers using the ${getWorkspaceLabel(workspace).groupTerm} name rather than individual ${getWorkspaceLabel(workspace).individualTerm} names when invoices are billed to ${getWorkspaceLabel(workspace).groupTermPlural}.`}
            checked={settingState.useCompanyNameFlag}
            onChange={() =>
              changeSettings(
                'useCompanyNameFlag',
                !settingState.useCompanyNameFlag,
              )
            }
          />
        </div>
      </div>
    </>
  )
}
