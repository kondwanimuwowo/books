import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db/client.server'
import { requireUserMiddleware } from '#/server/auth'
import { rateSellerOrder } from '#/server/feedback.server'
import { readerStandings } from '#/server/reputation.server'
import { rateParcelSchema } from '#/schemas/feedback'

/** The buyer rates the shop, or the shop rates the buyer, once a parcel has been delivered. */
export const rateParcel = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(rateParcelSchema)
  .handler(({ data, context }) => rateSellerOrder(getDb(), context.user.id, data))

/** The reader's own badge and standing, shown only to them. */
export const getMyStanding = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(async ({ context }) => (await readerStandings(getDb(), [context.user.id])).get(context.user.id) ?? null)
