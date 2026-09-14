'use client'
import { useState } from 'react'
import { useApp } from '@/app/context/AppContext'
import { Main as DashboardMain } from '@/components/dashboard/Main'
import ConfirmModal from '@/components/ui/ConfirmModal'
import { postFetcher } from '@/helper/fetch.helper'
import { useAppBridge } from '@/hook/useQuickbooks'

export default function HomeClient() {
  const { token, portalConnectionStatus, isEnabled, syncFlag } = useApp()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  // bridge related logics like disconnect app, reset connection and download sync log csv
  useAppBridge({
    token,
    isEnabled,
    syncFlag,
    connectionStatus: portalConnectionStatus,
    onReset: () => setShowResetConfirm(true),
  })

  const confirmReset = async () => {
    if (isResetting) return
    setIsResetting(true)
    try {
      await postFetcher(
        `/api/quickbooks/token/reset-connection?token=${token}`,
        {},
        {},
        { timeoutMs: null },
      )
      // Reload for a fresh AppContext + SWR cache instead of hand-clearing each
      // connection-derived field; the deleted realm's data must not linger.
      window.location.reload()
    } catch (err) {
      // Leave the modal open and interactive on failure so the user can retry.
      console.error('Error resetting QuickBooks connection', err)
      setIsResetting(false)
    }
  }

  return (
    <div className="home-client-wrapper w-full h-full">
      <DashboardMain />
      <ConfirmModal
        open={showResetConfirm}
        title="Reset QuickBooks connection?"
        description="This removes the connected QuickBooks company and all synced mappings for this workspace. You'll need to reconnect and re-map your accounts. This can't be undone."
        confirmLabel={isResetting ? 'Resetting...' : 'Reset connection'}
        busy={isResetting}
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  )
}
