import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'

// Errors the app throws on purpose are plain Errors (or validation errors) written for people.
// Anything else (database, network, bugs) can carry SQL or internals: log it here, send a generic one.
const hideInternalErrors = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    // notFound() and redirect() are thrown as non-Error values and must pass through.
    if (!(error instanceof Error) || error.constructor === Error || error.name === 'ZodError') throw error
    console.error('[server fn]', error)
    throw new Error('That didn’t work on our side. Try again in a moment')
  }
})

// Page data that takes this long isn't coming; better to say the connection is slow than to spin forever.
// Reads only: an action like a payment is never abandoned halfway.
const SLOW_READ_MS = 20_000
const giveUpOnSlowReads = createMiddleware({ type: 'function' }).client(({ method, fetch: given, next }) => {
  if (method !== 'GET' || typeof AbortSignal.any !== 'function') return next()
  const send = given ?? fetch
  return next({
    fetch: (input, init) => {
      const timeout = AbortSignal.timeout(SLOW_READ_MS)
      return send(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout })
    },
  })
})

// Keep this file free of app imports: sharing modules with server functions here
// triggers Vite's cold-start SSR cycle and leaves their middleware undefined.
export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })],
  functionMiddleware: [giveUpOnSlowReads, hideInternalErrors],
}))
