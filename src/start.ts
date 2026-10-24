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

// Keep this file free of app imports: sharing modules with server functions here
// triggers Vite's cold-start SSR cycle and leaves their middleware undefined.
export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })],
  functionMiddleware: [hideInternalErrors],
}))
