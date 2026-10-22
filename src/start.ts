import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

// Keep this file free of app imports: sharing modules with server functions here
// triggers Vite's cold-start SSR cycle and leaves their middleware undefined.
export const startInstance = createStart(() => ({
  requestMiddleware: [createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === 'serverFn' })],
}))
