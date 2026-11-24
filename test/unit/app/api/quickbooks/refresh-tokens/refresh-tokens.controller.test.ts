import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const config = vi.hoisted(() => ({
  cronSecret: 'secret' as string | undefined,
}))
const captureMessage = vi.fn()

vi.mock('@/config', () => config)
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (...args: unknown[]) => captureMessage(...args),
}))
vi.mock('@/app/api/quickbooks/refresh-tokens/refresh-tokens.service', () => ({
  refreshExpiringTokens: vi.fn().mockResolvedValue({ refreshed: 0 }),
}))

import { refreshExpiringTokensCron } from '@/app/api/quickbooks/refresh-tokens/refresh-tokens.controller'

const request = (auth?: string) =>
  new NextRequest('http://localhost/api/quickbooks/refresh-tokens', {
    headers: auth ? { authorization: auth } : {},
  })

describe('refreshExpiringTokensCron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    config.cronSecret = 'secret'
  })

  it('reports an error to Sentry when CRON_SECRET is not set', async () => {
    config.cronSecret = undefined

    await expect(
      refreshExpiringTokensCron(request('Bearer undefined')),
    ).rejects.toMatchObject({ status: 401 })
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('CRON_SECRET is not set'),
      'error',
    )
  })

  it('rejects a wrong secret without an extra Sentry error', async () => {
    await expect(
      refreshExpiringTokensCron(request('Bearer nope')),
    ).rejects.toMatchObject({ status: 401 })
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('runs the refresh with the right secret', async () => {
    const res = await refreshExpiringTokensCron(request('Bearer secret'))

    expect(res.status).toBe(200)
    expect(captureMessage).not.toHaveBeenCalled()
  })
})
