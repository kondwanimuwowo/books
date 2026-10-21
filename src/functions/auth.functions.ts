import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { profiles } from '#/db/schema'
import { optionalUserMiddleware } from '#/server/auth'
import { getSupabase } from '#/server/supabase.server'

// Safe in-app paths only, so ?next= can't bounce people to another site.
const nextPath = z
  .string()
  .regex(/^\/(?!\/)/)
  .optional()

export const signUp = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email(),
      password: z.string().min(8).max(128),
      next: nextPath,
    }),
  )
  .handler(async ({ data }) => {
    const callback = new URL('/auth/callback', env.APP_ORIGIN)
    if (data.next) callback.searchParams.set('next', data.next)
    const { data: result, error } = await getSupabase().auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.name }, emailRedirectTo: callback.toString() },
    })
    if (error) throw new Error(error.message)
    // With email confirmation on, there's no session until they click the link.
    return { needsConfirmation: !result.session }
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    const { data: result, error } = await getSupabase().auth.signInWithPassword(data)
    if (error || !result.user?.email) throw new Error('Wrong email or password')
    // Backstop for the on_auth_user_created trigger.
    await getDb()
      .insert(profiles)
      .values({
        id: result.user.id,
        email: result.user.email,
        displayName: String(result.user.user_metadata.display_name ?? result.user.email.split('@')[0]),
      })
      .onConflictDoNothing()
    return { ok: true }
  })

export const signOut = createServerFn({ method: 'POST' })
  .handler(async () => {
    await getSupabase().auth.signOut()
    return { ok: true }
  })

export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().trim().email() }))
  .handler(async ({ data }) => {
    const callback = new URL('/auth/callback', env.APP_ORIGIN)
    callback.searchParams.set('next', '/account/password')
    // Same response whether or not the email exists.
    await getSupabase().auth.resetPasswordForEmail(data.email, { redirectTo: callback.toString() })
    return { ok: true }
  })

export const updatePassword = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    const { error } = await getSupabase().auth.updateUser({ password: data.password })
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getSessionUser = createServerFn({ method: 'GET' })
  .middleware([optionalUserMiddleware])
  .handler(({ context }) => context.user)
