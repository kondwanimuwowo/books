import { z } from 'zod'
import { SHIPPING_METHODS } from '#/data/shipping'
import { PROVINCES } from '#/data/zambia'
import { normalizeLocalPhone } from '#/lib/phone'

const zambianPhone = z.string().transform((v, ctx) => normalizeLocalPhone(v) ?? (ctx.addIssue({ code: 'custom', message: 'Enter a Zambian mobile number' }), z.NEVER))

export const linesSchema = z
  .array(z.object({ listingId: z.string().uuid(), quantity: z.number().int().min(1).max(50) }))
  .max(50)

export const placeSchema = z.object({ town: z.string().trim().min(2).max(60), province: z.enum(PROVINCES) })

export const quoteBagSchema = z.object({ lines: linesSchema, to: placeSchema.nullable() })

export type QuoteBagInput = z.infer<typeof quoteBagSchema>

export const placeOrderSchema = z.object({
  lines: linesSchema.min(1),
  shipTo: placeSchema.extend({
    name: z.string().trim().min(2).max(80),
    phone: zambianPhone,
    address: z.string().trim().max(300),
  }),
  methods: z.record(z.string(), z.enum(SHIPPING_METHODS)),
})

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>

export const orderNumberInput = z.object({ number: z.string().max(20) })

export const mobileMoneySchema = z.object({
  number: z.string().max(20),
  phone: zambianPhone,
  operator: z.enum(['mtn', 'airtel', 'zamtel']),
})

export type MobileMoneyInput = z.infer<typeof mobileMoneySchema>

export const paymentReferenceInput = z.object({ reference: z.string().max(60) })

export const sellerOrderInput = z.object({ sellerOrderId: z.string().uuid() })

export const reportProblemSchema = z.object({ sellerOrderId: z.string().uuid(), note: z.string().trim().min(10).max(1000) })

export const disputeResponseSchema = z.object({
  sellerOrderId: z.string().uuid(),
  note: z.string().trim().min(10, 'Say what happened').max(1000),
  proofKey: z.string().max(64).optional(),
})

export type DisputeResponseInput = z.infer<typeof disputeResponseSchema>

export const markShippedSchema = z.object({ sellerOrderId: z.string().uuid(), trackingNote: z.string().trim().min(3).max(300), proofKey: z.string().max(64).optional() })

export type MarkShippedInput = z.infer<typeof markShippedSchema>
