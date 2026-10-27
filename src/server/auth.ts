import { createMiddleware } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getDb } from '#/db/client.server'
import { profiles, sellers } from '#/db/schema'
import { AppError } from './errors.server'
import { readUser } from './session.server'

export type { SessionUser } from './session.server'

export const optionalUserMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  return next({ context: { user: await readUser() } })
})

export const requireUserMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = await readUser()
  if (!user) throw new AppError('Please sign in to continue', 'unauthorized')
  return next({ context: { user } })
})

export const requireSellerMiddleware = createMiddleware({ type: 'function' })
  .middleware([requireUserMiddleware])
  .server(async ({ next, context }) => {
    const db = getDb()
    const [seller] = await db.select().from(sellers).where(eq(sellers.profileId, context.user.id)).limit(1)
    if (!seller) throw new AppError('Set up your seller profile first', 'forbidden')
    return next({ context: { seller } })
  })

export const requireAdminMiddleware = createMiddleware({ type: 'function' })
  .middleware([requireUserMiddleware])
  .server(async ({ next, context }) => {
    const db = getDb()
    const [profile] = await db.select({ isAdmin: profiles.isAdmin }).from(profiles).where(eq(profiles.id, context.user.id)).limit(1)
    if (!profile?.isAdmin) throw new AppError('Not allowed', 'forbidden')
    return next()
  })
