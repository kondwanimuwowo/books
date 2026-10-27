import { getRequest } from '@tanstack/react-start/server'
import { getSupabase } from './supabase.server'

export interface SessionUser {
  id: string
  email: string
}

// getClaims verifies the JWT locally against Supabase's cached JWKS instead of an
// Auth API round trip per call. Memoised per request so loaders running in parallel
// don't each refresh an expired session.
const perRequest = new WeakMap<Request, Promise<SessionUser | null>>()

// Native apps send their Supabase access token as a bearer header; the web uses cookies.
// A request that sends a header is judged on that token alone, never on cookies.
function bearerToken(request: Request) {
  const header = request.headers.get('authorization')
  if (!header) return undefined
  const match = /^Bearer\s+(\S+)$/i.exec(header)
  return match ? match[1] : ''
}

export function readUser(): Promise<SessionUser | null> {
  const request = getRequest()
  let user = perRequest.get(request)
  if (!user) {
    const token = bearerToken(request)
    user =
      token === ''
        ? Promise.resolve(null)
        : getSupabase()
            .auth.getClaims(token)
            .then(({ data }) => (data?.claims.email ? { id: data.claims.sub, email: data.claims.email } : null))
    perRequest.set(request, user)
  }
  return user
}
