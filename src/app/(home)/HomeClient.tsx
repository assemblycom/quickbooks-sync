'use client'
import { useState } from 'react'
import { useApp } from '@/app/context/AppContext'
import { Main as DashboardMain } from '@/components/dashboard/Main'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { postFetcher } from '@/helper/fetch.helper'
import { useAppBridge } from '@/hook/useQuickbooks'

export default function HomeClient() {
  const { token, portalConnectionStatus, isEnabled, syncFlag, setAppParams } =
    useApp()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // bridge related logics like disconnect app, reset connection and download sync log csv
  useAppBridge({
    token,
    isEnabled,
    syncFlag,
    connectionStatus: portalConnectionStatus,
    onReset: () => setShowResetConfirm(true),
  })

  const confirmReset = async () => {
    setShowResetConfirm(false)
    try {
      await postFetcher(
        `/api/quickbooks/token/reset-connection?token=${token}`,
        {},
        {},
        { timeoutMs: null },
      )
      // Realtime subs only track UPDATE, not DELETE — reset local state here.
      setAppParams((prev) => ({
        ...prev,
        portalConnectionStatus: false,
        syncFlag: false,
        isEnabled: false,
      }))
    } catch (err) {
      console.error('Error resetting QuickBooks connection', err)
    }
  }

  return (
    <div className="home-client-wrapper w-full h-full">
      <DashboardMain />
      <ConfirmModal
        open={showResetConfirm}
        title="Reset QuickBooks connection?"
        description="This removes the connected QuickBooks company and all synced mappings for this workspace. You'll need to reconnect and re-map your accounts. This can't be undone."
        confirmLabel="Reset connection"
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
