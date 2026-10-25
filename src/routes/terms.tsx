import { createFileRoute, redirect } from '@tanstack/react-router'

// The legal pages live under /legal; this short address is kept for links already shared.
export const Route = createFileRoute('/terms')({
  beforeLoad: () => {
    throw redirect({ to: '/legal/$page', params: { page: 'terms' }, statusCode: 301 })
  },
})
