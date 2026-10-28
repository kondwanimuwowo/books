import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { deleteAccount, deletionBlockers } from '#/server/accounts.server'
import { requireUserMiddleware } from '#/server/auth'
import { getSupabase } from '#/server/supabase.server'

export const getDeletionBlockers = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => deletionBlockers(getDb(), context.user.id))

export const deleteMyAccount = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ confirmEmail: z.string().max(320) }))
  .handler(async ({ data, context }) => {
    await deleteAccount(getDb(), context.user, data.confirmEmail)
    // The user no longer exists, so only this device's cookies need clearing.
    await getSupabase().auth.signOut({ scope: 'local' })
    return { ok: true }
  })
