import { useApp } from '@/app/context/AppContext'
import { InvoiceSettingType } from '@/type/common'
import { getWorkspaceLabel } from '@/utils/workspace'
import { Checkbox, Spinner } from 'copilot-design-system'

type InvoiceDetailProps = {
  settingState: InvoiceSettingType
  changeSettings: (flag: keyof InvoiceSettingType, state: boolean) => void
  isLoading: boolean
}

export default function InvoiceDetail({
  settingState,
  changeSettings,
  isLoading,
}: InvoiceDetailProps) {
  const { workspace } = useApp()

  if (isLoading) {
    return <Spinner size={5} />
  }

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
              if (!newValue && settingState.bankDepositFeeFlag) {
                changeSettings('bankDepositFeeFlag', false)
              }
            }}
          />
        </div>
        {settingState.absorbedFeeFlag && (
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
