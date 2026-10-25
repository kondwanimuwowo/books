import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { LocationRewrite } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

// admin.<domain>/sellers is served by the /admin/sellers routes; links on that host print without the prefix.
const ADMIN_PREFIX = '/admin'
// Requests the router never renders as pages: server functions, server routes and auth callbacks.
const PASSTHROUGH = ['/_serverFn', '/api/', '/auth/', '/covers/', '/admin-files/']

const isAdminHost = (url: URL) => url.hostname.startsWith('admin.')
const hasAdminPrefix = (path: string) => path === ADMIN_PREFIX || path.startsWith(`${ADMIN_PREFIX}/`)

const adminSubdomain: LocationRewrite = {
  input: ({ url }) => {
    if (!isAdminHost(url) || hasAdminPrefix(url.pathname) || PASSTHROUGH.some((p) => url.pathname.startsWith(p))) return undefined
    url.pathname = url.pathname === '/' ? ADMIN_PREFIX : `${ADMIN_PREFIX}${url.pathname}`
    return url
  },
  output: ({ url }) => {
    if (!isAdminHost(url) || !hasAdminPrefix(url.pathname)) return undefined
    url.pathname = url.pathname.slice(ADMIN_PREFIX.length) || '/'
    return url
  },
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultPendingMs: 300,
    defaultPendingMinMs: 400,
    rewrite: adminSubdomain,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
