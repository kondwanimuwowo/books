import { createFileRoute } from '@tanstack/react-router'
import type { EmailOtpType } from '@supabase/supabase-js'
import { getDb } from '#/db/client.server'
import { adoptProviderName } from '#/server/members.server'
import { getSupabase } from '#/server/supabase.server'

// Plain Response (not Response.redirect) so the session cookies from the exchange can be appended.
function redirectTo(path: string) {
  return new Response(null, { status: 303, headers: { Location: path } })
}

const OTP_TYPES: EmailOtpType[] = ['signup', 'email', 'recovery', 'email_change', 'invite', 'magiclink']

// Landing point for Supabase email links (sign-up confirmation, password reset) and Google sign-in.
export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const next = url.searchParams.get('next') ?? '/'
        const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
        const tokenHash = url.searchParams.get('token_hash')
        const type = url.searchParams.get('type') as EmailOtpType | null
        const code = url.searchParams.get('code')

        // Token links (from our email templates) work in any browser, not just the one that asked.
        if (tokenHash && type && OTP_TYPES.includes(type)) {
          const { error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type })
          if (!error) return redirectTo(safeNext)
        } else if (code) {
          const { data, error } = await getSupabase().auth.exchangeCodeForSession(code)
          if (!error) {
            if (data.user.app_metadata.provider === 'google') await adoptProviderName(getDb(), data.user)
            return redirectTo(safeNext)
          }
        } else if (url.searchParams.has('error')) {
          // Google sends people back with ?error= when they cancel on its consent screen.
          return redirectTo(`/login?error=google&next=${encodeURIComponent(safeNext)}`)
        }
        return redirectTo('/login?error=link')
      },
    },
  },
})
