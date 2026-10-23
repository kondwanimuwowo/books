import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getAdminContext } from '#/functions/admin.functions'

// Admin lives on its own host (ADMIN_ORIGIN) with its own sign-in; src/router.tsx maps
// admin.<domain>/x onto these /admin/x routes. Opened anywhere else, it redirects there.
export const Route = createFileRoute('/admin')({
  beforeLoad: async ({ location }) => {
    const admin = await getAdminContext()
    if (!admin.onAdminHost && admin.adminOrigin) {
      const rest = location.pathname.replace(/^\/admin/, '') || '/'
      throw redirect({ href: `${admin.adminOrigin}${rest}${location.searchStr}` })
    }
    return { admin }
  },
  head: () => ({ meta: [{ title: 'Kuwala Books Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: Outlet,
})
