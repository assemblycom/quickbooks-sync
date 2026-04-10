/**
 * Sometimes Intuit-SDK throws AxiosError. This custom helper function helps to identify the error.
 * @param error
 * @returns
 */
export function isAxiosError(
  error: unknown,
): error is { response: { status: number; data: any } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as any).response === 'object' &&
    'status' in (error as any).response
  )
}

/**
 * Intuit-Oauth has its own error format response.
 * Format: { error: string, error_description: string, intuit_tid: string }
 *
 * Wrapping in an Error subclass so pRetry doesn't discard the original fields.
 */
export class IntuitOAuthError extends Error {
  error: string
  error_description: string
  intuit_tid: string

  constructor(raw: {
    error: string
    error_description: string
    intuit_tid: string
  }) {
    super(raw.error_description)
    this.name = 'IntuitOAuthError'
    this.error = raw.error
    this.error_description = raw.error_description
    this.intuit_tid = raw.intuit_tid
  }

  static fromRaw(error: unknown): IntuitOAuthError | null {
    const err = error as Record<string, unknown>
    if (
      typeof error === 'object' &&
      error !== null &&
      typeof err.intuit_tid === 'string' &&
      typeof err.error === 'string' &&
      typeof err.error_description === 'string'
    ) {
      return new IntuitOAuthError(
        err as {
          error: string
          error_description: string
          intuit_tid: string
        },
      )
    }
    return null
  }
}

export function isIntuitOAuthError(error: unknown): error is IntuitOAuthError {
  return error instanceof IntuitOAuthError
}
