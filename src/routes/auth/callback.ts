import { createFileRoute } from '@tanstack/react-router'
import { getSupabase } from '#/server/supabase.server'

// Plain Response (not Response.redirect) so the session cookies from the code exchange can be appended.
function redirectTo(path: string) {
  return new Response(null, { status: 303, headers: { Location: path } })
}

// Landing point for Supabase email links (sign-up confirmation, password reset).
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const next = url.searchParams.get('next') ?? '/'
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

        if (code) {
          const { error } = await getSupabase().auth.exchangeCodeForSession(code)
          if (!error) return redirectTo(safeNext)
        }
        return redirectTo('/login?error=link')
      },
    },
  },
})
