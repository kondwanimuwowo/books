import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db/client.server'
import { requireUserMiddleware } from '#/server/auth'
import { createOffer, listMyOffers, respondToOffer, withdrawBuyerOffer } from '#/server/offers.server'
import { answerOfferSchema, makeOfferSchema, offerIdInput } from '#/schemas/offers'

export const makeOffer = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(makeOfferSchema)
  .handler(({ data, context }) => createOffer(getDb(), context.user.id, data))

/** Whoever's turn it is accepts, declines or counters. */
export const answerOffer = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(answerOfferSchema)
  .handler(({ data, context }) => respondToOffer(getDb(), context.user.id, data))

export const withdrawOffer = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(offerIdInput)
  .handler(({ data, context }) => withdrawBuyerOffer(getDb(), context.user.id, data.offerId))

export const getMyOffers = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => listMyOffers(getDb(), context.user.id))
