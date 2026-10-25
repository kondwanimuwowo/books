import { createFileRoute } from '@tanstack/react-router'
import { eq } from 'drizzle-orm'
import { getDb } from '#/db/client.server'
import { profiles } from '#/db/schema'
import { getSupabase } from '#/server/supabase.server'
import { readPrivate } from '#/server/private-files.server'

// Verification documents, for admins only. Never cached anywhere.
export const Route = createFileRoute('/admin-files/$key')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { data } = await getSupabase().auth.getClaims()
        const userId = data?.claims.sub
        const [profile] = userId ? await getDb().select({ isAdmin: profiles.isAdmin }).from(profiles).where(eq(profiles.id, userId)).limit(1) : []
        if (!profile?.isAdmin) return new Response('Not found', { status: 404 })
        const object = await readPrivate(params.key)
        if (!object) return new Response('Not found', { status: 404 })
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('cache-control', 'private, no-store')
        headers.set('x-robots-tag', 'noindex')
        return new Response(object.body, { headers })
      },
    },
  },
})
