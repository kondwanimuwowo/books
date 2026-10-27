import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db/client.server'
import { optionalUserMiddleware, requireSellerMiddleware, requireUserMiddleware } from '#/server/auth'
import { checkBuyerPayment, loadCheckoutDefaults, placeBuyerOrder, quoteBagFor, startCard, startMobileMoney } from '#/server/checkout.server'
import { orNotFound } from '#/server/errors.server'
import { answerDispute, confirmBuyerDelivery, listBuyerOrders, listSales, loadBuyerOrder, reportBuyerProblem, shipSellerOrder } from '#/server/fulfilment.server'
import {
  disputeResponseSchema,
  markShippedSchema,
  mobileMoneySchema,
  orderNumberInput,
  paymentReferenceInput,
  placeOrderSchema,
  quoteBagSchema,
  reportProblemSchema,
  sellerOrderInput,
} from '#/schemas/orders'

export const quoteBag = createServerFn({ method: 'POST' })
  .middleware([optionalUserMiddleware])
  .validator(quoteBagSchema)
  .handler(({ data, context }) => quoteBagFor(getDb(), context.user?.id ?? null, data))

export const placeOrder = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(placeOrderSchema)
  .handler(({ data, context }) => placeBuyerOrder(getDb(), context.user.id, data))

export const getOrder = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .validator(orderNumberInput)
  .handler(({ data, context }) => orNotFound(loadBuyerOrder(getDb(), context.user.id, data.number)))

export const getMyOrders = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => listBuyerOrders(getDb(), context.user.id))

export const startMobileMoneyPayment = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(mobileMoneySchema)
  .handler(({ data, context }) => orNotFound(startMobileMoney(getDb(), context.user, data)))

export const startCardPayment = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(orderNumberInput)
  .handler(({ data, context }) => orNotFound(startCard(getDb(), context.user, data.number)))

export const checkPayment = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(paymentReferenceInput)
  .handler(({ data, context }) => orNotFound(checkBuyerPayment(getDb(), context.user.id, data.reference)))

export const confirmDelivered = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(sellerOrderInput)
  .handler(({ data, context }) => orNotFound(confirmBuyerDelivery(getDb(), context.user.id, data.sellerOrderId)))

export const reportProblem = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(reportProblemSchema)
  .handler(({ data, context }) => orNotFound(reportBuyerProblem(getDb(), context.user, data.sellerOrderId, data.note)))

export const respondToDispute = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(disputeResponseSchema)
  .handler(({ data, context }) => answerDispute(getDb(), context.seller, data))

export const getMySales = createServerFn({ method: 'GET' })
  .middleware([requireSellerMiddleware])
  .handler(({ context }) => listSales(getDb(), context.seller.id))

export const markShipped = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator(markShippedSchema)
  .handler(({ data, context }) => shipSellerOrder(getDb(), context.seller, data))

export const getCheckoutDefaults = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => loadCheckoutDefaults(getDb(), context.user.id))
