import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getMySales, markShipped } from '#/functions/orders.functions'
import { Alert, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
import { shippingLabel } from '#/data/shipping'
import { PAYOUT_STATUS } from '#/data/statuses'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/account/sales')({
  loader: () => getMySales(),
  component: Sales,
})

type Sale = Awaited<ReturnType<typeof getMySales>>[number]

const STATUS: Partial<Record<Sale['status'], { label: string; tone: string }>> = {
  to_ship: { label: 'Ship now', tone: 'bg-warning-soft text-warning' },
  shipped: { label: 'Shipped', tone: 'bg-accent-soft text-accent-soft-ink' },
  delivered: { label: 'Delivered', tone: 'bg-success-soft text-success' },
  disputed: { label: 'Problem reported', tone: 'bg-danger-soft text-danger' },
  refunded: { label: 'Refunded', tone: 'bg-sunken text-muted' },
}

const COMING: Sale['payoutStatus'][] = ['held', 'released', 'processing']

function Sales() {
  const sales = Route.useLoaderData()
  if (!sales.length) {
    return (
      <div className="rise py-12">
        <p className="text-xl font-medium">No sales yet</p>
        <Link to="/sell" className="btn btn-primary mt-6">
          List a book
        </Link>
      </div>
    )
  }

  const paid = sales.filter((s) => s.payoutStatus === 'paid').reduce((n, s) => n + s.payoutNgwee, 0)
  const coming = sales.filter((s) => COMING.includes(s.payoutStatus)).reduce((n, s) => n + s.payoutNgwee, 0)
  const waiting = sales.some((s) => s.payoutStatus === 'released' || s.payoutStatus === 'failed')
  // Parcels to ship lead; only the first gets the loud button.
  const ordered = [...sales].sort((a, b) => Number(b.status === 'to_ship') - Number(a.status === 'to_ship'))
  const firstToShip = ordered.find((s) => s.status === 'to_ship')?.id

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-x-10 gap-y-3" aria-label="Earnings">
        <div>
          <p className="eyebrow">Paid to you</p>
          <Price ngwee={paid} className="mt-1 block text-4xl font-extrabold tracking-[-0.03em] tabular-nums" />
        </div>
        {coming > 0 && (
          <div>
            <p className="eyebrow">On its way</p>
            <Price ngwee={coming} className="mt-1 block text-2xl font-medium text-muted tabular-nums" />
          </div>
        )}
      </section>

      {waiting && (
        <Alert tone="info">
          Money waiting.{' '}
          <Link to="/account/shop" className="font-medium">
            Add your mobile money number
          </Link>
        </Alert>
      )}

      <div className="space-y-4">
        {ordered.map((sale) => (
          <SaleCard key={sale.id} sale={sale} primary={sale.id === firstToShip} />
        ))}
      </div>
    </div>
  )
}

function SaleCard({ sale, primary }: { sale: Sale; primary: boolean }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const ship = useAction(async () => {
    await markShipped({ data: { sellerOrderId: sale.id, trackingNote: note } })
    await router.invalidate()
  })
  const status = STATUS[sale.status]
  const noteId = `ship-note-${sale.id}`

  return (
    <section className="card p-4 sm:p-5" aria-label={`Sale ${sale.order.number}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ul className="space-y-0.5">
            {sale.items.map((item) => (
              <li key={item.id} className="font-medium">
                {item.quantity > 1 && <span className="text-subtle tabular-nums">{item.quantity} × </span>}
                {item.title} <span className="text-sm font-normal text-subtle">{conditionLabel(item.condition)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-subtle">
            <span className="tabular-nums">{sale.order.number}</span> · {formatDate(sale.order.createdAt)} · {shippingLabel(sale.shippingMethod)}
          </p>
        </div>
        {status && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.tone)}>{status.label}</span>}
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-sm">
        <Price ngwee={sale.payoutNgwee} className="text-lg font-extrabold tracking-[-0.02em] tabular-nums" />
        <span className="text-subtle">{PAYOUT_STATUS[sale.payoutStatus].label}</span>
      </p>

      {sale.status === 'to_ship' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Laid out like the label on the parcel itself. */}
          <address className="rounded-lg border-2 border-dashed border-line-strong p-3.5 text-sm not-italic">
            <span className="eyebrow">Ship to</span>
            <span className="mt-1.5 block font-medium">{sale.order.shipName}</span>
            <span className="block text-muted">{sale.order.shipAddress}</span>
            <span className="block text-muted">
              {sale.order.shipTown}, {sale.order.shipProvince}
            </span>
            <a href={`tel:${sale.order.shipPhone}`} className="mt-1 block font-medium tabular-nums">
              {sale.order.shipPhone}
            </a>
          </address>
          <div className="flex flex-col gap-2">
            <label htmlFor={noteId} className="field-label mb-0">
              How did you send it?
            </label>
            <textarea id={noteId} className="input" rows={2} placeholder="Bus, receipt number, arrival day" value={note} onChange={(e) => setNote(e.target.value)} />
            {ship.error && <Alert>{ship.error}</Alert>}
            <button
              type="button"
              className={cn('btn self-start', primary ? 'btn-primary' : 'btn-secondary')}
              disabled={ship.pending || note.trim().length < 3}
              onClick={() => void ship.run()}
            >
              {ship.pending ? 'Saving…' : 'Mark as shipped'}
            </button>
          </div>
        </div>
      )}
      {sale.trackingNote && sale.status !== 'to_ship' && <p className="mt-3 text-sm text-muted">{sale.trackingNote}</p>}
    </section>
  )
}
