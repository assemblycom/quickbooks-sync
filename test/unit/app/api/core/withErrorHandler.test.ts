import { describe, it, expect, vi, beforeEach } from 'vitest'
import httpStatus from 'http-status'
import { NextRequest } from 'next/server'

const captureException = vi.fn()
vi.mock('@sentry/nextjs', () => ({
  withScope: (fn: (scope: unknown) => void) =>
    fn({ setTag: vi.fn(), addEventProcessor: vi.fn() }),
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: vi.fn(),
}))

import APIError from '@/app/api/core/exceptions/api'
import { CopilotApiError } from '@/type/CopilotApiError'
import { HttpFetchError } from '@/utils/error'
import { withErrorHandler } from '@/app/api/core/utils/withErrorHandler'

const run = (error: unknown) =>
  withErrorHandler(async () => {
    throw error
  })(new NextRequest('http://localhost/api/test'), {})

describe('withErrorHandler', () => {
  beforeEach(() => {
    captureException.mockClear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('returns 401 without reporting to Sentry for auth rejections', async () => {
    const res = await run(
      new APIError(httpStatus.UNAUTHORIZED, 'Please provide a valid token'),
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: 'Please provide a valid token',
    })
    expect(captureException).not.toHaveBeenCalled()
  })

  it.each([
    [
      'CopilotApiError',
      new CopilotApiError(httpStatus.UNAUTHORIZED, { message: 'bad key' }),
    ],
    [
      'HttpFetchError',
      new HttpFetchError({
        status: httpStatus.UNAUTHORIZED,
        statusText: 'Unauthorized',
        url: 'https://example.com',
        body: null,
      }),
    ],
  ])('still reports upstream 401s (%s) to Sentry', async (_, error) => {
    const res = await run(error)

    expect(res.status).toBe(401)
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it('still reports other APIErrors to Sentry', async () => {
    const res = await run(new APIError(httpStatus.NOT_FOUND, 'Not found'))

    expect(res.status).toBe(404)
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
