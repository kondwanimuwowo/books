import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionUser } from '#/functions/auth.functions'

// Page-level guard for UX only; every server function these pages call checks auth itself.
export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ location }) => {
    const user = await getSessionUser()
    if (!user) throw redirect({ to: '/login', search: { next: location.href } })
    return { user }
  },
  component: Outlet,
})
