import { CheckCircleIcon, CreditCardIcon, DevicePhoneMobileIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/20/solid'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { checkPayment, startCardPayment, startMobileMoneyPayment } from '#/functions/orders.functions'
import { detectOperator, normalizeLocalPhone } from '#/lib/phone'
import type { Operator } from '#/lib/phone'
import { formatMoney } from '#/lib/money'
import { cn } from '#/lib/utils'
import { Alert, Field, errorMessage } from './form'
import { LoadingLine, Spinner } from './loading-line'
import { NetworkMark } from './payment-marks'
import { CARD_PAYMENTS, NETWORKS, PAY_COPY } from '#/data/payments'
import { SAFETY } from '#/data/safety'

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

type Stage =
  { kind: 'idle' } | { kind: 'starting' } | { kind: 'waiting'; reference: string; method: 'mobile_money' | 'card' } | { kind: 'failed'; reason: string }

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

export function PaymentPanel({
  orderNumber,
  totalNgwee,
  onPaid,
}: {
  orderNumber: string
  totalNgwee: number
  onPaid: () => void
}) {
  const [method, setMethod] = useState<'mobile_money' | 'card'>('mobile_money')
  // Starts empty: the money comes from whichever number they type, which isn't always the delivery one.
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState<Operator | null>(null)
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
      setStage(
        result.status === 'failed'
          ? { kind: 'failed', reason: result.reason ?? 'The payment could not be started.' }
          : { kind: 'waiting', reference: result.reference, method: 'mobile_money' },
      )
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
      <Swap stageKey="waiting">
        {stage.method === 'mobile_money' ? (
          <div className="card px-6 py-10 text-center" role="status" aria-live="polite">
            {operator && <NetworkMark network={operator} size="md" className="mx-auto" />}
            <h2 className="mt-5 text-2xl">{PAY_COPY.waitingTitle}</h2>
            <p className="mt-1 text-muted">{PAY_COPY.waitingBody(formatMoney(totalNgwee), phone)}</p>
            <LoadingLine kind="pay" stacked className="mt-8" />
            <p className="mt-8 text-xs text-subtle">{PAY_COPY.waitingNote}</p>
          </div>
        ) : (
          <div className="card p-6 text-center" role="status" aria-live="polite">
            <span
              aria-hidden
              className="mx-auto block size-7 animate-spin rounded-full border-[3px] border-line border-t-accent-ink motion-reduce:animate-none"
            />
            <h2 className="mt-4 text-xl">Confirming your card</h2>
          </div>
        )}
      </Swap>
    )
  }

  const busy = stage.kind === 'starting'
  const amount = formatMoney(totalNgwee)
  const validPhone = !!normalizeLocalPhone(phone)

  return (
    <Swap stageKey="form">
      <div className="card p-5 sm:p-6">
        <p className="eyebrow">Amount to pay</p>
        <p className="mt-1 text-3xl font-bold tracking-[-0.03em] tabular-nums">{amount}</p>

        {CARD_PAYMENTS && (
          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl bg-sunken p-1" role="radiogroup" aria-label="Pay with">
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
        )}

        <div className="mt-5 space-y-5">
          {stage.kind === 'failed' && <Alert>{stage.reason}</Alert>}

          {method === 'mobile_money' || !CARD_PAYMENTS ? (
            <>
              <Field label={PAY_COPY.numberLabel}>
                <span className="relative block">
                  <DevicePhoneMobileIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-subtle" aria-hidden />
                  <input
                    className="input pl-11 text-lg tracking-wide tabular-nums"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="097 123 4567"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      // The prefix tells us the network; a manual pick stays when it can't.
                      const detected = detectOperator(e.target.value)
                      if (detected) setOperator(detected)
                    }}
                  />
                </span>
              </Field>

              <fieldset>
                <legend className="field-label">{PAY_COPY.networkLabel}</legend>
                <div className="mt-3 grid grid-cols-3 justify-items-center gap-2" role="radiogroup" aria-label={PAY_COPY.networkLabel}>
                  {NETWORKS.map((n) => {
                    const picked = operator === n.key
                    return (
                      <button
                        key={n.key}
                        type="button"
                        role="radio"
                        aria-checked={picked}
                        onClick={() => setOperator(n.key)}
                        className="group flex flex-col items-center gap-1.5"
                      >
                        <span
                          className={cn(
                            'relative rounded-xl transition-[box-shadow,opacity]',
                            picked ? 'shadow-[0_0_0_2.5px_var(--color-accent)]' : operator ? 'opacity-45 group-hover:opacity-100' : '',
                          )}
                        >
                          <NetworkMark network={n.key} size="lg" />
                          {picked && <CheckCircleIcon className="rise absolute -top-2 -right-2 size-5 rounded-full bg-surface text-accent" aria-hidden />}
                        </span>
                        <span className={cn('text-xs', picked ? 'font-medium text-ink' : 'text-subtle')}>{n.name}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              <button type="button" className="btn btn-primary h-13 w-full gap-2 text-base" disabled={busy || !operator || !validPhone} onClick={() => void payMobile()}>
                {busy ? <Spinner /> : <LockClosedIcon className="size-4" aria-hidden />}
                {busy ? 'Sending the prompt…' : `Pay ${amount}`}
              </button>

              <p className="-mt-2 text-center text-xs text-subtle">{PAY_COPY.how}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-subtle">Visa or Mastercard, processed by Lenco.</p>
              <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={() => void payCard()}>
                {busy ? 'Opening…' : `Pay ${amount}`}
              </button>
            </>
          )}

          <p className="flex gap-2 border-t border-line pt-4 text-xs text-muted">
            <ShieldCheckIcon className="size-4 shrink-0 text-success" aria-hidden />
            {SAFETY.checkout}
          </p>
        </div>
      </div>
    </Swap>
  )
}

const SWAP = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const

/** The form and the waiting state replace each other in place; a short cross-fade keeps it from reading as a reload. */
function Swap({ stageKey, children }: { stageKey: string; children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stageKey}
          initial={{ opacity: 0, transform: 'translateY(6px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          exit={{ opacity: 0, transform: 'translateY(-6px)' }}
          transition={SWAP}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionConfig>
  )
}

/** The moment payment lands: what was paid, where the money is, and what happens next. */
export function PaymentSuccess({ totalNgwee, orderNumber }: { totalNgwee: number; orderNumber: string }) {
  return (
    <div className="card rise overflow-hidden" role="status" aria-live="polite">
      <div className="bg-success-soft px-5 py-7 text-center sm:px-8">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-surface shadow-sm">
          <CheckCircleIcon className="size-11 animate-[rise_500ms_var(--ease-out)_both] text-success motion-reduce:animate-none" aria-hidden />
        </span>
        <h2 className="mt-4 text-2xl sm:text-3xl">{PAY_COPY.successTitle}</h2>
        <p className="mt-1 text-muted">{PAY_COPY.successBody(formatMoney(totalNgwee))}</p>
        <p className="mt-3 text-xs text-subtle">
          Order <span className="font-medium text-ink tabular-nums">{orderNumber}</span>
        </p>
      </div>
      <ol className="space-y-4 px-5 py-6 sm:px-8">
        {PAY_COPY.next.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent-soft-ink tabular-nums">{i + 1}</span>
            <div>
              <p className="font-bold tracking-[-0.01em]">{step.title}</p>
              <p className="text-sm text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
