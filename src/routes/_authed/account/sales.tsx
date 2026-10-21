import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getMySales, markShipped } from '#/functions/orders.functions'
import { Alert, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
import { shippingLabel } from '#/data/shipping'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/account/sales')({
  loader: () => getMySales(),
  component: Sales,
})

type Sale = Awaited<ReturnType<typeof getMySales>>[number]

const STATUS: Partial<Record<Sale['status'], { label: string; tone: string }>> = {
  to_ship: { label: 'Ship now', tone: 'bg-copper-100 text-copper-700' },
  shipped: { label: 'Shipped', tone: 'bg-accent-100 text-accent-800' },
  delivered: { label: 'Delivered', tone: 'bg-success-100 text-success-700' },
  disputed: { label: 'Problem reported', tone: 'bg-danger-100 text-danger-700' },
}

const PAYOUT: Record<Sale['payoutStatus'], string> = {
  held: 'Held until delivery',
  released: 'Ready to pay out',
  processing: 'Paying out',
  paid: 'Paid to you',
  failed: 'Payout failed',
}

function Sales() {
  const sales = Route.useLoaderData()
  if (!sales.length) return <p className="py-12 text-center text-neutral-700">No sales yet. They&rsquo;ll appear here as soon as a buyer pays.</p>

  const waiting = sales.some((s) => s.payoutStatus === 'released' || s.payoutStatus === 'failed')
  return (
    <div className="space-y-4">
      {waiting && (
        <Alert tone="info">
          You have money waiting.{' '}
          <Link to="/account/shop" className="font-medium">
            Add your mobile money number
          </Link>{' '}
          to get paid.
        </Alert>
      )}
      {sales.map((sale) => (
        <SaleCard key={sale.id} sale={sale} />
      ))}
    </div>
  )
}

function SaleCard({ sale }: { sale: Sale }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const ship = useAction(async () => {
    await markShipped({ data: { sellerOrderId: sale.id, trackingNote: note } })
    await router.invalidate()
  })
  const status = STATUS[sale.status]

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {sale.order.number} <span className="font-normal text-neutral-600">· {formatDate(sale.order.createdAt)}</span>
          </p>
          <p className="text-sm text-neutral-700">
            {shippingLabel(sale.shippingMethod)} to {sale.order.shipName}, {sale.order.shipTown}
          </p>
        </div>
        {status && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.tone)}>{status.label}</span>}
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {sale.items.map((item) => (
          <li key={item.id}>
            {item.quantity} × {item.title} <span className="text-neutral-600">({conditionLabel(item.condition)})</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          You receive <Price ngwee={sale.payoutNgwee} className="font-semibold" />
        </span>
        <span className="text-neutral-600">{PAYOUT[sale.payoutStatus]}</span>
      </div>

      {sale.status === 'to_ship' && (
        <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4">
          <p className="text-sm">
            Send to: <span className="font-medium">{sale.order.shipName}</span>, {sale.order.shipAddress}, {sale.order.shipTown}, {sale.order.shipProvince} ·{' '}
            <a href={`tel:${sale.order.shipPhone}`}>{sale.order.shipPhone}</a>
          </p>
          {ship.error && <Alert>{ship.error}</Alert>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="input"
              placeholder="e.g. Sent on Mazhandu bus, receipt 4521, arrives Kasama Thursday"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="button" className="btn btn-primary shrink-0" disabled={ship.pending || note.trim().length < 3} onClick={() => void ship.run()}>
              Mark as shipped
            </button>
          </div>
        </div>
      )}
      {sale.trackingNote && sale.status !== 'to_ship' && <p className="mt-3 text-sm text-neutral-700">Your note: {sale.trackingNote}</p>}
    </section>
  )
}
