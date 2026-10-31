import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { CheckCircleIcon, CheckIcon, FlagIcon, PhoneIcon } from '@heroicons/react/16/solid'
import { useCallback, useState } from 'react'
import { confirmDelivered, getOrder, reportProblem } from '#/functions/orders.functions'
import { BookCover } from '#/components/book'
import { CheckoutSteps } from '#/components/checkout-steps'
import { Alert, useAction } from '#/components/form'
import { PaymentPanel, PaymentSuccess } from '#/components/payment-panel'
import { Price } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
import { shippingLabel } from '#/data/shipping'
import { SAFETY } from '#/data/safety'
import { FULFILMENT_COPY, REFUND_COPY, SHIP_WITHIN_DAYS } from '#/data/fulfilment'
import { formatMoney } from '#/lib/money'
import { cn, formatDate } from '#/lib/utils'
import { PageShapes, ParcelShapes, Placeholder } from '#/components/placeholder'
import { RateParcel, ReviewBook } from '#/components/reputation'
import { REPUTATION_COPY, SHOP_TAGS, withinRatingWindow } from '#/data/reputation'

export const Route = createFileRoute('/_authed/orders/$number')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading order" shapes={<PageShapes><ParcelShapes /></PageShapes>} />,
  loader: ({ params }) => getOrder({ data: { number: params.number } }),
  head: ({ params }) => ({ meta: [{ title: `Order ${params.number} | Kuwala Books` }] }),
  component: OrderPage,
})

type Data = Awaited<ReturnType<typeof getOrder>>
type Part = Data['parts'][number]

const CONFIRMABLE: Part['status'][] = ['to_ship', 'shipped']

