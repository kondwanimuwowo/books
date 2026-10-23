import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { CheckCircleIcon, PhoneIcon } from '@heroicons/react/16/solid'
import { useCallback, useState } from 'react'
import { confirmDelivered, getOrder, reportProblem } from '#/functions/orders.functions'
import { BookCover } from '#/components/book'
import { CheckoutSteps } from '#/components/checkout-steps'
import { Alert, useAction } from '#/components/form'
import { PaymentPanel } from '#/components/payment-panel'
import { Price } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
import { shippingLabel } from '#/data/shipping'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/orders/$number')({
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
    <div className="page py-8">
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

          {justPaid && (
            <div className="rise mt-5">
              <Alert tone="success">Paid. Your sellers are packing.</Alert>
            </div>
          )}

          {/* Phones pay first; the parcels can wait below. */}
          {payment && <div className="mt-6 lg:hidden">{payment}</div>}

          <div className="mt-6 space-y-5">
            {parts.map((part, i) => (
              <ParcelCard key={part.id} part={part} index={i} total={parts.length} pending={pending} destination={order.shipTown} primary={part.id === firstConfirmable} />
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
              <Price ngwee={order.totalNgwee} className="text-lg font-extrabold tracking-[-0.02em] tabular-nums" />
            </div>
            {!pending && <p className="pt-1 text-xs text-subtle">Held until you confirm delivery.</p>}
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

/** The parcel's journey from the seller's town to the buyer's, the way books actually travel here. */
function ParcelRoute({ from, to, status }: { from: string; to: string; status: Part['status'] }) {
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
          className={cn('absolute top-[5px] left-1 h-0.5 transition-[width] duration-700 ease-out', halted ? 'bg-danger' : 'bg-accent')}
          style={{ width: `calc(${(reached / 2) * 100}% - 0.5rem)` }}
        />
        {ROUTE_STOPS.map((stop, i) => (
          <li key={stop} className="relative flex flex-col items-center first:items-start last:items-end">
            <span className={cn('size-3 rounded-full ring-4 ring-surface', i <= reached ? (halted && i === reached ? 'bg-danger' : 'bg-accent') : 'bg-line-strong')} />
            <span className={cn('mt-1.5 text-[11px]', i <= reached ? 'text-ink' : 'text-subtle')}>{stop}</span>
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

function ParcelCard({ part, index, total, pending, destination, primary }: { part: Part; index: number; total: number; pending: boolean; destination: string; primary: boolean }) {
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

  return (
    <section className="card overflow-hidden" aria-label={`Parcel from ${part.seller.storeName}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-3 text-sm">
        <p>
          {total > 1 && <span className="eyebrow mr-2">{`Parcel ${index + 1} of ${total}`}</span>}
          <span className="font-medium">{part.seller.storeName}</span>
        </p>
        <span className="text-xs text-subtle">{shippingLabel(part.shippingMethod)}</span>
      </header>

      {!pending && <ParcelRoute from={part.seller.town} to={destination} status={part.status} />}

      <ul className="divide-y divide-line">
        {part.items.map((item) => (
          <li key={item.id} className="flex gap-4 p-4">
            <div className="w-12 shrink-0">
              <BookCover src={item.coverUrl} title={item.title} />
            </div>
            <div className="min-w-0 flex-1">
              {item.slug ? (
                <Link to="/books/$slug" params={{ slug: item.slug }} className="line-clamp-2 font-medium text-ink">
                  {item.title}
                </Link>
              ) : (
                <p className="font-medium">{item.title}</p>
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
            <a href={`tel:${part.seller.phone}`} className="inline-flex items-center gap-1.5 text-muted">
              <PhoneIcon className="size-3.5" aria-hidden />
              {part.seller.phone}
            </a>
          )}
          {part.status === 'delivered' && (
            <p className="flex items-center gap-1.5 text-success">
              <CheckCircleIcon className="size-4" aria-hidden /> Received{part.deliveredAt ? ` ${formatDate(part.deliveredAt)}` : ''}
            </p>
          )}
          {halted && <p className={halted.tone}>{halted.text}</p>}
          {part.status === 'shipped' && part.autoReleaseAt && <p className="text-xs text-subtle">Confirms itself on {formatDate(part.autoReleaseAt)}.</p>}
          {(confirm.error || report.error) && <Alert>{confirm.error ?? report.error}</Alert>}

          {canConfirm && !reporting && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className={cn('btn btn-sm', primary ? 'btn-primary' : 'btn-secondary')} disabled={confirm.pending} onClick={() => void confirm.run()}>
                {confirm.pending ? 'Confirming…' : 'I have these books'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting(true)}>
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
