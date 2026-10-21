import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '#/db/client.server'
import { isValidWebhookSignature } from '#/server/lenco.server'
import { settlePayment } from '#/server/orders.server'

// Never trusts the payload's status: settlePayment re-fetches it from Lenco.
export const Route = createFileRoute('/api/webhooks/lenco')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await isValidWebhookSignature(request.headers.get('x-lenco-signature')))) {
          return Response.json({ received: false }, { status: 401 })
        }
        const payload = (await request.json().catch(() => null)) as { data?: { reference?: string } } | null
        const reference = payload?.data?.reference
        if (!reference) return Response.json({ received: true }, { status: 400 })
        // Payout and other references aren't ours to settle here.
        if (!reference.startsWith('KB-')) return Response.json({ received: true })

        try {
          await settlePayment(getDb(), reference)
          return Response.json({ received: true })
        } catch (error) {
          console.error('Lenco webhook error', reference, error)
          // 500 makes Lenco retry delivery.
          return Response.json({ received: false }, { status: 500 })
        }
      },
    },
  },
})
