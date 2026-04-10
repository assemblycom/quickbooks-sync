import { after } from 'next/server'

/**
 * Runs the callback via Next.js `after()` if inside a request scope,
 * otherwise executes it directly. This allows shared service code to
 * work in both Vercel serverless (request context) and Trigger.dev /
 * CLI (no request context) environments.
 *
 * `after()` is a pure registration call — the only errors it can throw
 * are scope/context errors. Real callback errors are handled separately
 * via `.catch()` in the fallback path.
 */
export function afterIfAvailable(callback: () => Promise<void>): void {
  try {
    after(callback)
  } catch {
    void callback().catch((err) => {
      console.error('[afterIfAvailable] callback failed:', err)
    })
  }
}
