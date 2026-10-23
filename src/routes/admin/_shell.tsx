import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminShell } from '#/components/admin-shell'

// UX guard; every admin server function checks the admin flag itself.
export const Route = createFileRoute('/admin/_shell')({
  beforeLoad: ({ context, location }) => {
    if (!context.admin.user?.isAdmin) throw redirect({ to: '/admin/login', search: { next: location.href } })
  },
  component: ShellLayout,
})

function ShellLayout() {
  const { admin } = Route.useRouteContext()
  return (
    <AdminShell email={admin.user?.email ?? ''} storeUrl={admin.appOrigin}>
      <Outlet />
    </AdminShell>
  )
}
