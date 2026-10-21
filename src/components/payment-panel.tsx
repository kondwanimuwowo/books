import { CreditCard, Loader2, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { checkPayment, startCardPayment, startMobileMoneyPayment } from '#/functions/orders.functions'
import { detectOperator, OPERATOR_LABELS } from '#/lib/phone'
import type { Operator } from '#/lib/phone'
import { formatMoney } from '#/lib/money'
import { cn } from '#/lib/utils'
import { Alert, Field, errorMessage } from './form'

declare global {
  interface Window {
    LencoPay?: {
      getPaid: (options: {
        key: string
        reference: string
        email: string
        amount: number
        currency: 'ZMW'
        channels: ('card' | 'mobile-money')[]
        customer: { firstName: string; lastName: string; phone: string }
        onSuccess: (response: { reference: string }) => void
        onClose: () => void
        onConfirmationPending: () => void
      }) => void
    }
  }
}

type Stage = { kind: 'idle' } | { kind: 'starting' } | { kind: 'waiting'; reference: string; method: 'mobile_money' | 'card' } | { kind: 'failed'; reason: string }

const POLL_MS = 4000
const POLL_LIMIT_MS = 3 * 60_000

function loadLencoScript(sandbox: boolean) {
  const src = sandbox ? 'https://pay.sandbox.lenco.co/js/v1/inline.js' : 'https://pay.lenco.co/js/v1/inline.js'
  return new Promise<void>((resolve, reject) => {
    if (window.LencoPay) return resolve()
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load the card payment form. Check your connection.'))
    document.head.appendChild(script)
  })
}

export function PaymentPanel({ orderNumber, totalNgwee, defaultPhone, onPaid }: { orderNumber: string; totalNgwee: number; defaultPhone: string; onPaid: () => void }) {
  const [method, setMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  const [phone, setPhone] = useState(defaultPhone)
  const [operator, setOperator] = useState<Operator | null>(detectOperator(defaultPhone))
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })
  const startedAt = useRef(0)

  // Polls our server, which asks Lenco; the webhook settles it too, whichever lands first.
  useEffect(() => {
    if (stage.kind !== 'waiting') return
    startedAt.current = Date.now()
    let timer: ReturnType<typeof setTimeout>
    let stopped = false
    const tick = async () => {
      try {
        const result = await checkPayment({ data: { reference: stage.reference } })
        if (stopped) return
        if (result.status === 'successful') return onPaid()
        if (result.status === 'failed') return setStage({ kind: 'failed', reason: result.reason ?? 'The payment was declined.' })
      } catch {
        // Network blip: keep polling.
      }
      if (Date.now() - startedAt.current > POLL_LIMIT_MS) {
        return setStage({ kind: 'failed', reason: 'We didn’t get a confirmation in time. If money left your account, refresh this page in a minute.' })
      }
      timer = setTimeout(tick, POLL_MS)
    }
    timer = setTimeout(tick, POLL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [stage, onPaid])

  const payMobile = async () => {
    if (!operator) return setStage({ kind: 'failed', reason: 'Choose your mobile money network' })
    setStage({ kind: 'starting' })
    try {
      const result = await startMobileMoneyPayment({ data: { number: orderNumber, phone, operator } })
      setStage(result.status === 'failed' ? { kind: 'failed', reason: result.reason ?? 'The payment could not be started.' } : { kind: 'waiting', reference: result.reference, method: 'mobile_money' })
    } catch (e) {
      setStage({ kind: 'failed', reason: errorMessage(e) })
    }
  }

  const payCard = async () => {
    setStage({ kind: 'starting' })
    try {
      const params = await startCardPayment({ data: { number: orderNumber } })
      await loadLencoScript(params.sandbox)
      window.LencoPay?.getPaid({
        key: params.publicKey,
        reference: params.reference,
        email: params.email,
        amount: params.amount,
        currency: 'ZMW',
        channels: ['card'],
        customer: { firstName: params.firstName, lastName: params.lastName, phone: params.phone },
        onSuccess: () => setStage({ kind: 'waiting', reference: params.reference, method: 'card' }),
        onConfirmationPending: () => setStage({ kind: 'waiting', reference: params.reference, method: 'card' }),
        onClose: () => setStage({ kind: 'idle' }),
      })
    } catch (e) {
      setStage({ kind: 'failed', reason: errorMessage(e) })
    }
  }

  if (stage.kind === 'waiting') {
    return (
      <div className="card p-6 text-center">
        <Loader2 className="mx-auto animate-spin text-accent-700" size={28} aria-hidden />
        {stage.method === 'mobile_money' ? (
          <>
            <h2 className="mt-4 text-xl">Check your phone</h2>
            <p className="mx-auto mt-2 max-w-sm text-neutral-700">
              Approve the {formatMoney(totalNgwee)} request on {phone} and enter your PIN. This page updates by itself.
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-4 text-xl">Confirming your card payment</h2>
            <p className="mt-2 text-neutral-700">This usually takes a few seconds.</p>
          </>
        )}
      </div>
    )
  }

  const busy = stage.kind === 'starting'

  return (
    <div className="card p-5">
      <h2 className="text-lg">Pay {formatMoney(totalNgwee)}</h2>
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
        {(
          [
            ['mobile_money', 'Mobile money', Smartphone],
            ['card', 'Debit or credit card', CreditCard],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={cn('flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors', method === value ? 'border-accent-700 bg-accent-100' : 'border-neutral-300 hover:border-neutral-400')}
          >
            <Icon size={18} aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {stage.kind === 'failed' && <Alert>{stage.reason}</Alert>}

        {method === 'mobile_money' ? (
          <>
            <Field label="Mobile money number">
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  const detected = detectOperator(e.target.value)
                  if (detected) setOperator(detected)
                }}
              />
            </Field>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Network">
              {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
                <button
                  key={op}
                  type="button"
                  role="radio"
                  aria-checked={operator === op}
                  onClick={() => setOperator(op)}
                  className={cn('pill', operator === op ? 'bg-accent-700 text-white' : 'bg-neutral-100 hover:bg-neutral-200')}
                >
                  {OPERATOR_LABELS[op]}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void payMobile()}>
              {busy ? 'Sending request…' : `Send payment request`}
            </button>
            <p className="text-xs text-neutral-600">You&rsquo;ll get a prompt on your phone to approve the payment with your PIN.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-700">Visa and Mastercard are processed securely by Lenco. Your card details never touch our servers.</p>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void payCard()}>
              {busy ? 'Opening…' : 'Pay by card'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
