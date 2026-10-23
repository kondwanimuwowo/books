import { CreditCardIcon, DevicePhoneMobileIcon } from '@heroicons/react/20/solid'
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
    return stage.method === 'mobile_money' ? (
      <div className="card rise p-6 text-center" role="status" aria-live="polite">
        <PhonePrompt amount={formatMoney(totalNgwee)} network={operator ? OPERATOR_LABELS[operator] : 'Mobile money'} />
        <h2 className="mt-5 text-xl">Check your phone</h2>
        <p className="mt-1 text-muted">
          Approve {formatMoney(totalNgwee)} on {phone}.
        </p>
      </div>
    ) : (
      <div className="card rise p-6 text-center" role="status" aria-live="polite">
        <span aria-hidden className="mx-auto block size-7 animate-spin rounded-full border-[3px] border-line border-t-accent-ink motion-reduce:animate-none" />
        <h2 className="mt-4 text-xl">Confirming your card</h2>
      </div>
    )
  }

  const busy = stage.kind === 'starting'
  const amount = formatMoney(totalNgwee)

  return (
    <div className="card p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1" role="radiogroup" aria-label="Pay with">
        {(
          [
            ['mobile_money', 'Mobile money', DevicePhoneMobileIcon],
            ['card', 'Card', CreditCardIcon],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors',
              method === value ? 'bg-surface text-ink shadow-sm' : 'text-subtle hover:text-ink',
            )}
          >
            <Icon className="size-5" aria-hidden /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {stage.kind === 'failed' && <Alert>{stage.reason}</Alert>}

        {method === 'mobile_money' ? (
          <>
            <Field label="Mobile money number">
              <span className="relative block">
                <input
                  className="input pr-20"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    setOperator(detectOperator(e.target.value))
                  }}
                />
                {/* The prefix already tells us the network; only ask when it can't. */}
                {operator && (
                  <span className="rise absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-ink">
                    {OPERATOR_LABELS[operator]}
                  </span>
                )}
              </span>
            </Field>
            {!operator && phone.replace(/\D/g, '').length >= 3 && (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Network">
                {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
                  <button key={op} type="button" role="radio" aria-checked={false} onClick={() => setOperator(op)} className="pill bg-sunken hover:bg-sunken-strong">
                    {OPERATOR_LABELS[op]}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-primary w-full" disabled={busy || !operator} onClick={() => void payMobile()}>
              {busy ? 'Sending…' : `Pay ${amount}`}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-subtle">Visa or Mastercard, processed by Lenco.</p>
            <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void payCard()}>
              {busy ? 'Opening…' : `Pay ${amount}`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** A phone showing the approval prompt the buyer is about to receive, so they know what to look for. */
function PhonePrompt({ amount, network }: { amount: string; network: string }) {
  return (
    <div aria-hidden className="mx-auto w-32 rounded-[1.4rem] bg-ink p-1.5 shadow-md">
      <div className="flex h-44 flex-col justify-center rounded-[1.05rem] bg-canvas px-2.5">
        <div className="animate-[rise_600ms_cubic-bezier(0.2,0,0,1)_both,prompt-pulse_2.4s_ease-in-out_600ms_infinite] rounded-lg bg-surface p-2.5 text-left shadow-md motion-reduce:animate-none">
          <p className="text-[9px] font-medium tracking-[0.12em] text-subtle uppercase">{network}</p>
          <p className="mt-1 text-[11px] leading-tight text-ink">Pay {amount} to Kuwala Books?</p>
          <div className="mt-2 grid grid-cols-2 gap-1 text-center text-[10px] font-medium">
            <span className="rounded bg-sunken py-1 text-subtle">Cancel</span>
            <span className="rounded bg-accent py-1 text-on-accent">Approve</span>
          </div>
        </div>
      </div>
    </div>
  )
}
