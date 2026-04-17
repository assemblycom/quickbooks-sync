# Intuit API: Auto Token Refresh on 401

## Problem

The `IntuitAPI` class sets the access token once at construction and never updates it.
If the token expires mid-request or between construction and usage, the Intuit API
returns HTTP 401. The current code has three issues:

1. **`fetch.helper.ts`** — `getFetcher`/`postFetcher` do not check `response.ok`.
   A 401 response is parsed as JSON and passed through as if it were valid data.

2. **Silent null propagation** — When `customQuery` receives a 401 error body, it
   often lacks a `QueryResponse` key, so it returns `undefined`. Callers like
   `getAnAccount` treat this as "account not found" and return `null`, which triggers
   the restore/create path instead of surfacing the real auth error.

3. **No 401 retry** — `withRetry` (pRetry wrapper) only retries on HTTP 429
   (rate limit). Expired token errors are not retried or refreshed.

## Solution

Instead of throwing on non-200, we refresh the access token and retry the request.
This is handled inside `IntuitAPI`'s two HTTP methods (`getFetchWithHeader` and
`postFetchWithHeaders`), keeping it transparent to all callers.

### Changes

1. **Add optional `portalId` to `IntuitAPI` constructor** — needed by
   `getRefreshedQbTokenInfo()` to look up the refresh token and persist new tokens.

2. **Replace usage of `fetch.helper` in IntuitAPI with direct `fetch`** — so we
   can inspect `response.status` before parsing JSON.

3. **On HTTP 401: refresh token and retry once** — call `getRefreshedQbTokenInfo`,
   update `this.tokens` and `this.headers`, retry the original request. Only retry
   once to avoid infinite loops.

4. **On other non-200 (not 401): throw immediately** — surface the real error
   instead of silently returning null.

5. **No change to `fetch.helper.ts`** — it is used by frontend SWR and other code,
   so we avoid breaking those callers.

### Why handle it in `getFetchWithHeader`/`postFetchWithHeaders`?

- All IntuitAPI methods go through these two functions.
- Keeps retry + refresh logic in one place.
- Callers (services, controllers) don't need any changes.
- The `portalId` is already available in every calling context.
