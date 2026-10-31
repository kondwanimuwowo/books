import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { getDb } from '#/db/client.server'
import { unsubscribeEmail } from '#/server/newsletter.server'

// Brevo's marketing webhook, set up in its dashboard with ?key=BREVO_WEBHOOK_KEY. Anyone leaving the list there leaves it here.
const LEAVING = new Set(['unsubscribe', 'unsubscribed', 'spam', 'hard_bounce', 'hardBounce', 'contact_deleted', 'contactDeleted'])

export const Route = createFileRoute('/api/webhooks/brevo')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!env.BREVO_WEBHOOK_KEY || new URL(request.url).searchParams.get('key') !== env.BREVO_WEBHOOK_KEY) return new Response(null, { status: 401 })
        const payload = (await request.json().catch(() => null)) as { event?: string; email?: string } | { event?: string; email?: string }[] | null
        for (const event of Array.isArray(payload) ? payload : payload ? [payload] : []) {
          if (event.event && event.email && LEAVING.has(event.event)) await unsubscribeEmail(getDb(), event.email)
        }
        return Response.json({ received: true })
      },
    },
  },
})
