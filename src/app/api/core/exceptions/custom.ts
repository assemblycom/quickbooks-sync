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
 */
export function isIntuitOAuthError(
  error: unknown,
): error is { error: string; error_description: string; intuit_tid: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as any).error === 'string' &&
    'error_description' in error &&
    typeof (error as any).error_description === 'string' &&
    'intuit_tid' in error &&
    typeof (error as any).intuit_tid === 'string'
  )
}
