import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RetryableError } from '@/utils/error'
import { withRetry } from '@/app/api/core/utils/withRetry'

vi.mock('@sentry/nextjs', () => ({
  withScope: vi.fn(),
}))

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')

    const result = await withRetry(fn, ['arg1'])

    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('arg1')
  })

  it('retries on 429 and succeeds', async () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 })
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce('recovered')

    const promise = withRetry(fn, [])
    await vi.runAllTimersAsync()

    expect(await promise).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('retries on RetryableError with retry=true', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError(500, 'transient', true))
      .mockResolvedValueOnce('ok')

    const promise = withRetry(fn, [])
    await vi.runAllTimersAsync()

    expect(await promise).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('does not retry on RetryableError with retry=false', async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new RetryableError(500, 'permanent', false))

    await expect(withRetry(fn, [])).rejects.toThrow('permanent')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry on non-429 status errors', async () => {
    const error = Object.assign(new Error('bad request'), { status: 400 })
    const fn = vi.fn().mockRejectedValue(error)

    await expect(withRetry(fn, [])).rejects.toThrow('bad request')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('exhausts retries and throws on persistent 429', async () => {
    const error = Object.assign(new Error('rate limited'), { status: 429 })
    const fn = vi.fn().mockRejectedValue(error)

    // Attach rejection handler before advancing timers to avoid unhandled rejection
    const promise = withRetry(fn, []).catch((e: Error) => e)
    await vi.runAllTimersAsync()

    const result = await promise
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toBe('rate limited')
    // 1 initial + 3 retries = 4 total
    expect(fn).toHaveBeenCalledTimes(4)
  })
})
