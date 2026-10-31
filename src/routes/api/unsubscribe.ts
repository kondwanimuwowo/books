import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db/client.server'
import { unsubscribeByToken } from '#/server/newsletter.server'
import { unsubscribeSchema } from '#/schemas/emails'

// The mail app's own Unsubscribe button (List-Unsubscribe-Post, RFC 8058): a POST with no page.
export const Route = createFileRoute('/api/unsubscribe')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url)
        const input = unsubscribeSchema.safeParse({ token: url.searchParams.get('t'), list: url.searchParams.get('list') })
        if (!input.success) return new Response(null, { status: 400 })
        await unsubscribeByToken(getDb(), input.data)
        return new Response(null, { status: 200 })
      },
    },
  },
})
