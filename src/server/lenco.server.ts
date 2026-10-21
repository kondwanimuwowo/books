import { env } from 'cloudflare:workers'
import { toMsisdn } from '#/lib/phone'
import type { Operator } from '#/lib/phone'

// Server-only Lenco v2 client, ported from titunge/src/lib/lenco.ts.
// Amounts are whole currency units as decimals ("10.75"), not ngwee.

function baseUrl() {
  return env.LENCO_SANDBOX === 'true' ? 'https://sandbox.lenco.co/access/v2' : 'https://api.lenco.co/access/v2'
}

function headers(): HeadersInit {
  if (!env.LENCO_API_SECRET_KEY) throw new Error('LENCO_API_SECRET_KEY is not configured')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LENCO_API_SECRET_KEY}` }
}

interface Envelope<T> {
  status: boolean
  message: string
  data: T
}

async function request<T>(path: string, init: { method: 'GET' } | { method: 'POST'; body: Record<string, unknown> }): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: init.method,
    headers: headers(),
    body: init.method === 'POST' ? JSON.stringify(init.body) : undefined,
  })
  const json = (await response.json()) as Envelope<T>
  if (!response.ok || !json.status) throw new Error(json.message || `Lenco request to ${path} failed`)
  return json.data
}

export type CollectionStatus = 'pending' | 'successful' | 'failed' | 'pay-offline' | '3ds-auth-required' | 'processing'

export interface LencoCollection {
  id: string
  amount: string
  currency: string
  reference: string
  lencoReference: string
  type: 'card' | 'mobile-money' | 'bank-account' | null
  status: CollectionStatus
  reasonForFailure: string | null
}

export function isPendingStatus(status: CollectionStatus) {
  return status === 'pending' || status === 'pay-offline' || status === 'processing' || status === '3ds-auth-required'
}

export function initiateMobileMoneyCollection(params: {
  amount: string
  phone: string
  operator: Operator
  reference: string
  email?: string
}) {
  return request<LencoCollection>('/collections/mobile-money', {
    method: 'POST',
    body: {
      amount: params.amount,
      phone: toMsisdn(params.phone),
      operator: params.operator,
      reference: params.reference,
      country: 'zm',
      currency: 'ZMW',
      bearer: 'merchant',
      email: params.email,
    },
  })
}

export function getCollectionStatus(reference: string) {
  return request<LencoCollection>(`/collections/status/${encodeURIComponent(reference)}`, { method: 'GET' })
}

export interface LencoTransfer {
  id: string
  amount: string
  status: 'pending' | 'successful' | 'failed'
  lencoReference: string
  reasonForFailure?: string | null
}

export function createMobileMoneyRecipient(phone: string, operator: Operator) {
  return request<{ id: string; details: { accountName: string } }>('/transfer-recipients/mobile-money', {
    method: 'POST',
    body: { phone: toMsisdn(phone), operator, country: 'zm' },
  })
}

export function resolveMobileMoney(phone: string, operator: Operator) {
  return request<{ accountName: string }>('/resolve/mobile-money', {
    method: 'POST',
    body: { phone: toMsisdn(phone), operator, country: 'zm' },
  })
}

export function initiateMobileMoneyTransfer(params: { recipientId: string; amount: string; reference: string; narration: string }) {
  if (!env.LENCO_PAYOUT_ACCOUNT_ID) throw new Error('LENCO_PAYOUT_ACCOUNT_ID is not configured')
  return request<LencoTransfer>('/transfers/mobile-money', {
    method: 'POST',
    body: {
      accountId: env.LENCO_PAYOUT_ACCOUNT_ID,
      transferRecipientId: params.recipientId,
      amount: params.amount,
      reference: params.reference,
      narration: params.narration,
    },
  })
}

// The webhook signature scheme isn't in the offline docs (same gap titunge hit), so this check is
// best-effort; callers must re-verify with getCollectionStatus before trusting anything.
export async function isValidWebhookSignature(signature: string | null) {
  const token = env.LENCO_WEBHOOK_HASH_KEY
  if (!token) return true
  if (!signature) return false
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const expected = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
  return signature.toLowerCase() === expected
}
