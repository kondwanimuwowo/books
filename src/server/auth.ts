import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { getDb } from '#/db/client.server'
import { profiles, sellers } from '#/db/schema'
import { getSupabase } from './supabase.server'

export interface SessionUser {
  id: string
  email: string
}

// getClaims verifies the JWT locally against Supabase's cached JWKS instead of an
// Auth API round trip per call. Memoised per request so loaders running in parallel
// don't each refresh an expired session.
const perRequest = new WeakMap<Request, Promise<SessionUser | null>>()

function readUser(): Promise<SessionUser | null> {
  const request = getRequest()
  let user = perRequest.get(request)
  if (!user) {
    user = getSupabase()
      .auth.getClaims()
      .then(({ data }) => (data?.claims.email ? { id: data.claims.sub, email: data.claims.email } : null))
    perRequest.set(request, user)
  }
  return user
}

export const optionalUserMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  return next({ context: { user: await readUser() } })
})

export const requireUserMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await readUser()
  if (!user) throw new Error('Please sign in to continue')
  return next({ context: { user } })
})

export const requireSellerMiddleware = createMiddleware({ type: 'function' })
  .middleware([requireUserMiddleware])
  .server(async ({ next, context }) => {
    const db = getDb()
    const [seller] = await db.select().from(sellers).where(eq(sellers.profileId, context.user.id)).limit(1)
    if (!seller) throw new Error('Set up your seller profile first')
    return next({ context: { seller } })
  })

export const requireAdminMiddleware = createMiddleware({ type: 'function' })
  .middleware([requireUserMiddleware])
  .server(async ({ next, context }) => {
    const db = getDb()
    const [profile] = await db.select({ isAdmin: profiles.isAdmin }).from(profiles).where(eq(profiles.id, context.user.id)).limit(1)
    if (!profile?.isAdmin) throw new Error('Not allowed')
    return next()
  })