function OrderPage() {
  const { order, parts, lastPayment } = Route.useLoaderData()
  const router = useRouter()
  const [justPaid, setJustPaid] = useState(false)
  const onPaid = useCallback(() => {
    setJustPaid(true)
    // Phones were scrolled down at the pay form; the good news goes at the top.
    window.scrollTo({ top: 0, behavior: 'smooth' })
    void router.invalidate()
  }, [router])

  const pending = order.status === 'pending_payment'
  // One loud button per screen: only the first parcel awaiting confirmation gets it.
  const firstConfirmable = parts.find((p) => CONFIRMABLE.includes(p.status))?.id

  const payment = pending && (
    <div className="space-y-3">
      {lastPayment?.status === 'failed' && lastPayment.failureReason && <Alert>Last try failed: {lastPayment.failureReason}</Alert>}
      <PaymentPanel orderNumber={order.number} totalNgwee={order.totalNgwee} defaultPhone={order.shipPhone} onPaid={onPaid} />
    </div>
  )

  return (
    <div className="page max-w-5xl py-8">
      {pending && <CheckoutSteps current={2} />}

      <div className={cn('grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10', pending && 'mt-8')}>
        <div className="min-w-0">
          <p className="text-sm text-subtle">
            <Link to="/account">Orders</Link> / <span className="tabular-nums">{order.number}</span>
          </p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{pending ? 'Pay for your order' : `Order ${order.number}`}</h1>
          <p className="mt-1 text-sm text-subtle">
            {formatDate(order.createdAt)} · to {order.shipTown}
          </p>

          {justPaid && !pending && (
            <div className="mt-6 space-y-3">
              <PaymentSuccess totalNgwee={order.totalNgwee} orderNumber={order.number} />
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Link to="/" className="btn btn-primary">
                  Keep shopping
                </Link>
                <Link to="/account" className="btn btn-secondary">
                  Your orders
                </Link>
              </div>
            </div>
          )}

          {/* Phones pay first; the parcels can wait below. */}
          {payment && <div className="mt-6 lg:hidden">{payment}</div>}

          <div className="mt-6 space-y-5">
            {parts.map((part, i) => (
              <ParcelCard key={part.id} part={part} index={i} total={parts.length} pending={pending} paidAt={order.paidAt} destination={order.shipTown} primary={part.id === firstConfirmable} />
            ))}
          </div>
        </div>

        <aside className="space-y-4 lg:pt-16">
          {payment && <div className="hidden lg:block">{payment}</div>}
          <div className="card space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Books</span>
              <Price ngwee={order.subtotalNgwee} className="tabular-nums" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Delivery</span>
              <Price ngwee={order.shippingNgwee} className="tabular-nums" />
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <span className="font-medium">Total</span>
              <Price ngwee={order.totalNgwee} className="text-lg font-bold tracking-[-0.02em] tabular-nums" />
            </div>
            {!pending && <p className="pt-1 text-xs text-muted">Held until you confirm delivery.</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}

const ROUTE_STOPS = ['Paid', 'Shipped', 'Delivered'] as const

function stopIndex(status: Part['status']) {
  if (status === 'delivered') return 2
  if (status === 'shipped' || status === 'disputed') return 1
  return 0
}

const shortDay = (date: Date | string) => new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/** The parcel's journey from the seller's town to the buyer's, the way books actually travel here, dated as it goes. */
function ParcelRoute({ from, to, status, dates }: { from: string; to: string; status: Part['status']; dates: readonly (Date | string | null)[] }) {
  const reached = stopIndex(status)
  const halted = status === 'disputed' || status === 'refunded' || status === 'cancelled'
  return (
    <div className="px-4 pt-4">
      <div className="flex justify-between text-xs font-medium">
        <span>{from}</span>
        <span>{to}</span>
      </div>
      <ol className="relative mt-2 flex justify-between" aria-label={`Parcel status: ${ROUTE_STOPS[reached]}`}>
        <span aria-hidden className="absolute inset-x-1 top-[5px] h-0.5 bg-line" />
        <span
          aria-hidden
          className={cn('absolute inset-x-1 top-[5px] h-0.5 origin-left transition-transform duration-500 ease-out', halted ? 'bg-danger' : 'bg-accent')}
          style={{ transform: `scaleX(${reached / 2})` }}
        />
        {ROUTE_STOPS.map((stop, i) => (
          <li key={stop} className="relative flex flex-col items-center first:items-start last:items-end">
            <span className={cn('size-3 rounded-full ring-4 ring-surface', i <= reached ? (halted && i === reached ? 'bg-danger' : 'bg-accent') : 'bg-line-strong')} />
            <span className={cn('mt-1.5 text-[11px]', i <= reached ? 'text-ink' : 'text-subtle')}>{stop}</span>
            {i <= reached && dates[i] && (
              <span className="text-[11px] text-subtle tabular-nums" suppressHydrationWarning>
                {shortDay(dates[i])}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

const HALTED_LABEL: Partial<Record<Part['status'], { text: string; tone: string }>> = {
  disputed: { text: 'Problem reported. Payment on hold.', tone: 'text-danger' },
  refunded: { text: 'Refunded.', tone: 'text-subtle' },
  cancelled: { text: 'Cancelled.', tone: 'text-subtle' },
}

function ParcelCard({
  part,
  index,
  total,
  pending,
  paidAt,
  destination,
  primary,
}: {
  part: Part
  index: number
  total: number
  pending: boolean
  paidAt: Date | string | null
  destination: string
  primary: boolean
}) {
  const router = useRouter()
  const [reporting, setReporting] = useState(false)
  const [note, setNote] = useState('')
  const confirm = useAction(async () => {
    await confirmDelivered({ data: { sellerOrderId: part.id } })
    await router.invalidate()
  })
  const report = useAction(async () => {
    await reportProblem({ data: { sellerOrderId: part.id, note } })
    setReporting(false)
    await router.invalidate()
  })
  const canConfirm = CONFIRMABLE.includes(part.status)
  const halted = HALTED_LABEL[part.status]
  const sendsBy = part.status === 'to_ship' && paidAt ? new Date(new Date(paidAt).getTime() + SHIP_WITHIN_DAYS * 86_400_000) : null

  return (
    <section className="card overflow-hidden" aria-label={`Parcel from ${part.seller.storeName}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 text-sm">
        <p>
          {total > 1 && <span className="eyebrow mr-2">{`Parcel ${index + 1} of ${total}`}</span>}
          <span className="font-medium">{part.seller.storeName}</span>
        </p>
        <span className="text-xs text-muted">{shippingLabel(part.shippingMethod)}</span>
      </header>

      {!pending && part.seller.town && <ParcelRoute from={part.seller.town} to={destination} status={part.status} dates={[paidAt, part.shippedAt, part.deliveredAt]} />}

      <ul className="divide-y divide-line">
        {part.items.map((item) => (
          <li key={item.id} className="flex gap-4 p-4">
            <div className="w-12 shrink-0">
              <BookCover src={item.coverUrl} title={item.title} />
            </div>
            <div className="min-w-0 flex-1">
              {item.slug ? (
                <Link to="/books/$slug" params={{ slug: item.slug }} className="line-clamp-2 font-bold tracking-[-0.01em] text-ink">
                  {item.title}
                </Link>
              ) : (
                <p className="font-bold tracking-[-0.01em]">{item.title}</p>
              )}
              <p className="text-sm text-subtle">
                {conditionLabel(item.condition)}
                {item.quantity > 1 && ` · ${item.quantity}`}
              </p>
            </div>
            <Price ngwee={item.unitPriceNgwee * item.quantity} className="text-sm font-medium tabular-nums" />
          </li>
        ))}
      </ul>

      {!pending && (
        <div className="space-y-3 border-t border-line p-4 text-sm">
          {part.trackingNote && <p className="text-muted">{part.trackingNote}</p>}
          {part.seller.phone && (
            <div>
              <a href={`tel:${part.seller.phone}`} className="inline-flex items-center gap-1.5 text-muted">
                <PhoneIcon className="size-3.5" aria-hidden />
                {part.seller.phone}
              </a>
              <p className="mt-1 text-xs text-muted">{SAFETY.buyerContact}</p>
            </div>
          )}
          {part.status === 'delivered' && (
            <p className="flex items-center gap-1.5 text-success">
              <CheckCircleIcon className="size-4" aria-hidden /> Received{part.deliveredAt ? ` ${formatDate(part.deliveredAt)}` : ''}
            </p>
          )}
          {part.status === 'delivered' && part.deliveredAt && (part.myRating !== null || withinRatingWindow(part.deliveredAt)) && (
            <div className="border-t border-line pt-4">
              <RateParcel sellerOrderId={part.id} title={REPUTATION_COPY.rateShop(part.seller.storeName)} tags={SHOP_TAGS} current={part.myRating} />
            </div>
          )}
          {part.status === 'delivered' &&
            part.items.map(
              (item) =>
                item.bookId &&
                item.slug && (
                  <div key={item.id} className="border-t border-line pt-4">
                    <ReviewBook bookId={item.bookId} slug={item.slug} title={item.title} current={item.myReview} />
                  </div>
                ),
            )}
          {sendsBy && (
            <p className="text-muted" suppressHydrationWarning>
              {FULFILMENT_COPY.sendsBy(part.seller.storeName, sendsBy.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}
            </p>
          )}
          {halted && <p className={halted.tone}>{halted.text}</p>}
          {part.status === 'refunded' && part.refund && <RefundNote refund={part.refund} />}
          {part.status === 'shipped' && part.autoReleaseAt && <p className="text-xs text-muted">Confirms itself on {formatDate(part.autoReleaseAt)}.</p>}
          {(confirm.error || report.error) && <Alert>{confirm.error ?? report.error}</Alert>}

          {canConfirm && !reporting && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className={cn('btn btn-sm gap-1.5', primary ? 'btn-primary' : 'btn-secondary')} disabled={confirm.pending} onClick={() => void confirm.run()}>
                <CheckIcon className="size-4" aria-hidden />
                {confirm.pending ? 'Confirming…' : 'I have these books'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm gap-1.5" onClick={() => setReporting(true)}>
                <FlagIcon className="size-4" aria-hidden />
                Report a problem
              </button>
            </div>
          )}
          {reporting && (
            <div className="rise space-y-2">
              <label className="sr-only" htmlFor={`report-${part.id}`}>
                What went wrong?
              </label>
              <textarea id={`report-${part.id}`} className="input" rows={3} placeholder="What went wrong?" value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={report.pending || note.trim().length < 10} onClick={() => void report.run()}>
                  Send
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** Where a refunded parcel's money went, and when. */
function RefundNote({ refund }: { refund: NonNullable<Part['refund']> }) {
  const amount = formatMoney(refund.amountNgwee)
  const to = REFUND_COPY.number(refund.phone)
  const line =
    refund.status === 'paid' || refund.status === 'done_manually'
      ? REFUND_COPY.paid(amount, to, formatDate(refund.updatedAt))
      : refund.status === 'processing'
        ? REFUND_COPY.processing(amount, to)
        : REFUND_COPY.manual(amount)
  return (
    <div className="rounded-lg bg-sunken p-3">
      <p className="font-medium">{line}</p>
      <p className="mt-0.5 text-xs text-muted">{REFUND_COPY.reason[refund.reason]}</p>
    </div>
  )
}
