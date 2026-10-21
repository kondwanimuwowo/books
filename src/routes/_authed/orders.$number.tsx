import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { CheckCircle2, Phone } from 'lucide-react'
import { useCallback, useState } from 'react'
import { confirmDelivered, getOrder, reportProblem } from '#/functions/orders.functions'
import { BookCover } from '#/components/book'
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

type Part = Awaited<ReturnType<typeof getOrder>>['parts'][number]

const PART_STATUS: Record<Part['status'], { label: string; tone: string }> = {
  awaiting_payment: { label: 'Awaiting payment', tone: 'bg-neutral-100 text-neutral-800' },
  to_ship: { label: 'Seller is preparing', tone: 'bg-accent-100 text-accent-800' },
  shipped: { label: 'On its way', tone: 'bg-accent-100 text-accent-800' },
  delivered: { label: 'Delivered', tone: 'bg-success-100 text-success-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-neutral-100 text-neutral-700' },
  disputed: { label: 'Problem reported', tone: 'bg-danger-100 text-danger-700' },
}

function OrderPage() {
  const { order, parts, lastPayment } = Route.useLoaderData()
  const router = useRouter()
  const [justPaid, setJustPaid] = useState(false)
  const onPaid = useCallback(() => {
    setJustPaid(true)
    void router.invalidate()
  }, [router])

  const pending = order.status === 'pending_payment'

  return (
    <div className="page grid gap-8 py-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0">
        <p className="text-sm text-neutral-600">
          <Link to="/account">Your orders</Link> / {order.number}
        </p>
        <h1 className="mt-1 text-3xl">{pending ? 'Complete your payment' : `Order ${order.number}`}</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Placed {formatDate(order.createdAt)} · Delivering to {order.shipTown}, {order.shipProvince}
        </p>

        {justPaid && (
          <div className="mt-5">
            <Alert tone="success">Payment received. Your sellers have been told to ship, and we&rsquo;ve emailed you a receipt.</Alert>
          </div>
        )}

        <div className="mt-6 space-y-5">
          {parts.map((part) => (
            <PartCard key={part.id} part={part} pending={pending} />
          ))}
        </div>
      </div>

      <aside className="space-y-4 lg:pt-14">
        {pending && (
          <PaymentPanel orderNumber={order.number} totalNgwee={order.totalNgwee} defaultPhone={order.shipPhone} onPaid={onPaid} />
        )}
        {pending && lastPayment?.status === 'failed' && lastPayment.failureReason && <Alert>Last attempt failed: {lastPayment.failureReason}</Alert>}
        <div className="card space-y-2 p-5 text-sm">
          <div className="flex justify-between">
            <span>Items</span>
            <Price ngwee={order.subtotalNgwee} />
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <Price ngwee={order.shippingNgwee} />
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <Price ngwee={order.totalNgwee} />
          </div>
          {!pending && <p className="pt-1 text-xs text-neutral-600">Paid {order.paidAt ? formatDate(order.paidAt) : ''}. Held safely until you confirm delivery.</p>}
        </div>
      </aside>
    </div>
  )
}

function PartCard({ part, pending }: { part: Part; pending: boolean }) {
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
  const status = PART_STATUS[part.status]
  const canConfirm = part.status === 'shipped' || part.status === 'to_ship'

  return (
    <section className="card overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
        <span>
          From <span className="font-semibold">{part.seller.storeName}</span> · {shippingLabel(part.shippingMethod)}
        </span>
        {!pending && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.tone)}>{status.label}</span>}
      </header>
      <ul className="divide-y divide-neutral-200">
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
              <p className="text-sm text-neutral-700">
                {conditionLabel(item.condition)} · Qty {item.quantity}
              </p>
            </div>
            <Price ngwee={item.unitPriceNgwee * item.quantity} className="text-sm font-semibold" />
          </li>
        ))}
      </ul>

      {!pending && (
        <div className="space-y-3 border-t border-neutral-200 p-4 text-sm">
          {part.trackingNote && (
            <p>
              <span className="font-medium">Delivery details: </span>
              {part.trackingNote}
            </p>
          )}
          {part.seller.phone && (
            <p className="flex items-center gap-2 text-neutral-700">
              <Phone size={14} aria-hidden />
              Seller: <a href={`tel:${part.seller.phone}`}>{part.seller.phone}</a>
            </p>
          )}
          {part.status === 'delivered' && (
            <p className="flex items-center gap-2 text-success-700">
              <CheckCircle2 size={16} aria-hidden /> You confirmed delivery{part.deliveredAt ? ` on ${formatDate(part.deliveredAt)}` : ''}.
            </p>
          )}
          {part.status === 'shipped' && part.autoReleaseAt && (
            <p className="text-xs text-neutral-600">If you don&rsquo;t confirm or report a problem, payment is released to the seller on {formatDate(part.autoReleaseAt)}.</p>
          )}
          {(confirm.error || report.error) && <Alert>{confirm.error ?? report.error}</Alert>}
          {canConfirm && !reporting && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" disabled={confirm.pending} onClick={() => void confirm.run()}>
                I&rsquo;ve received these books
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReporting(true)}>
                Report a problem
              </button>
            </div>
          )}
          {reporting && (
            <div className="space-y-2">
              <textarea className="input" rows={3} placeholder="What went wrong? We hold the payment while we sort it out." value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary btn-sm" disabled={report.pending || note.trim().length < 10} onClick={() => void report.run()}>
                  Send report
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
