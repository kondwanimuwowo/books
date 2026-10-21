import { env } from 'cloudflare:workers'
import { createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'

// Supabase Auth only. App data goes through Drizzle (src/db), never PostgREST.
export function getSupabase() {
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }))
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          setCookie(name, value, {
            ...options,
            sameSite: typeof options.sameSite === 'string' ? options.sameSite : 'lax',
          })
        }
      },
    },
  })
}
