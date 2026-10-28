import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { getRequest, setCookie } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import { consents, profiles } from '#/db/schema'
import { TERMS_VERSION } from '#/data/legal'
import { optionalUserMiddleware, requireUserMiddleware } from '#/server/auth'
import { getSupabase } from '#/server/supabase.server'
import { AppError } from '#/server/errors.server'
import { OAUTH_NEXT_COOKIE } from '#/server/session.server'

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
      // A conscious tick: the account isn't created without it.
      acceptTerms: z.literal(true, { error: 'Tick the box to agree to the terms' }),
      next: nextPath,
    }),
  )
  .handler(async ({ data }) => {
    const callback = new URL('/auth/callback', env.APP_ORIGIN)
    // Always present: the email template appends &token_hash=… to this URL.
    callback.searchParams.set('next', data.next ?? '/')
    // The database trigger that creates the profile records this acceptance (profiles and consents).
    const userAgent = getRequest().headers.get('user-agent')?.slice(0, 300) ?? ''
    const { data: result, error } = await getSupabase().auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { display_name: data.name, terms_version: TERMS_VERSION, user_agent: userAgent }, emailRedirectTo: callback.toString() },
    })
    if (error) throw new AppError(error.message)
    // With email confirmation on, there's no session until they click the link.
    return { needsConfirmation: !result.session }
  })

export const signIn = createServerFn({ method: 'POST' })
  .validator(z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) }))
  .handler(async ({ data }) => {
    const { data: result, error } = await getSupabase().auth.signInWithPassword(data)
    if (error || !result.user?.email) throw new AppError('Wrong email or password', 'unauthorized')
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

// Returns Google's consent URL; the PKCE verifier rides in a cookie set here and is read back in /auth/callback.
// Terms are accepted afterwards through the TermsGate, since Google sign-ups never see the checkbox.
export const signInWithGoogle = createServerFn({ method: 'POST' })
  .validator(z.object({ next: nextPath }))
  .handler(async ({ data }) => {
    // The bare callback URL, so it matches Supabase's redirect allowlist exactly; where to go next waits in a cookie.
    setCookie(OAUTH_NEXT_COOKIE, data.next ?? '/', { path: '/auth', maxAge: 600, httpOnly: true, sameSite: 'lax', secure: env.APP_ORIGIN.startsWith('https') })
    const { data: result, error } = await getSupabase().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('/auth/callback', env.APP_ORIGIN).toString(), skipBrowserRedirect: true },
    })
    if (error || !result.url) throw new AppError('Google sign-in isn’t available right now. Use your email instead.')
    return { url: result.url }
  })

/** A signed-in person ticks the box to accept the current terms (existing accounts, or after a material change). */
export const acceptTerms = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ accept: z.literal(true, { error: 'Tick the box to agree to the terms' }) }))
  .handler(async ({ context }) => {
    const db = getDb()
    const userAgent = getRequest().headers.get('user-agent')?.slice(0, 300) ?? null
    await db.update(profiles).set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() }).where(eq(profiles.id, context.user.id))
    await db.insert(consents).values({ profileId: context.user.id, document: 'terms', version: TERMS_VERSION, userAgent })
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
    callback.searchParams.set('next', '/account/settings')
    // Same response whether or not the email exists.
    await getSupabase().auth.resetPasswordForEmail(data.email, { redirectTo: callback.toString() })
    return { ok: true }
  })

export const updatePassword = createServerFn({ method: 'POST' })
  .validator(z.object({ password: z.string().min(8).max(128) }))
  .handler(async ({ data }) => {
    const { error } = await getSupabase().auth.updateUser({ password: data.password })
    if (error) throw new AppError(error.message)
    return { ok: true }
  })

export const getSessionUser = createServerFn({ method: 'GET' })
  .middleware([optionalUserMiddleware])
  .handler(({ context }) => context.user)
