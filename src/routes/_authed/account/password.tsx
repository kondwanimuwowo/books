import { createFileRoute, redirect } from '@tanstack/react-router'

// Password moved into Settings; password-reset emails already sent still point here.
export const Route = createFileRoute('/_authed/account/password')({
  beforeLoad: () => {
    throw redirect({ to: '/account/settings', replace: true })
  },
})
