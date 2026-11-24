import { describe, it, expect, vi, beforeEach } from 'vitest'
import httpStatus from 'http-status'
import { NextRequest } from 'next/server'

const captureException = vi.fn()
const scope = {
  setTag: vi.fn(),
  setLevel: vi.fn(),
  setFingerprint: vi.fn(),
  addEventProcessor: vi.fn(),
}
vi.mock('@sentry/nextjs', () => ({
  withScope: (fn: (s: typeof scope) => void) => fn(scope),
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
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('reports our own 401s as one grouped warning', async () => {
    const res = await run(
      new APIError(httpStatus.UNAUTHORIZED, 'Please provide a valid token'),
    )

    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({
      error: 'Please provide a valid token',
    })
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(scope.setLevel).toHaveBeenCalledWith('warning')
    expect(scope.setFingerprint).toHaveBeenCalledWith(['api-auth-rejection'])
    expect(scope.setTag).toHaveBeenCalledWith('authRejection', 'true')
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
  ])('reports upstream 401s (%s) as errors', async (_, error) => {
    const res = await run(error)

    expect(res.status).toBe(401)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(scope.setLevel).not.toHaveBeenCalled()
    expect(scope.setFingerprint).not.toHaveBeenCalled()
  })

  it('reports other APIErrors as errors', async () => {
    const res = await run(new APIError(httpStatus.NOT_FOUND, 'Not found'))

    expect(res.status).toBe(404)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(scope.setLevel).not.toHaveBeenCalled()
  })
})
