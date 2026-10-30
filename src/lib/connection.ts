/**
 * Whether an error came from the connection rather than from us: the browser is offline, a request couldn't reach
 * the server, or a read gave up waiting. A deploy's missing code files look similar and are handled separately.
 */
export function isConnectionError(error: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (!(error instanceof Error)) return false
  if (error.name === 'TimeoutError') return true
  return error instanceof TypeError && /failed to fetch|networkerror|load failed|network request failed/i.test(error.message) && !/import|module/i.test(error.message)
}
